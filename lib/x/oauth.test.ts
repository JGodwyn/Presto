import { createHash } from "crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildAuthorizationUrl,
  createPkcePair,
  exchangeCodeForToken,
  fetchXProfile,
  getXConfig,
  getXCredentials,
  refreshAccessToken,
  resolveRequestOrigin,
  REFRESH_TOKEN_TTL_MS,
  X_CALLBACK_PATH,
  X_SCOPES,
  type XConfig,
} from "@/lib/x/oauth"

const ORIGINAL_ENV = { ...process.env }

const CONFIG: XConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3003/api/connections/x/callback",
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("getXCredentials", () => {
  it("is null until both halves are configured", () => {
    delete process.env.X_CLIENT_ID
    delete process.env.X_CLIENT_SECRET
    expect(getXCredentials()).toBeNull()

    process.env.X_CLIENT_ID = "client-id"
    expect(getXCredentials()).toBeNull()

    process.env.X_CLIENT_SECRET = "client-secret"
    expect(getXCredentials()).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
    })
  })
})

describe("getXConfig", () => {
  it("derives the redirect URI from the request's own origin", () => {
    process.env.X_CLIENT_ID = "client-id"
    process.env.X_CLIENT_SECRET = "client-secret"
    delete process.env.X_REDIRECT_URI

    expect(getXConfig("http://localhost:3003")?.redirectUri).toBe(
      `http://localhost:3003${X_CALLBACK_PATH}`
    )
  })

  it("lets X_REDIRECT_URI win, for a proxied origin", () => {
    process.env.X_CLIENT_ID = "client-id"
    process.env.X_CLIENT_SECRET = "client-secret"
    process.env.X_REDIRECT_URI = "https://presto.app/custom/callback"

    expect(getXConfig("http://internal:3000")?.redirectUri).toBe(
      "https://presto.app/custom/callback"
    )
  })
})

describe("createPkcePair", () => {
  it("derives the challenge as the base64url SHA-256 of the verifier", () => {
    const { verifier, challenge } = createPkcePair()

    expect(challenge).toBe(
      createHash("sha256").update(verifier).digest("base64url")
    )
  })

  it("produces an RFC 7636-legal verifier", () => {
    const { verifier } = createPkcePair()

    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    // base64url only — a "+" or "/" from plain base64 would be re-encoded in
    // transit and the exchange would fail with a mismatched verifier.
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it("is a fresh pair every call", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier)
  })
})

describe("buildAuthorizationUrl", () => {
  it("carries the PKCE challenge and the S256 method", () => {
    const url = new URL(buildAuthorizationUrl(CONFIG, "state-value", "challenge-value"))

    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe("client-id")
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri)
    expect(url.searchParams.get("state")).toBe("state-value")
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value")
    // "plain" would send the verifier itself, defeating the point.
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  })

  it("never puts the client secret in a URL the browser will see", () => {
    const url = buildAuthorizationUrl(CONFIG, "state-value", "challenge-value")

    expect(url).not.toContain("client-secret")
  })

  it("sends scopes space-delimited", () => {
    const url = new URL(buildAuthorizationUrl(CONFIG, "s", "c"))

    expect(url.searchParams.get("scope")).toBe(X_SCOPES.join(" "))
  })
})

