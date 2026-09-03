import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { encryptApiKey } from "@/lib/ai/key-crypto"
import { getLiveXAccessToken } from "@/lib/x/token"

// A stand-in for the two-and-a-bit Supabase calls this module makes, holding a
// single social_accounts row in memory. It is deliberately not a general fake:
// it implements exactly the query shapes token.ts uses, so a change to those
// shapes shows up as a broken test rather than passing against a mock that
// accepts anything.
//
// The one piece with real behaviour is the claim's conditional update, which is
// what these tests exist to exercise.
const CLAIM_TIMEOUT_MS = 30 * 1000

type Row = Record<string, unknown>

function makeSupabase(
  row: Row | null,
  options: { updateFails?: boolean; onRead?: (state: { row: Row | null }) => void } = {}
) {
  const state = { row: row ? { ...row } : null }
  const updates: Row[] = []

  const client = {
    state,
    updates,
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => {
                      options.onRead?.(state)
                      return { data: state.row, error: null }
                    },
                  }
                },
              }
            },
          }
        },
        update(values: Row) {
          updates.push(values)

          // The claim path: .update().eq().or().select()
          const withOr = {
            or(filter: string) {
              return {
                select: async () => {
                  if (!state.row) return { data: [], error: null }

                  // `refresh_started_at.is.null,refresh_started_at.lt.<iso>`
                  const staleBefore = new Date(
                    filter.split("refresh_started_at.lt.")[1]
                  ).getTime()
                  const held = state.row.refresh_started_at as string | null
                  const claimable =
                    !held || new Date(held).getTime() < staleBefore

                  if (!claimable) return { data: [], error: null }

                  state.row = { ...state.row, ...values }
                  return { data: [{ id: "account" }], error: null }
                },
              }
            },
            // The plain write path: .update().eq()
            then(resolve: (value: { error: unknown }) => void) {
              if (options.updateFails) {
                resolve({ error: { message: "write failed" } })
                return
              }
              if (state.row) state.row = { ...state.row, ...values }
              resolve({ error: null })
            },
          }

          return { eq: () => withOr }
        },
      }
    },
  }

  return client as unknown as Parameters<typeof getLiveXAccessToken>[0] & {
    state: { row: Row | null }
    updates: Row[]
  }
}

const NOW = 1_700_000_000_000

