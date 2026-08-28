// The time half of a scheduled post. `posts.scheduled_for` has always been a
// timestamptz, so the database could hold a time from day one — every writer
// just pinned it to local midnight (Calendar hands back local midnight, and
// the Generate page's month/range walks build their dates the same way).
// This is what the Generate page now sets instead.
//
// Kept out of lib/format-date.ts deliberately: that file is a declared hot
// file (AGENTS.md — two live branches editing one is a guaranteed conflict),
// and none of this is a *format* so much as the value itself.

export type Meridiem = "AM" | "PM"

// 12-hour wall-clock time, exactly what the field lets you type: hour 1-12,
// minute 0-59, and which half of the day. Deliberately *not* a Date — the
// Generate page applies one time to many dates, so the time has to exist
// independently of any of them.
export interface TimeOfDay {
  hour: number
  minute: number
  meridiem: Meridiem
}

// 9:00 AM, the value both time exports were captured at
// (design-sync/calendar-with-time-daily, -monthly).
export const DEFAULT_TIME: TimeOfDay = { hour: 9, minute: 0, meridiem: "AM" }

// 12-hour → 24-hour. 12 AM is midnight (0) and 12 PM is noon (12) — the one
// pair a naive `hour + 12` gets wrong, and in both directions.
export function to24Hour({ hour, minute, meridiem }: TimeOfDay): {
  hours: number
  minutes: number
} {
  const base = hour % 12
  return { hours: meridiem === "PM" ? base + 12 : base, minutes: minute }
}

export function from24Hour(hours: number, minutes: number): TimeOfDay {
  return {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: minutes,
    meridiem: hours >= 12 ? "PM" : "AM",
  }
}

// "09:00" — the 24-hour form used for persistence
// (lib/generate-settings.ts's stored shape). Round-trippable and
// timezone-free, unlike the "YYYY-MM-DD" dates stored beside it, which have
// to dodge UTC day-shift; a local Date is only ever built at the moment a
// specific day is being scheduled.
export function formatTime24({ hour, minute, meridiem }: TimeOfDay): string {
  const { hours, minutes } = to24Hour({ hour, minute, meridiem })
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function parseTime24(value: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return from24Hour(hours, minutes)
}

// "9:00 AM" — the field's own value said out loud, for its accessible name.
export function formatTime12({ hour, minute, meridiem }: TimeOfDay): string {
  return `${hour}:${String(minute).padStart(2, "0")} ${meridiem}`
}

// Stamps a time of day onto a calendar day, keeping the day's own local
// year/month/date. Built through the local Date constructor rather than by
// adding milliseconds: the offset between two calendar days isn't a constant
// number of hours across a DST boundary, and the day the user picked is what
// has to survive.
export function atTimeOfDay(date: Date, time: TimeOfDay): Date {
  const { hours, minutes } = to24Hour(time)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes
  )
}

// "10:45 PM", "9 AM" — a stored moment's time half, for the places that show a
// post's schedule. The minutes are dropped on the hour, which is both how the
// time is said out loud and what makes it fit: a post card's metadata row has
// about 196px, and "12:00 AM" beside the account pill overran it on its own.
// Most posts land on the hour, since a batch picks one time for every date.
//
// Reads the *local* clock, the same reading lib/content-grouping.ts groups by:
// the time was picked in the user's own timezone, so only a local read gives
// back the hour they chose.
export function formatClockTime(date: Date): string {
  const time = from24Hour(date.getHours(), date.getMinutes())
  if (time.minute === 0) return `${time.hour} ${time.meridiem}`
  return formatTime12(time)
}
