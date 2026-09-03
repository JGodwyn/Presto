// Which scheduled posts the scheduler may send, and — far more importantly —
// which it must leave alone.
//
// **The rule, in the user's own words: don't publish anything overdue.** A post
// whose moment passed while nothing was running is not sent later; it keeps its
// Overdue marker until someone re-dates it or publishes it by hand. That is a
// deliberate refusal of the obvious behaviour, and the reason is arithmetic: at
// the time this was written there were 60 posts already past their date, the
// oldest by two months. A scheduler that simply published what was due would
// have put all 60 on a real timeline in one burst the moment it was armed.
//
// **But "not overdue" cannot mean "exactly now".** A tick sees a post some
// seconds or minutes after its moment, so a literal reading would publish
// nothing, ever. So there is a grace window: a post is due if its moment has
// passed *and* it passed recently. Anything older is the backlog, and the
// backlog is never touched.

// How often the cron is expected to fire. Not enforced here — the schedule
// lives in the database (pg_cron) — so this is documentation, and it must be
// changed together with the pg_cron entry.
//
// One minute, so a post scheduled for 09:00 goes out by 09:01. The cost of
// looking that often is one indexed query that returns nothing on almost every
// run; the alternative — firing a job per post at its exact time — needs a
// second source of truth that has to track every date change, draft toggle and
// delete, and its failure mode is "silently never sent" rather than "a few
// seconds late".
export const PUBLISH_TICK_MINUTES = 1

// How far back a tick will reach.
//
// **Deliberately not derived from the tick.** It was `tick * 3`, which quietly
// tied the safety margin to the cadence: dropping the tick from 5 minutes to 1
// would have shrunk this from 15 minutes to 3, and a four-minute deploy would
// then strand a post in the backlog permanently. The two numbers answer
// different questions — how precise, and how forgiving — so they are set
// independently.
//
// Fifteen minutes is long enough to ride out a deploy, a cold start or a brief
// database blip, and short enough that anything it sends is still recognisably
// the post that was scheduled rather than a surprise from the archive. Beyond
// it, a post is overdue permanently, by design: see the note at the top.
export const PUBLISH_GRACE_MINUTES = 15

// The most posts one tick will send. A cap on the blast radius of any mistake
// in the window arithmetic above: whatever goes wrong, it goes wrong five posts
// at a time, and a person has a minute to pull the switch before the next five.
// It also spaces a genuinely busy minute out rather than hammering LinkedIn's
// API — and the spreading is free, since 20 posts due at once still drain in
// four ticks, well inside the grace window above.
export const PUBLISH_BATCH_LIMIT = 5

export interface DueWindow {
  // Inclusive lower bound: the oldest moment still considered "just now".
  from: string
  // Inclusive upper bound: now. A post scheduled for the future is not due,
  // which is the whole point of scheduling it.
  to: string
}

export function dueWindow(
  now: Date,
  graceMinutes: number = PUBLISH_GRACE_MINUTES
): DueWindow {
  return {
    from: new Date(now.getTime() - graceMinutes * 60_000).toISOString(),
    to: now.toISOString(),
  }
}

// Whether a single post falls in the window. The cron's own query does this in
// SQL — this is the same rule expressed once more so it can be tested directly
// and read without a database, and so a caller can explain *why* a given post
// was skipped.
export function isDueNow(
  scheduledFor: string | null,
  now: Date,
  graceMinutes: number = PUBLISH_GRACE_MINUTES
): boolean {
  if (scheduledFor === null) return false

  const at = Date.parse(scheduledFor)
  if (Number.isNaN(at)) return false

  const window = dueWindow(now, graceMinutes)
  return at <= Date.parse(window.to) && at >= Date.parse(window.from)
}

// Why a scheduled post was not sent, for the run summary. "too_old" is the
// interesting one — it is the backlog rule doing its job, and a run reporting a
// lot of them means posts are being missed rather than protected.
export type SkipReason = "not_yet" | "too_old"

export function skipReason(
  scheduledFor: string | null,
  now: Date,
  graceMinutes: number = PUBLISH_GRACE_MINUTES
): SkipReason | null {
  if (scheduledFor === null) return null
  if (isDueNow(scheduledFor, now, graceMinutes)) return null

  return Date.parse(scheduledFor) > now.getTime() ? "not_yet" : "too_old"
}
