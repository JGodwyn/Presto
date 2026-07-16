"use client"

import * as React from "react"

import { deleteWritingStyle } from "@/app/projects/[projectId]/instructions/writing-style-actions"
import { Toast } from "@/components/ui/toast"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import { WritingStyleEntry } from "@/components/instructions/writing-style-entry"
import { WritingStyleModal } from "@/components/instructions/writing-style-modal"
import type { WritingStyle } from "@/types/writing-style"

// Ascending by createdAt — the order entries were added in, which is also
// the order the initial server fetch returns them. Only needed after a
// failed delete puts an entry back; every other mutation already preserves
// order (appends go to the end, edits don't move anything).
function sortByCreatedAt(styles: WritingStyle[]) {
  return [...styles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// The "My writing style" card: empty state is the labeled "Add a style" CTA
// (Figma "Instructions" export); once styles exist, the CTA collapses to the
// header's compact "+" and each entry renders with its own divider above it
// (Figma "My writing style (Content added)" export). New entries are appended
// to local state directly from the modal's return value — no re-fetch needed,
// same pattern as MyVoiceCard's topics.
function WritingStyleCard({
  projectId,
  initial,
  className,
}: {
  projectId: string
  initial: WritingStyle[]
  className?: string
}) {
  const [styles, setStyles] = React.useState(initial)
  // Split from the toast's own open/close lifecycle so the message doesn't
  // blank out mid-exit-animation — see Toast's `mounted` stays true for
  // EXIT_DURATION after `open` flips false, and would render whatever
  // `children` is at that instant.
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")
  const hasStyles = styles.length > 0

  const showError = (message: string) => {
    setToastMessage(message)
    setToastOpen(true)
  }

  const handleAdded = (style: WritingStyle) => {
    setStyles((prev) => [...prev, style])
  }

  // Optimistic: the item disappears the instant the trash icon is clicked,
  // and the delete happens in the background — per AGENTS.md's feedback
  // convention. Only on failure does it reappear, alongside a danger Toast.
  const handleDelete = (style: WritingStyle) => {
    setStyles((prev) => prev.filter((s) => s.id !== style.id))

    void deleteWritingStyle({ projectId, id: style.id }).then((result) => {
      if ("error" in result) {
        setStyles((prev) => sortByCreatedAt([...prev, style]))
        showError("Couldn't delete that item")
      }
    })
  }

  const handleSaveFailed = () => {
    showError("Couldn't save your changes")
  }

  return (
    <>
      {/* Same fixed top-center slot as the create-project/My-voice toasts. */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="danger"
          direction="top"
        >
          {toastMessage}
        </Toast>
      </div>

      <InstructionsCard
        title="My writing style"
        description="Show Presto real examples of writing you want your posts to sound like."
        headerAction={
          hasStyles ? (
            <WritingStyleModal
              projectId={projectId}
              onAdded={handleAdded}
              compact
            />
          ) : null
        }
        className={className}
      >
        {hasStyles ? (
          styles.map((style) => (
            <React.Fragment key={style.id}>
              <DottedDivider />
              <WritingStyleEntry
                style={style}
                onDelete={() => handleDelete(style)}
                onSaveFailed={handleSaveFailed}
              />
            </React.Fragment>
          ))
        ) : (
          <>
            <DottedDivider />
            <WritingStyleModal projectId={projectId} onAdded={handleAdded} />
          </>
        )}
      </InstructionsCard>
    </>
  )
}

export { WritingStyleCard }
