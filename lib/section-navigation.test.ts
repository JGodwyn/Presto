import { afterEach, describe, expect, it } from "vitest"

import {
  endSectionNavigation,
  getSectionNavigation,
  reportSectionLoadingBoundary,
  startSectionNavigation,
  subscribeToSectionNavigation,
} from "./section-navigation"

// The store is module-level state, so leave it clean for the next test.
afterEach(() => {
  endSectionNavigation()
  reportSectionLoadingBoundary(false)
})

describe("startSectionNavigation", () => {
  it("arms a plain (delayed) navigation from a settled page", () => {
    startSectionNavigation("/projects/1/instructions")
    expect(getSectionNavigation()).toEqual({
      href: "/projects/1/instructions",
      instant: false,
    })
  })

  it("is a no-op when re-armed with the same href", () => {
    startSectionNavigation("/projects/1/instructions")
    const first = getSectionNavigation()
    startSectionNavigation("/projects/1/instructions")
    expect(getSectionNavigation()).toBe(first)
  })

  it("arms instantly when a previous navigation never arrived", () => {
    startSectionNavigation("/projects/1/instructions")
    startSectionNavigation("/projects/1/generate")
    expect(getSectionNavigation()).toEqual({
      href: "/projects/1/generate",
      instant: true,
    })
  })

  it("arms instantly while the route's loading fallback is mounted", () => {
    reportSectionLoadingBoundary(true)
    startSectionNavigation("/projects/1/generate")
    expect(getSectionNavigation()?.instant).toBe(true)
  })

  it("goes back to a delayed arm once the fallback has unmounted", () => {
    reportSectionLoadingBoundary(true)
    reportSectionLoadingBoundary(false)
    startSectionNavigation("/projects/1/generate")
    expect(getSectionNavigation()?.instant).toBe(false)
  })

  it("notifies subscribers on arm and on end, and end clears the target", () => {
    let calls = 0
    const unsubscribe = subscribeToSectionNavigation(() => {
      calls += 1
    })
    startSectionNavigation("/projects/1/calendar")
    endSectionNavigation()
    expect(calls).toBe(2)
    expect(getSectionNavigation()).toBeNull()
    // Ending with nothing armed must not emit — SectionContent calls this
    // freely (arrival effect, unmount cleanup) without checking first.
    endSectionNavigation()
    expect(calls).toBe(2)
    unsubscribe()
  })
})