describe("exchangeCodeForToken", () => {
  it("presents the verifier and authenticates with a Basic header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 7200,
        scope: "users.read tweet.read offline.access",
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await exchangeCodeForToken(CONFIG, "the-code", "the-verifier", 1_000)

    expect(result.ok).toBe(true)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.x.com/2/oauth2/token")

    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`
    )

    const body = new URLSearchParams(init.body as string)
    expect(body.get("grant_type")).toBe("authorization_code")
    expect(body.get("code")).toBe("the-code")
    expect(body.get("code_verifier")).toBe("the-verifier")
    // The secret rides in the header, so it must not also be in a body that a
    // request log could capture.
    expect(body.get("client_secret")).toBeNull()
  })

  it("derives both expiries from the response and the passed clock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 7200,
        })
      )
    )

    const result = await exchangeCodeForToken(CONFIG, "code", "verifier", 1_000)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.accessToken).toBe("access")
    expect(result.value.refreshToken).toBe("refresh")
    expect(result.value.expiresAt.getTime()).toBe(1_000 + 7200 * 1000)
    expect(result.value.refreshExpiresAt?.getTime()).toBe(
      1_000 + REFRESH_TOKEN_TTL_MS
    )
  })

  it("leaves the refresh horizon null when no refresh token came back", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ access_token: "access", expires_in: 7200 }))
    )

    const result = await exchangeCodeForToken(CONFIG, "code", "verifier", 1_000)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.refreshToken).toBeNull()
    expect(result.value.refreshExpiresAt).toBeNull()
  })

  it("reports a rejected fetch as a network failure, not bad credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed"))
    )

    const result = await exchangeCodeForToken(CONFIG, "code", "verifier")

    expect(result).toEqual({ ok: false, failure: "network" })
  })

  it("fails on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, { status: 400 }))
    )

    const result = await exchangeCodeForToken(CONFIG, "code", "verifier")

    expect(result).toEqual({ ok: false, failure: "exchange" })
  })

  it("fails on a 200 that is missing the token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ expires_in: 7200 })))

    const result = await exchangeCodeForToken(CONFIG, "code", "verifier")

    expect(result).toEqual({ ok: false, failure: "exchange" })
  })
})

describe("refreshAccessToken", () => {
  it("returns the replacement refresh token, which supersedes the one spent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 7200,
        })
      )
    )

    const result = await refreshAccessToken(CONFIG, "old-refresh", 5_000)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.refreshToken).toBe("new-refresh")
    expect(result.value.refreshToken).not.toBe("old-refresh")
    // Restamped, not carried over: each rotation buys another six months.
    expect(result.value.refreshExpiresAt?.getTime()).toBe(
      5_000 + REFRESH_TOKEN_TTL_MS
    )
  })

  it("sends the refresh grant with the token being spent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "a", refresh_token: "r", expires_in: 7200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    await refreshAccessToken(CONFIG, "old-refresh")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get("grant_type")).toBe("refresh_token")
    expect(body.get("refresh_token")).toBe("old-refresh")
  })
})

describe("fetchXProfile", () => {
  it("maps X's data envelope onto the stored shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            id: "1234567890",
            name: "Godwin John",
            username: "prestoapp",
            profile_image_url: "https://pbs.twimg.com/avatar.jpg",
          },
        })
      )
    )

    const result = await fetchXProfile("access")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value).toEqual({
      id: "1234567890",
      name: "Godwin John",
      // Stored without the @ — the UI adds it.
      handle: "prestoapp",
      avatarUrl: "https://pbs.twimg.com/avatar.jpg",
    })
  })

  it("falls back to the handle rather than failing a nameless account", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ data: { id: "1", name: "", username: "ghost" } }))
    )

    const result = await fetchXProfile("access")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.name).toBe("@ghost")
    expect(result.value.avatarUrl).toBeNull()
  })

  it("fails when the identity is missing, which nothing downstream can invent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: { name: "No id" } }))
    )

    expect(await fetchXProfile("access")).toEqual({
      ok: false,
      failure: "profile",
    })
  })

  it("distinguishes an unreachable X from a rejected token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))

    expect(await fetchXProfile("access")).toEqual({
      ok: false,
      failure: "network",
    })
  })
})

describe("resolveRequestOrigin", () => {
  it("honours a loopback Host, which is what nextUrl.origin gets wrong", () => {
    // Next reports localhost in development whatever host was requested, and
    // X's console can only register 127.0.0.1 — so without this the
    // redirect_uri would never match and every connect attempt would fail.
    expect(
      resolveRequestOrigin("http://localhost:3003", "127.0.0.1:3003")
    ).toBe("http://127.0.0.1:3003")
  })

  it("passes localhost through unchanged", () => {
    expect(resolveRequestOrigin("http://localhost:3003", "localhost:3003")).toBe(
      "http://localhost:3003"
    )
  })

  it("ignores a non-loopback Host, so a forged header cannot redirect anywhere", () => {
    // The Host header is client-controlled; building a redirect off an
    // arbitrary one is an open redirect. Only loopback may override.
    expect(
      resolveRequestOrigin("https://presto.app", "evil.example.com")
    ).toBe("https://presto.app")
    expect(
      resolveRequestOrigin("https://presto.app", "127.0.0.1.evil.com")
    ).toBe("https://presto.app")
    expect(
      resolveRequestOrigin("https://presto.app", "localhost.evil.com")
    ).toBe("https://presto.app")
  })

  it("falls back to nextUrl's origin when there is no Host header", () => {
    expect(resolveRequestOrigin("https://presto.app", null)).toBe(
      "https://presto.app"
    )
  })
})
