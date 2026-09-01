import { Warning } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Shared error-message design for the writing-style/reference modals: a
// danger Warning icon (dist-md gap) beside bold danger text. Used both for
// UploadDropzone's own inline "file rejected" message and for the modals'
// own Type/URL save-failure message, so the two read as the same kind of
// error wherever they show up. `className` is for callers that need to
// nudge the spacing above it (e.g. pulling it closer to the field it's
// reporting on) — see the modals' own usage.
function FieldError({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-dist-md", className)}>
      {/* Top-aligned rather than centred on the whole block, so a message that
          wraps to two lines doesn't leave the icon floating between them. The
          wrapper takes the text's own line-height token so the icon still sits
          optically centred on the *first* line — a hardcoded top offset would
          be an invented spacing value. */}
      <span className="flex h-[var(--text-body-lg-bold--line-height)] shrink-0 items-center">
        <Warning weight="bold" className="size-4 text-icon-danger" />
      </span>
      <p className="text-body-lg-bold text-text-danger">{message}</p>
    </div>
  )
}

export { FieldError }
