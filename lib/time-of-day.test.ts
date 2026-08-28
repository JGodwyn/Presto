import { describe, expect, it } from "vitest"

import {
  DEFAULT_TIME,
  atTimeOfDay,
  formatClockTime,
  formatTime12,
  formatTime24,
  from24Hour,
  parseTime24,
  to24Hour,
  type TimeOfDay,
} from "@/lib/time-of-day"

const AM = (hour: number, minute = 0): TimeOfDay => ({
  hour,
  minute,
  meridiem: "AM",
})
const PM = (hour: number, minute = 0): TimeOfDay => ({
  hour,
  minute,
  meridiem: "PM",
})

describe("to24Hour", () => {
  it("converts the ordinary cases", () => {
    expect(to24Hour(AM(9)).hours).toBe(9)
    expect(to24Hour(PM(7, 3)).hours).toBe(19)
    expect(to24Hour(PM(7, 3)).minutes).toBe(3)
  })

  // The pair `hour + 12` gets wrong in both directions, and the only reason
  // this isn't a one-liner.
  it("puts 12 AM at midnight and 12 PM at noon", () => {
    expect(to24Hour(AM(12)).hours).toBe(0)
    expect(to24Hour(PM(12)).hours).toBe(12)
  })
})

describe("from24Hour", () => {
  it("reads midnight and noon back as 12", () => {
    expect(from24Hour(0, 0)).toEqual(AM(12))
    expect(from24Hour(12, 0)).toEqual(PM(12))
  })

  it("round-trips every minute of the day", () => {
    for (let hours = 0; hours < 24; hours++) {
      for (const minutes of [0, 1, 30, 59]) {
        const back = to24Hour(from24Hour(hours, minutes))
        expect(back).toEqual({ hours, minutes })
      }
    }
  })
})

describe("formatTime24 / parseTime24", () => {
  it("writes a zero-padded 24-hour string", () => {
    expect(formatTime24(AM(9))).toBe("09:00")
    expect(formatTime24(AM(12, 5))).toBe("00:05")
    expect(formatTime24(PM(12))).toBe("12:00")
    expect(formatTime24(PM(11, 59))).toBe("23:59")
  })

  it("round-trips through storage", () => {
    for (const time of [AM(9), AM(12), PM(12), PM(7, 3), PM(11, 59)]) {
      expect(parseTime24(formatTime24(time))).toEqual(time)
    }
  })

  // A stored value can be anything — an older shape, a hand-edited key, a
  // half-written string. None of it should become a bogus time.
  it("rejects anything that isn't a real time", () => {
    for (const bad of ["", "24:00", "12:60", "abc", "09:00:00", "-1:00", "9:0"]) {
      expect(parseTime24(bad)).toBeNull()
    }
  })

  // Reading is deliberately looser than writing: formatTime24 always pads the
  // hour, but an unpadded one is still an unambiguous 24-hour time, and
  // refusing it would throw away a perfectly good stored value.
  it("accepts an unpadded hour", () => {
    expect(parseTime24("9:00")).toEqual(AM(9))
  })
})

describe("formatTime12", () => {
  it("pads the minute but not the hour", () => {
    expect(formatTime12(AM(9))).toBe("9:00 AM")
    expect(formatTime12(PM(12, 5))).toBe("12:05 PM")
  })
})

describe("atTimeOfDay", () => {
  it("keeps the calendar day and replaces the time", () => {
    const day = new Date(2026, 8, 15) // local midnight, Sept 15 2026
    const at = atTimeOfDay(day, PM(7, 3))
    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(8)
    expect(at.getDate()).toBe(15)
    expect(at.getHours()).toBe(19)
    expect(at.getMinutes()).toBe(3)
    expect(at.getSeconds()).toBe(0)
  })

  // The whole point of the feature: a date that used to be local midnight
  // now carries the picked hour instead.
  it("moves a midnight date off midnight", () => {
    const day = new Date(2026, 8, 15)
    expect(day.getHours()).toBe(0)
    expect(atTimeOfDay(day, AM(9)).getHours()).toBe(9)
  })

  it("is idempotent — restamping the same time changes nothing", () => {
    const day = new Date(2026, 8, 15)
    const once = atTimeOfDay(day, PM(7, 3))
    expect(atTimeOfDay(once, PM(7, 3)).getTime()).toBe(once.getTime())
  })

  it("defaults to 9:00 AM", () => {
    expect(atTimeOfDay(new Date(2026, 8, 15), DEFAULT_TIME).getHours()).toBe(9)
  })
})

describe("formatClockTime", () => {
  it("drops the minutes on the hour and keeps them otherwise", () => {
    expect(formatClockTime(new Date(2026, 8, 15, 10, 0))).toBe("10 AM")
    expect(formatClockTime(new Date(2026, 8, 15, 22, 45))).toBe("10:45 PM")
    expect(formatClockTime(new Date(2026, 8, 15, 9, 5))).toBe("9:05 AM")
  })

  // The two a post generated before this feature, or scheduled for noon,
  // will actually hit.
  it("names midnight and noon", () => {
    expect(formatClockTime(new Date(2026, 8, 15, 0, 0))).toBe("12 AM")
    expect(formatClockTime(new Date(2026, 8, 15, 12, 0))).toBe("12 PM")
  })
})
