import { describe, expect, it } from "vitest"

import {
  accountSkipReason,
  dueWindow,
  isDueNow,
  partitionSchedulableAccounts,
  PUBLISH_GRACE_MINUTES,
  PUBLISH_TICK_MINUTES,
  skipReason,
  type SchedulableAccount,
} from "@/lib/publish-due"
import { PUBLISHABLE_PLATFORMS } from "@/lib/post-publish"
import { hasXPublishScope } from "@/lib/x/scopes"

const NOW = new Date("2026-09-02T12:00:00Z")

function minutesFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString()
}

describe("isDueNow", () => {
  it("sends a post whose moment has just passed", () => {
    expect(isDueNow(minutesFromNow(-1), NOW)).toBe(true)
  })

  it("does not send a post whose moment hasn't come", () => {
    expect(isDueNow(minutesFromNow(1), NOW)).toBe(false)
    expect(isDueNow(minutesFromNow(60 * 24), NOW)).toBe(false)
  })

  // The rule the user asked for, and the reason the whole module exists: 60
  // posts were already past their date when this was written, the oldest by two
  // months. None of them may ever be sent by a tick.
  it("never sends the backlog, however far past it is", () => {
    expect(isDueNow(minutesFromNow(-60), NOW)).toBe(false)
    expect(isDueNow(minutesFromNow(-60 * 24), NOW)).toBe(false)
    expect(isDueNow("2026-06-30T23:00:00Z", NOW)).toBe(false)
  })

  // The grace window is a fixed 15 minutes, independent of how often the job
  // runs — long enough to ride out a deploy, short enough that whatever it
  // sends is still recognisably the post that was scheduled.
  it("rides out a short outage and then gives up", () => {
    expect(isDueNow(minutesFromNow(-(PUBLISH_GRACE_MINUTES - 1)), NOW)).toBe(true)
    expect(isDueNow(minutesFromNow(-PUBLISH_GRACE_MINUTES), NOW)).toBe(true)
    expect(isDueNow(minutesFromNow(-(PUBLISH_GRACE_MINUTES + 1)), NOW)).toBe(false)
  })

  it("ignores a post with no date at all — a draft is not scheduled", () => {
    expect(isDueNow(null, NOW)).toBe(false)
  })

  it("treats an unparseable date as not due rather than as now", () => {
    expect(isDueNow("not a date", NOW)).toBe(false)
  })
})

describe("the two constants", () => {
  // They used to be one: grace was `tick * 3`, so changing the cadence silently
  // changed the safety margin. Pinned apart so that can't happen again.
  it("keeps grace independent of the tick", () => {
    expect(PUBLISH_GRACE_MINUTES).toBe(15)
    expect(PUBLISH_GRACE_MINUTES % PUBLISH_TICK_MINUTES === 0).toBe(true)
    expect(PUBLISH_GRACE_MINUTES).toBeGreaterThan(PUBLISH_TICK_MINUTES)
  })
})

describe("dueWindow", () => {
  it("spans the grace period back from now", () => {
    const window = dueWindow(NOW)
    expect(window.to).toBe(NOW.toISOString())
    expect(Date.parse(window.to) - Date.parse(window.from)).toBe(
      PUBLISH_GRACE_MINUTES * 60_000
    )
  })
})

describe("skipReason", () => {
  it("separates the future from the backlog", () => {
    expect(skipReason(minutesFromNow(30), NOW)).toBe("not_yet")
    expect(skipReason(minutesFromNow(-60 * 24), NOW)).toBe("too_old")
  })

  it("has nothing to say about a post it would send", () => {
    expect(skipReason(minutesFromNow(-1), NOW)).toBeNull()
  })
})

// The connection-level half: which accounts a tick may send *through*. Posts
// behind a broken connection are never selected, rather than each being marked
// "Didn't send" — see the note in lib/publish-due.ts for the decision.
function connection(
  overrides: Partial<SchedulableAccount> = {}
): SchedulableAccount {
  return {
    projectId: "project-1",
    platform: "linkedin",
    scope: "email,openid,profile,w_member_social",
    expiresAt: new Date("2026-11-01T00:00:00Z").toISOString(),
    status: "active",
    ...overrides,
  }
}

