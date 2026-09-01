// "1st", "2nd", "3rd", "4th"… — the 11/12/13 exception is the whole reason
// this isn't a one-liner: they take "th" despite ending in 1/2/3.
export function formatOrdinal(day: number): string {
  const lastTwo = day % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

// Spelled out rather than taken from `toLocaleDateString({ month: "short" })`:
// that gives "Sep", and the short form this app wants is "Sept".
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
]

// **The year is dropped when it is the current one** — "Aug 29" this year,
// "Aug 29, 2027" in any other. Per direct request, and it is what keeps a date
// short enough to sit beside a time on a 272px card. Nothing is lost: a date
// with no year *means* this year, the same way a diary entry does.
//
// `now` is a parameter rather than a `new Date()` read inside, following
// formatExpiry above and the Content page's own `now` prop: a server and the
// browser hydrating it must agree on which year is current, and they only do
// if one clock decides. It defaults for the call sites that have no `now` to
// hand — the window where that could disagree is the last minutes of a year,
// and the cost is one re-render showing a year that then vanishes.
function yearSuffix(date: Date, now: Date): string {
  return date.getFullYear() === now.getFullYear() ? "" : `, ${date.getFullYear()}`
}




// "Aug 29" / "Aug 29, 2027" — **the app's one date format**, per direct
// request that these read the same everywhere. There used to be a long-month
// twin of this (`formatFullDate`) for the roomier surfaces; having two shapes
// was the whole problem, so there is now one function and every caller takes
// it.
//
// **No ordinal**, and deliberately unlike the bare day numbers `formatOrdinal`
// still serves: "the 29th" is how a day on its own is read — which is what the
// Content page's day chips show — but a date that also names its month does
// not need one.
export function formatDate(date: Date, now: Date = new Date()): string {
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}${yearSuffix(date, now)}`
}

// A date range, dropping the year only where it can't be misread — which is
// the whole answer to "what about December 24 to January 15?".
//
//   both ends this year   → "Dec 24 – Dec 31"
//   both ends 2027        → "Dec 24 – Dec 31, 2027"   (year once)
//   ends in *different*   → "Dec 24, 2026 – Jan 15, 2027"
//     years                 (both years, always, whatever `now` is)
//
// A range that crosses a year boundary is precisely the case where hiding the
// year makes it read backwards — "Dec 24 – Jan 15" looks like it ends
// three weeks before it starts. So the rule isn't "drop the current year", it
// is "drop the year when both ends agree on it and it's the current one";
// spanning two years overrides that even when one of them is current.
export function formatDateRange(
  from: Date,
  to: Date | undefined,
  now: Date = new Date()
): string {
  const monthDay = (date: Date) =>
    `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`

  if (!to) return formatDate(from, now)

  if (from.getFullYear() !== to.getFullYear()) {
    return `${monthDay(from)}, ${from.getFullYear()} – ${monthDay(to)}, ${to.getFullYear()}`
  }

  // Same year on both ends, so it only ever needs saying once — at the end,
  // where it covers the whole range. formatDate drops it if it's this year.
  return `${monthDay(from)} – ${formatDate(to, now)}`
}

const MS_PER_DAY = 86_400_000

// "Expires in 60 days" — the connected-account line on the Connections page.
// `now` is passed in rather than read here so a caller rendering on both the
// server and the client can stamp it once and have the two agree (same reason
// the Content page passes its own `now` down).
//
// Rounds to nearest, with a floor of one day. Rounding *up* looks right until
// the two timestamps come from different clocks: a 60-day token stamped a few
// seconds after the "now" it's measured against has 60-and-a-bit days left and
// reads as 61. The floor is what keeps the last few hours from counting down
// to "0 days" on something that hasn't expired yet.
export function formatExpiry(expiresAt: Date, now: Date): string {
  const remaining = expiresAt.getTime() - now.getTime()
  if (remaining <= 0) return "Expired"

  const days = Math.max(1, Math.round(remaining / MS_PER_DAY))
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`
}

// How close to expiry a connection starts asking to be renewed. The Figma
// "ExpiringSoon" frame draws the warning state at "Expires in 7 days", and 7
// is also a sensible window on its own: renewing inside it is a silent
// redirect (LinkedIn skips the consent screen while the current token is
// still alive), so the warning exists to catch people *before* the cliff.
export const EXPIRY_WARNING_DAYS = 7

export type ExpiryStatus = "active" | "expiring" | "expired"

// Which of the three connected-row treatments a token is in — green and quiet,
// amber with a Renew prompt, or red and dead. Shares formatExpiry's rounding
// so the label and the colour can never disagree: a row reading "Expires in 7
// days" is always the warning one.
export function expiryStatus(expiresAt: Date, now: Date): ExpiryStatus {
  const remaining = expiresAt.getTime() - now.getTime()
  if (remaining <= 0) return "expired"

  const days = Math.max(1, Math.round(remaining / MS_PER_DAY))
  return days <= EXPIRY_WARNING_DAYS ? "expiring" : "active"
}

// The four treatments a connected row can be in, once *both* ways a connection
// can die are folded together. `expiryStatus` above answers only the first.
export type ConnectionStatus = ExpiryStatus | "revoked"

// Which treatment a connection is in.
//
// Two independent things can kill it, and only one is computable from a date:
// the 60-day token lapses (expiresAt), or the member revokes Presto's access
// from LinkedIn's own settings, which nothing here is told about and only a
// real call can discover (see verifyLinkedInToken).
//
// **Expiry is checked first**, deliberately. A token that has both lapsed and
// been revoked is most usefully described as expired: that is the reason the
// reader expects, it is true regardless of whether any check has run, and both
// states lead to the same Reconnect action anyway. Revocation is the answer
// only when the date alone wouldn't have told them anything was wrong — which
// is exactly the case this whole column exists for.
export function connectionStatus(
  expiresAt: Date,
  revoked: boolean,
  now: Date
): ConnectionStatus {
  const expiry = expiryStatus(expiresAt, now)
  if (expiry === "expired") return "expired"
  if (revoked) return "revoked"
  return expiry
}

// Whether a connection is dead — the two states that get the red treatment and
// a Reconnect. One predicate so callers can't drift on which states count.
export function isConnectionDead(status: ConnectionStatus): boolean {
  return status === "expired" || status === "revoked"
}
