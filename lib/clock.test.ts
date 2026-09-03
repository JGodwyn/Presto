import { afterEach, describe, expect, it, vi } from "vitest"

import { getClock, getServerClock, subscribeToClock } from "@/lib/clock"

afterEach(() => {
  vi.useRealTimers()
})

describe("the shared clock", () => {
  // The contract useSyncExternalStore depends on: a snapshot that changed
  // identity on every call would re-render forever.
  it("returns a stable snapshot between ticks", () => {
    expect(getClock()).toBe(getClock())
  })

  it("never reports a real time on the server", () => {
    // A server render must not depend on when it ran — and 0 is what makes
    // "is this moment past?" answer no for every real date.
    expect(getServerClock()).toBe(0)
  })

  it("advances subscribers on the tick and stops when the last one leaves", () => {
    vi.useFakeTimers()
    const clearInterval = vi.spyOn(globalThis, "clearInterval")

    const notified = vi.fn()
    const unsubscribe = subscribeToClock(notified)
    const before = getClock()

    vi.advanceTimersByTime(60_000)

    expect(notified).toHaveBeenCalledTimes(1)
    expect(getClock()).toBeGreaterThan(before)

    // The interval is torn down with the last listener, so a page with no
    // markers on it isn't paying for a timer.
    unsubscribe()
    expect(clearInterval).toHaveBeenCalled()

    vi.advanceTimersByTime(60_000)
    expect(notified).toHaveBeenCalledTimes(1)
  })

  it("runs one timer for many subscribers", () => {
    vi.useFakeTimers()
    const setInterval = vi.spyOn(globalThis, "setInterval")

    const unsubscribeA = subscribeToClock(vi.fn())
    const unsubscribeB = subscribeToClock(vi.fn())

    expect(setInterval).toHaveBeenCalledTimes(1)

    unsubscribeA()
    unsubscribeB()
  })
})
