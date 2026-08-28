"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { TimeField } from "@/components/ui/time-field"
import {
  DEFAULT_TIME,
  atTimeOfDay,
  from24Hour,
  type TimeOfDay,
} from "@/lib/time-of-day"

// How long a burst of time edits is collapsed into one write. Typing "1" then
// "2" for 12, or holding an arrow key, is several changes in a few hundred
// milliseconds, and each one would otherwise be its own fire-and-forget
// update of the same row — the exact out-of-order hazard AGENTS.md ships
// useSaveQueue for. One trailing write per burst removes it without a queue,
// since there is only ever one request in flight.
const TIME_COMMIT_DELAY_MS = 300

// The "Add to calendar" / "Change date" picker, shared by the generated-post
// card and the post-details page — the two rendered identical dialogs, and
// now that a time lives inside one there is real behaviour to keep in step.
//
// Two commit paths, because the two halves are not the same kind of control:
//
//   - **A date click commits and closes**, as it always has (per the direct
//     feedback that removed the Apply button). It carries whatever time is
//     showing.
//   - **The time writes through on its own**, debounced, for a post that
//     already has a day to attach it to. A draft has no day yet, so its time
//     is simply held until a date is picked.
//
// Cancel is therefore not a discard — it never was; it closes without picking
// a date. A pending time write is flushed on the way out for the same reason.
function DateTimePickerBody({
  date,
  onDateChange,
  onClose,
}: {
  date: Date | undefined
  onDateChange: (date: Date) => void
  onClose: () => void
}) {
  const [time, setTime] = React.useState<TimeOfDay>(() =>
    date ? from24Hour(date.getHours(), date.getMinutes()) : DEFAULT_TIME
  )

  // The debounce. Both refs are read only from a timer and from cleanup, and
  // `onDateChange` is kept in a ref of its own so the flush effect below can
  // stay mounted for the dialog's whole life rather than re-running (and
  // firing its cleanup) every time the parent hands down a new closure.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = React.useRef<Date | null>(null)
  const commitRef = React.useRef(onDateChange)
  React.useEffect(() => {
    commitRef.current = onDateChange
  })

  const flush = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending) commitRef.current(pending)
  }, [])

  // Closing — by Cancel, Escape, or a click outside — unmounts this, so the
  // cleanup is what guarantees a time changed a moment before the dialog
  // went away still lands.
  React.useEffect(() => flush, [flush])

  const handleTimeChange = (next: TimeOfDay) => {
    setTime(next)
    // Nothing to write for a draft: there's no day for the time to sit on.
    // It rides along with whichever date gets picked instead.
    if (!date) return
    pendingRef.current = atTimeOfDay(date, next)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, TIME_COMMIT_DELAY_MS)
  }

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={(newDate) => {
        if (newDate) {
          // Supersedes any debounced time write — this carries the same time
          // and a date besides, so letting the older one land afterwards
          // would put the post back on its previous day.
          if (timerRef.current !== null) clearTimeout(timerRef.current)
          timerRef.current = null
          pendingRef.current = null
          onDateChange(atTimeOfDay(newDate, time))
        }
        onClose()
      }}
      size="lg"
      showActionBar
      onCancel={onClose}
      footer={<TimeField value={time} onChange={handleTimeChange} />}
    />
  )
}

// Just the calendar (design-sync/calendarwithactionbar): no title, padding or
// card of the dialog's own, so Calendar's own card (border, shadow, p-pad-md)
// reads as the only chrome. showCloseButton off (Cancel already closes it);
// popupClassName clears the default w-80/padding/background so the Popup hugs
// Calendar's size="lg" footprint. clipContent off too — this wrapper's own
// clip-path would otherwise hard-cut Calendar's drop shadow at almost the
// same boundary it's meant to soften.
function DateTimePickerDialog({
  open,
  onOpenChange,
  date,
  onDateChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // undefined = a draft, with no date picked yet.
  date: Date | undefined
  onDateChange: (date: Date) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        clipContent={false}
        popupClassName="w-fit"
        className="gap-0 rounded-none bg-transparent p-0"
      >
        {/* Mounted only while open (Base UI renders the portal's contents
            lazily), which is what re-seeds the time from the post on every
            open rather than keeping the last session's value. */}
        <DateTimePickerBody
          date={date}
          onDateChange={onDateChange}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export { DateTimePickerDialog }
