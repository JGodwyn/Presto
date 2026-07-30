import { describe, expect, it } from "vitest"
import { isNetworkError } from "@/lib/network-error"

// The whole point of this predicate is telling "the request never landed"
// apart from "the server said no" — getting it wrong in either direction is
// user-visible (a dropped connection reported as a wrong password, or a real
// rejection silently swallowed as an outage), so both directions are pinned
// down here.
describe("isNetworkError", () => {
  it("recognizes the browser's failed fetch", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true)
  })

  it("recognizes Node/undici's failed fetch", () => {
    expect(isNetworkError(new TypeError("fetch failed"))).toBe(true)
  })

  it("unwraps undici's cause chain, where the real reason hides", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND db.supabase.co"), {
        code: "ENOTFOUND",
      }),
    })
    expect(isNetworkError(error)).toBe(true)
  })

  it("recognizes Supabase's retryable fetch error by name", () => {
    const error = new Error("Network request failed")
    error.name = "AuthRetryableFetchError"
    expect(isNetworkError(error)).toBe(true)
  })

  it("recognizes an error that never got an HTTP response (status 0)", () => {
    expect(isNetworkError({ message: "", status: 0 })).toBe(true)
  })

  it("does not treat a deliberate abort as a connectivity problem", () => {
    const error = new Error("The operation was aborted")
    error.name = "AbortError"
    expect(isNetworkError(error)).toBe(false)
  })

  it("does not treat a rejected credential as a connectivity problem", () => {
    // The exact shape Supabase returns for a wrong password — this is the
    // case that used to get misreported.
    expect(
      isNetworkError({ message: "Invalid login credentials", status: 400 })
    ).toBe(false)
  })

  it("does not treat a server-side failure as a connectivity problem", () => {
    expect(isNetworkError(new Error("relation does not exist"))).toBe(false)
    expect(isNetworkError({ message: "Internal error", status: 500 })).toBe(false)
  })

  it("handles non-objects without throwing", () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
    expect(isNetworkError("fetch failed")).toBe(false)
  })
})