describe("accountSkipReason", () => {
  // The scheduler and the send used to ask different questions: this gated on
  // `isGrantStale` (every requested scope, `email` included) while the send is
  // authorised by `hasPublishScope` (only `w_member_social`). So an account
  // that published perfectly well by hand was excluded from the scheduler
  // forever, with nothing to reconnect that would fix it.
  it("schedules an account that can publish but is missing an unrelated scope", () => {
    expect(
      accountSkipReason(connection({ scope: "openid,w_member_social" }), NOW)
    ).toBeNull()
  })

  it("still skips an account that cannot publish at all", () => {
    expect(
      accountSkipReason(connection({ scope: "email,openid,profile" }), NOW)
    ).toBe("scope_not_granted")
  })

  it("passes a healthy, current, unexpired LinkedIn connection", () => {
    expect(accountSkipReason(connection(), NOW)).toBeNull()
  })

  // The state that produced FOLLOWUPS §17: every connection made before
  // w_member_social was requested. Its posts refused at the gate every tick,
  // recorded nothing, and — being oldest — filled the whole batch limit.
  it("skips a grant that predates a scope the app now requests", () => {
    expect(
      accountSkipReason(connection({ scope: "email,openid,profile" }), NOW)
    ).toBe("scope_not_granted")
  })

  it("skips a lapsed token", () => {
    expect(
      accountSkipReason(
        connection({ expiresAt: new Date("2026-09-01T00:00:00Z").toISOString() }),
        NOW
      )
    ).toBe("token_expired")
  })

  // "We don't know when this dies" reads as "assume it has": the alternative
  // is a NaN comparison, which is false, which would let it through.
  it("treats an unparseable expiry as expired", () => {
    expect(accountSkipReason(connection({ expiresAt: "not a date" }), NOW)).toBe(
      "token_expired"
    )
  })

  // Revocation outranks the rest: it is the one state waiting cannot fix, and
  // an unexpired revoked token would otherwise pass both other checks.
  it("skips a revoked connection even while its token is current", () => {
    expect(accountSkipReason(connection({ status: "revoked" }), NOW)).toBe(
      "revoked"
    )
  })

  // LinkedIn's scope list means nothing to an X row, so asking `grantIsCurrent`
  // of one is false forever. If that leaked in here, every X connection would
  // be excluded from the scheduler permanently, with no reconnect able to
  // clear it. The platform check inside `canSendOnPlatform` is what prevents it.
  //
  // **This test is coupled to X having no publisher, and is meant to be.** Add
  // `x` to PUBLISHABLE_PLATFORMS and it fails — correctly, because an X grant
  // without `tweet.write` then *should* be skipped. That failure is the arm
  // engaging, not a regression: update this case rather than widening the
  // predicate to keep it green.
  it("does not call an X connection's grant stale", () => {
    expect(
      accountSkipReason(
        connection({ platform: "x", scope: "users.read tweet.read offline.access" }),
        NOW
      )
    ).toBeNull()
  })

  // **Why that passes, and what would make it stop.** X has no publisher —
  // it is absent from PUBLISHABLE_PLATFORMS — so there is no publish scope to
  // require and nothing to skip the account for. The predicate reads that
  // registry rather than the platform's name, which is the whole point: the
  // old `platform !== "linkedin"` form was safe only because of a condition in
  // a *different* file (the cron's own `.eq("platform", "linkedin")`), so
  // relaxing that query — the one change standing between X and a live
  // scheduler — would have silently turned this into a fail-open.
  //
  // Asserted through the registry rather than restated, so the day X is added
  // to it this reads correctly instead of pinning a stale answer.
  it("only waives the scope check for platforms with no publisher", () => {
    for (const platform of ["linkedin", "x"] as const) {
      const publishable = PUBLISHABLE_PLATFORMS.includes(platform)
      const withoutPublishScope = accountSkipReason(
        connection({ platform, scope: "" }),
        NOW
      )

      // A platform that can publish must refuse a grant with no publish scope;
      // one that cannot has nothing to refuse it for.
      expect(withoutPublishScope).toBe(
        publishable ? "scope_not_granted" : null
      )
    }
  })

  // The map behind it is complete by type (`Record<PostPlatform, …>`), so a new
  // platform cannot reach the scheduler without declaring what its send needs.
  // This pins the answer for the platform that would otherwise be waived: were
  // X added to PUBLISHABLE_PLATFORMS tomorrow, the arm is already correct.
  it("knows what an X send would require, before X can send", () => {
    expect(hasXPublishScope("users.read tweet.read offline.access")).toBe(false)
    expect(hasXPublishScope("users.read tweet.write")).toBe(true)
  })
})

describe("partitionSchedulableAccounts", () => {
  it("splits the healthy from the broken and reports why", () => {
    const healthy = connection({ projectId: "healthy" })
    const stale = connection({ projectId: "stale", scope: "email,openid,profile" })
    const { eligibleProjectIds, skipped } = partitionSchedulableAccounts(
      [stale, healthy],
      NOW
    )

    expect(eligibleProjectIds).toEqual(["healthy"])
    expect(skipped).toEqual([{ account: stale, reason: "scope_not_granted" }])
  })

  // What the cron does with an empty list matters: `.in("project_id", [])` can
  // only return nothing, so the due query is skipped outright.
  it("returns no eligible projects when every connection is broken", () => {
    const { eligibleProjectIds, skipped } = partitionSchedulableAccounts(
      [connection({ status: "revoked" }), connection({ scope: "openid" })],
      NOW
    )
    expect(eligibleProjectIds).toEqual([])
    expect(skipped).toHaveLength(2)
  })
})
