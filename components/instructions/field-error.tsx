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
    <div className={cn("flex items-center gap-dist-md", className)}>
      <Warning weight="bold" className="size-4 shrink-0 text-icon-danger" />
      <p className="text-body-md-bold text-text-danger">{message}</p>
    </div>
  )
}

export { FieldError }
