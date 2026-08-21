import { afterEach, describe, expect, it } from "vitest"

import {
  buildAuthorizationUrl,
  getLinkedInConfig,
  getLinkedInCredentials,
  LINKEDIN_CALLBACK_PATH,
} from "@/lib/linkedin/oauth"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("getLinkedInCredentials", () => {
  it("is null until both halves are configured", () => {
    delete process.env.LINKEDIN_CLIENT_ID
    delete process.env.LINKEDIN_CLIENT_SECRET
    expect(getLinkedInCredentials()).toBeNull()

    process.env.LINKEDIN_CLIENT_ID = "client-id"
    expect(getLinkedInCredentials()).toBeNull()

    process.env.LINKEDIN_CLIENT_SECRET = "client-secret"
    expect(getLinkedInCredentials()).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
    })
  })
})

describe("getLinkedInConfig", () => {
  it("derives the redirect URI from the request's own origin", () => {
    process.env.LINKEDIN_CLIENT_ID = "client-id"
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret"
    delete process.env.LINKEDIN_REDIRECT_URI

    expect(getLinkedInConfig("http://localhost:3001")?.redirectUri).toBe(
      `http://localhost:3001${LINKEDIN_CALLBACK_PATH}`
    )
  })

  it("lets LINKEDIN_REDIRECT_URI win, for a proxied origin", () => {
    process.env.LINKEDIN_CLIENT_ID = "client-id"
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret"
    process.env.LINKEDIN_REDIRECT_URI = "https://presto.app/custom/callback"

    expect(getLinkedInConfig("http://internal:3000")?.redirectUri).toBe(
      "https://presto.app/custom/callback"
    )
  })
})

describe("buildAuthorizationUrl", () => {
  const config = {
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://localhost:3001/api/connections/linkedin/callback",
  }

  it("asks for sign-in scopes only", () => {
    const url = new URL(buildAuthorizationUrl(config, "state-value"))

    // The guard on AGENTS.md's hard publishing constraint: w_member_social is
    // what would let this app post to a live account, and it must not appear
    // in an authorization request until publishing is explicitly green-lit.
    expect(url.searchParams.get("scope")).toBe("openid profile email")
    expect(url.searchParams.get("scope")).not.toContain("w_member_social")
  })

  it("carries the code flow's required params", () => {
    const url = new URL(buildAuthorizationUrl(config, "state-value"))

    expect(url.origin + url.pathname).toBe(
      "https://www.linkedin.com/oauth/v2/authorization"
    )
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe("client-id")
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri)
    expect(url.searchParams.get("state")).toBe("state-value")
  })

  it("never puts the client secret in the URL", () => {
    expect(buildAuthorizationUrl(config, "state-value")).not.toContain(
      "client-secret"
    )
  })
})
