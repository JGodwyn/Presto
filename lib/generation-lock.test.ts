import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getGenerationLock,
  getGenerationLockServerSnapshot,
  setGenerationLock,
  subscribeToGenerationLock,
} from "@/lib/generation-lock"

// The store is module state, so every test has to hand it back unlocked.
afterEach(() => setGenerationLock(false))

describe("generation lock", () => {
  it("starts unlocked, on the client and on the server", () => {
    expect(getGenerationLock()).toBe(false)
    expect(getGenerationLockServerSnapshot()).toBe(false)
  })

  it("notifies subscribers when the lock changes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToGenerationLock(listener)

    setGenerationLock(true)
    expect(getGenerationLock()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    setGenerationLock(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it("says nothing when the value hasn't actually changed", () => {
    // The writer is an effect keyed on the run's status, and a generating view
    // that re-runs it (Stop → Resume → Stop) would otherwise re-render both
    // pieces of chrome for a value they already hold.
    const listener = vi.fn()
    const unsubscribe = subscribeToGenerationLock(listener)

    setGenerationLock(true)
    setGenerationLock(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it("stops notifying once unsubscribed", () => {
    const listener = vi.fn()
    subscribeToGenerationLock(listener)()

    setGenerationLock(true)
    expect(listener).not.toHaveBeenCalled()
  })
})
