import { isGrantStale } from "@/lib/social-scopes"

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

// ---------------------------------------------------------------------------
// Which *connections* the scheduler may send through.
//
// **The rule: skip accounts, not posts** (the decision behind FOLLOWUPS §17).
// A connection whose grant predates `w_member_social`, whose token has lapsed,
// or which the member revoked at the provider's end cannot publish anything —
// and every post behind it refuses identically, every tick, recording nothing.
// Being the oldest rows in the window they then fill the whole
// `PUBLISH_BATCH_LIMIT` and starve newer posts on healthy connections.
//
// The alternative was to mark each refused post "Didn't send". That blames the
// post for the connection's problem: the text is fine, the schedule is fine,
// and re-dating every one of them would fix nothing. So the *connection* is
// excluded instead and its posts wait quietly — the Connections page already
// says the grant is stale and prompts a reconnect, and they go out on the next
// tick after it is fixed, provided they are still inside the grace window.
//
// **The cost, stated plainly:** a connection nobody fixes hides its posts
// indefinitely, and each of them ages out of the grace window and becomes
// permanently overdue without ever wearing a failure. That is why the run
// summary reports the skipped connections by name rather than only the sends —
// a scheduler quietly doing nothing must not look the same as one with nothing
// to do.

// What the eligibility question needs to know about a stored connection. The
// same three fields `checkPublishGate` reads, plus the revocation flag it has
// no way to see (only a real call to the provider discovers that, which is
// what `social_accounts.status` records).
export interface SchedulableAccount {
  projectId: string
  platform: string
  scope: string
  expiresAt: string
  status: string
}

// Why a connection was passed over, for the run summary. These mirror
// `PublishFailure`'s own refusal codes — deliberately, since they are the
// same three refusals, asked one layer earlier so the posts behind them are
// never selected in the first place.
export type AccountSkipReason = "scope_not_granted" | "token_expired" | "revoked"

// `isGrantStale` rather than `grantIsCurrent`, and the difference matters:
// the platform check is inside it. LinkedIn's scope list means nothing to an X
// row, and asking it there is false for every X account that will ever exist
// (see lib/linkedin/scopes.ts) — which would exclude every X connection from
// the scheduler permanently, with a reconnect that could never clear it.
export function accountSkipReason(
  account: SchedulableAccount,
  now: Date
): AccountSkipReason | null {
  // Checked first: a revoked grant is dead whatever else is true of it, and
  // it is the one state waiting cannot resolve.
  if (account.status === "revoked") return "revoked"
  if (isGrantStale(account.platform, account.scope)) return "scope_not_granted"

  const expiresAt = Date.parse(account.expiresAt)
  // An unparseable expiry is treated as expired rather than ignored: the safe
  // reading of "we don't know when this dies" is "assume it has".
  if (Number.isNaN(expiresAt) || expiresAt <= now.getTime()) {
    return "token_expired"
  }

  return null
}

export interface AccountPartition<T> {
  // The projects whose connection can actually send. The due query is scoped
  // to these, so nothing behind a broken connection is ever selected.
  eligibleProjectIds: string[]
  skipped: { account: T; reason: AccountSkipReason }[]
}

// Splits the connections one tick found into the ones it may publish through
// and the ones it must report. Generic over the row shape so the cron can hand
// over whatever it selected without mapping first.
export function partitionSchedulableAccounts<T extends SchedulableAccount>(
  accounts: T[],
  now: Date
): AccountPartition<T> {
  const eligibleProjectIds: string[] = []
  const skipped: { account: T; reason: AccountSkipReason }[] = []

  for (const account of accounts) {
    const reason = accountSkipReason(account, now)
    if (reason) skipped.push({ account, reason })
    else eligibleProjectIds.push(account.projectId)
  }

  return { eligibleProjectIds, skipped }
}
