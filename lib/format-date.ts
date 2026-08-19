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

// "July 5th, 2026" — the app's one long-date format, shared by the post cards
// and the Content page so a day never reads as "5th" in one place and "5" in
// another. Built by hand rather than through toLocaleDateString because
// Intl has no ordinal-day format; the month and year still come from it.
export function formatFullDate(date: Date): string {
  const month = date.toLocaleDateString("en-US", { month: "long" })
  return `${month} ${formatOrdinal(date.getDate())}, ${date.getFullYear()}`
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

// "Sept 5th, 2026" — the same date on a card that has one line to spare for
// it. Only the month shortens; the ordinal and year are what make it a date
// rather than a label.
export function formatShortDate(date: Date): string {
  return `${SHORT_MONTHS[date.getMonth()]} ${formatOrdinal(date.getDate())}, ${date.getFullYear()}`
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
