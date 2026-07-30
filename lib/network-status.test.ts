import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getNetworkOffline,
  reportNetworkIssue,
  reportNetworkReachable,
  subscribeToNetworkStatus,
  withNetworkStatus,
} from "@/lib/network-status"

beforeEach(() => {
  reportNetworkReachable()
})

describe("withNetworkStatus", () => {
  it("passes a successful result straight through", async () => {
    await expect(withNetworkStatus(Promise.resolve({ ok: true }))).resolves.toEqual({
      ok: true,
    })
    expect(getNetworkOffline()).toBe(false)
  })

  it("returns null and flags offline when the request never landed", async () => {
    const result = await withNetworkStatus(
      Promise.reject(new TypeError("Failed to fetch"))
    )
    expect(result).toBeNull()
    expect(getNetworkOffline()).toBe(true)
  })

  it("rethrows anything that isn't a connectivity failure", async () => {
    // Server actions signal redirects by throwing; swallowing those would
    // break every action that ends in redirect().
    await expect(
      withNetworkStatus(Promise.reject(new Error("NEXT_REDIRECT")))
    ).rejects.toThrow("NEXT_REDIRECT")
    expect(getNetworkOffline()).toBe(false)
  })

  // A successful action means our own server answered, which is not the same
  // as the connection being back — in development localhost answers with the
  // wifi off. So the flag is only cleared by a probe that actually reaches the
  // backend, and a success just triggers one.
  it("clears the flag when a success is confirmed by a reachable backend", async () => {
    reportNetworkIssue()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)))

    await withNetworkStatus(Promise.resolve({ ok: true }))

    await vi.waitFor(() => expect(getNetworkOffline()).toBe(false))
    vi.unstubAllGlobals()
  })

  it("keeps the flag up when a success can't be confirmed", async () => {
    reportNetworkIssue()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )

    await withNetworkStatus(Promise.resolve({ ok: true }))

    // Give the fire-and-forget probe a turn of the loop to settle.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(getNetworkOffline()).toBe(true)
    vi.unstubAllGlobals()
  })

  it("notifies subscribers on each transition, and only on transitions", async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToNetworkStatus(listener)

    reportNetworkIssue()
    reportNetworkIssue()
    expect(listener).toHaveBeenCalledTimes(1)

    reportNetworkReachable()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    reportNetworkIssue()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
