// Hands the calendar-based tab's actual per-post dates from GenerateCard to
// GeneratingView across the navigation to /generate/generating — the two
// live in different route components, and there's no wired-up backend yet
// for the generating page to otherwise learn "which specific dates did the
// user pick." sessionStorage (not the URL) because a calendar-based batch
// can run to hundreds of dates (e.g. several full months); serializing that
// many ISO strings into a query string risks real URL-length limits that a
// small sessionStorage payload doesn't.
//
// Number-based generation has no dates to hand off at all — GenerateCard
// clears this key on every click regardless of mode, so a stale calendar
// selection from an earlier generate can never leak into a later
// number-based one.
const STORAGE_KEY = "presto:generate:scheduled-dates"

function writeScheduledDates(dates: Date[]) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(dates.map((date) => date.toISOString()))
  )
}

function clearScheduledDates() {
  sessionStorage.removeItem(STORAGE_KEY)
}

// Guarded for SSR (typeof window) since this can run inside a lazy useState
// initializer, which executes during the server render pass too, where
// sessionStorage doesn't exist.
function readScheduledDates(): Date[] | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const isoDates = JSON.parse(raw) as string[]
    return isoDates.map((iso) => new Date(iso))
  } catch {
    return null
  }
}

export { writeScheduledDates, clearScheduledDates, readScheduledDates }
