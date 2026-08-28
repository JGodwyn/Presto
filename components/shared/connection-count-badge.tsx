import { cn } from "@/lib/utils"

// The "n connection(s) active" pill, from the Figma "Connection - connected"
// export. Shared by the Connections screen (as its EmptyState caption) and the
// Profile screen, which shows the same pill under the user's name — one
// component so the two can't drift.
//
// Fully rounded (rad-rd), so it deliberately skips the squircle clip for the
// same reason toast.tsx does — corner smoothing needs a straight edge to blend
// into, and there isn't one.
//
// **It counts live connections, not rows.** The Expired frame still shows the
// green "1 connection active" pill over a red "Connection expired" strip,
// which is a leftover from duplicating the connected frame — an expired token
// is precisely what Presto *can't* use. At zero the pill keeps its shape and
// drops to the subtle palette rather than disappearing, so the page doesn't
// reflow between states.
function ConnectionCountBadge({ count }: { count: number }) {
  const none = count === 0

  return (
    <span
      className={cn(
        "inline-flex items-center gap-dist-sm rounded-full px-pad-sm py-pad-2xs text-body-md-bold",
        none
          ? "bg-surface-2 text-text-subtle"
          : "bg-surface-success-light text-text-success"
      )}
    >
      {/* The export's 12px dot is a 3px *inside* stroke over a solid fill, so
          it reads as a ring: border-success-focused outside, surface-success
          in the middle. 3px is the one value here with no stroke token
          (foundations.json stops at 2px) — it's the export's literal weight. */}
      <span
        className={cn(
          "size-3 shrink-0 rounded-full border-[3px]",
          none
            ? "border-border-bold bg-icon-subtle"
            : "border-border-success-focused bg-surface-success"
        )}
      />
      {none
        ? "No connections active"
        : `${count} ${count === 1 ? "connection" : "connections"} active`}
    </span>
  )
}

export { ConnectionCountBadge }