function activeRow(overrides: Row = {}): Row {
  return {
    encrypted_access_token: encryptApiKey("stored-access"),
    encrypted_refresh_token: encryptApiKey("stored-refresh"),
    // Comfortably fresh.
    expires_at: new Date(NOW + 60 * 60 * 1000).toISOString(),
    status: "active",
    refresh_started_at: null,
    ...overrides,
  }
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.X_CLIENT_ID = "client-id"
  process.env.X_CLIENT_SECRET = "client-secret"
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

function tokenResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("getLiveXAccessToken", () => {
  it("returns the stored token without spending a refresh when it is fresh", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const supabase = makeSupabase(activeRow())

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    expect(result).toEqual({ ok: true, accessToken: "stored-access" })
    // The point of the margin check: no round trip, no rotation, no risk.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refreshes a token inside the expiry margin, though it has not expired", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        tokenResponse({
          access_token: "fresh-access",
          refresh_token: "rotated-refresh",
          expires_in: 7200,
        })
      )
    )
    // Two minutes left — still valid, but not enough to outlive the call it
    // would be fetched for.
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW + 2 * 60 * 1000).toISOString() })
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    expect(result).toEqual({ ok: true, accessToken: "fresh-access" })
  })

  it("persists the rotated refresh token, which is the one that must not be lost", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        tokenResponse({
          access_token: "fresh-access",
          refresh_token: "rotated-refresh",
          expires_in: 7200,
        })
      )
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    await getLiveXAccessToken(supabase, "account", NOW)

    const stored = supabase.state.row!
    const { decryptApiKey } = await import("@/lib/ai/key-crypto")
    expect(decryptApiKey(stored.encrypted_refresh_token as string)).toBe(
      "rotated-refresh"
    )
    expect(decryptApiKey(stored.encrypted_access_token as string)).toBe(
      "fresh-access"
    )
    // A successful refresh is itself the liveness proof — no read spent.
    expect(stored.status).toBe("active")
    expect(stored.last_checked_at).toBeTruthy()
    // And the claim is handed back.
    expect(stored.refresh_started_at).toBeNull()
  })

  it("writes the new token before handing it out", async () => {
    const order: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        order.push("refresh")
        return Promise.resolve(
          tokenResponse({
            access_token: "fresh-access",
            refresh_token: "rotated-refresh",
            expires_in: 7200,
          })
        )
      })
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )
    const originalFrom = supabase.from.bind(supabase)
    supabase.from = ((...args: unknown[]) => {
      const table = originalFrom(...(args as [string]))
      const originalUpdate = table.update.bind(table)
      table.update = (values: Row) => {
        if ("encrypted_access_token" in values) order.push("persist")
        return originalUpdate(values)
      }
      return table
    }) as typeof supabase.from

    const result = await getLiveXAccessToken(supabase, "account", NOW)
    order.push("returned")

    expect(result.ok).toBe(true)
    expect(order).toEqual(["refresh", "persist", "returned"])
  })

  it("marks the row revoked when X rejects the grant, and clears the dead token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(tokenResponse({ error: "invalid_request" }, 400))
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    expect(result).toEqual({ ok: false, failure: "revoked" })
    expect(supabase.state.row!.status).toBe("revoked")
    expect(supabase.state.row!.encrypted_refresh_token).toBeNull()
    expect(supabase.state.row!.refresh_started_at).toBeNull()
  })

  it("leaves a working connection alone when X is merely unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(tokenResponse({ error: "over capacity" }, 503))
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    // Fails open: a 5xx is "couldn't tell", not "revoked".
    expect(result).toEqual({ ok: false, failure: "unavailable" })
    expect(supabase.state.row!.status).toBe("active")
    // The token it could not spend is still there for the next attempt.
    expect(supabase.state.row!.encrypted_refresh_token).toBeTruthy()
    expect(supabase.state.row!.refresh_started_at).toBeNull()
  })

  it("treats a rate-limited refresh as unavailable, never as revocation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(tokenResponse({ error: "rate limited" }, 429))
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    expect(result).toEqual({ ok: false, failure: "unavailable" })
    expect(supabase.state.row!.status).toBe("active")
  })

  it("waits out the request holding the claim and uses what it stored", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    // Claimed a moment ago by another request. On the second read that request
    // has finished: the claim is released and a fresh token is in the row —
    // which is how the winner communicates its result, no lock needed.
    let reads = 0
    const supabase = makeSupabase(
      activeRow({
        expires_at: new Date(NOW - 1000).toISOString(),
        refresh_started_at: new Date(NOW - 1000).toISOString(),
      }),
      {
        onRead: (state) => {
          reads += 1
          if (reads > 1 && state.row) {
            state.row = {
              ...state.row,
              refresh_started_at: null,
              encrypted_access_token: encryptApiKey("winners-access"),
              expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
            }
          }
        },
      }
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    expect(result).toEqual({ ok: true, accessToken: "winners-access" })
    // The whole hazard this guards: two requests must never both call X with
    // the same single-use token.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("takes over a claim left behind by a request that died", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        tokenResponse({
          access_token: "fresh-access",
          refresh_token: "rotated-refresh",
          expires_in: 7200,
        })
      )
    )
    const supabase = makeSupabase(
      activeRow({
        expires_at: new Date(NOW - 1000).toISOString(),
        refresh_started_at: new Date(
          NOW - CLAIM_TIMEOUT_MS - 1000
        ).toISOString(),
      })
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    // A crashed request must not wedge the connection forever.
    expect(result).toEqual({ ok: true, accessToken: "fresh-access" })
  })

  it("reports a failed write as unavailable rather than returning an orphaned token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        tokenResponse({
          access_token: "fresh-access",
          refresh_token: "rotated-refresh",
          expires_in: 7200,
        })
      )
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() }),
      { updateFails: true }
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    // The rotation happened at X but didn't land here — handing the token out
    // would hide a connection that is already unrecoverable.
    expect(result).toEqual({ ok: false, failure: "unavailable" })
  })

  it("reports a missing row as not connected", async () => {
    const supabase = makeSupabase(null)

    expect(await getLiveXAccessToken(supabase, "account", NOW)).toEqual({
      ok: false,
      failure: "not_connected",
    })
  })

  it("short-circuits a row already known to be revoked", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const supabase = makeSupabase(
      activeRow({ status: "revoked", expires_at: new Date(NOW - 1000).toISOString() })
    )

    expect(await getLiveXAccessToken(supabase, "account", NOW)).toEqual({
      ok: false,
      failure: "revoked",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reports missing credentials as config, not as a dead connection", async () => {
    delete process.env.X_CLIENT_ID
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    expect(await getLiveXAccessToken(supabase, "account", NOW)).toEqual({
      ok: false,
      failure: "config",
    })
    expect(supabase.state.row!.status).toBe("active")
  })

  it("cannot renew a connection stored without a refresh token", async () => {
    const supabase = makeSupabase(
      activeRow({
        encrypted_refresh_token: null,
        expires_at: new Date(NOW - 1000).toISOString(),
      })
    )

    expect(await getLiveXAccessToken(supabase, "account", NOW)).toEqual({
      ok: false,
      failure: "revoked",
    })
  })
})

describe("the refresh claim is always handed back", () => {
  it("releases it when the stored refresh token cannot be decrypted", async () => {
    // The path the review caught: an early return from inside the claimed
    // region that skipped releaseClaim. A rotated MODEL_KEY_ENCRYPTION_KEY
    // reaches it, and the account was then wedged forever — every later request
    // found a claim nothing would release and timed out in waitForOtherRefresh.
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const supabase = makeSupabase(
      activeRow({
        expires_at: new Date(NOW - 1000).toISOString(),
        encrypted_refresh_token: "v1.not.valid.ciphertext",
      })
    )

    const result = await getLiveXAccessToken(supabase, "account", NOW)

    expect(result).toEqual({ ok: false, failure: "unavailable" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(supabase.state.row!.refresh_started_at).toBeNull()
  })

  it("releases it when X is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    expect(await getLiveXAccessToken(supabase, "account", NOW)).toEqual({
      ok: false,
      failure: "unavailable",
    })
    expect(supabase.state.row!.refresh_started_at).toBeNull()
  })

  it("releases it even when something throws mid-refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        throw new RangeError("something unexpected")
      })
    )
    const supabase = makeSupabase(
      activeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    )

    // Whatever this does with the error, the claim must not survive it.
    await getLiveXAccessToken(supabase, "account", NOW).catch(() => undefined)

    expect(supabase.state.row!.refresh_started_at).toBeNull()
  })
})
