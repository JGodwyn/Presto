import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getAvatarGradientOverride,
  getAvatarGradientOverrideServerSnapshot,
  getAvatarOverride,
  getAvatarOverrideServerSnapshot,
  getAvatarPhotoCleared,
  getAvatarPhotoClearedServerSnapshot,
  setAvatarGradientOverride,
  setAvatarOverride,
  subscribeToAvatar,
} from "@/lib/avatar-store"

// The store is module state, so every test has to hand it back empty. Setting
// the photo to null also raises `photoCleared`, which is itself part of the
// state under test — hence the explicit round-trip through a real URL first.
afterEach(() => {
  setAvatarOverride("reset")
  setAvatarOverride(null)
  setAvatarGradientOverride(null)
})

describe("avatar store", () => {
  it("starts empty, on the client and on the server", () => {
    expect(getAvatarOverrideServerSnapshot()).toBeNull()
    expect(getAvatarGradientOverrideServerSnapshot()).toBeNull()
    expect(getAvatarPhotoClearedServerSnapshot()).toBe(false)
  })

  it("notifies subscribers when the photo changes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAvatar(listener)

    setAvatarOverride("https://example.test/a.webp")
    expect(getAvatarOverride()).toBe("https://example.test/a.webp")
    expect(listener).toHaveBeenCalledTimes(1)

    // Setting the same value again is a no-op, so nothing re-renders.
    setAvatarOverride("https://example.test/a.webp")
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setAvatarOverride("https://example.test/b.webp")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("notifies subscribers when the gradient changes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAvatar(listener)

    setAvatarGradientOverride("lagoon")
    expect(getAvatarGradientOverride()).toBe("lagoon")
    expect(listener).toHaveBeenCalledTimes(1)

    setAvatarGradientOverride("lagoon")
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  // The bit that isn't obvious, and the reason this store isn't just two
  // nullable values: a `null` photo has to be distinguishable from "this tab
  // never touched the photo". Without that, picking a gradient — which clears
  // the photo — would fall back to the server's stale photo and the pick would
  // look ignored.
  describe("photoCleared", () => {
    // Deliberately no "false before anything is set" case here: the flag has
    // no reset in the public API — only setting a photo lowers it — so once
    // any test has cleared the photo, module state can't be handed back
    // pristine. That's not a gap in the store: in the app it starts false and
    // is only ever raised by a real clear, and the SSR contract that actually
    // matters is pinned by the server-snapshot test above.
    it("is true once the photo is explicitly cleared", () => {
      setAvatarOverride("https://example.test/a.webp")
      expect(getAvatarPhotoCleared()).toBe(false)

      setAvatarOverride(null)
      expect(getAvatarOverride()).toBeNull()
      expect(getAvatarPhotoCleared()).toBe(true)
    })

    it("notifies subscribers on the clear, not just on the set", () => {
      setAvatarOverride("https://example.test/a.webp")

      const listener = vi.fn()
      const unsubscribe = subscribeToAvatar(listener)

      // Both values are `null`-ish from the outside, but this is a real state
      // change — an early-return on `overrideUrl === url` alone would swallow
      // it and leave every avatar showing the old photo.
      setAvatarOverride(null)
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("goes back to false when a photo is set again", () => {
      setAvatarOverride("https://example.test/a.webp")
      setAvatarOverride(null)
      expect(getAvatarPhotoCleared()).toBe(true)

      setAvatarOverride("https://example.test/b.webp")
      expect(getAvatarPhotoCleared()).toBe(false)
    })
  })
})
