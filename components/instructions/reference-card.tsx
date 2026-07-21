"use client"

import * as React from "react"

import { deleteReference } from "@/app/projects/[projectId]/instructions/reference-actions"
import { Toast } from "@/components/ui/toast"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import { ReferenceEntry } from "@/components/instructions/reference-entry"
import { ReferenceModal } from "@/components/instructions/reference-modal"
import type { ContentReference } from "@/types/content-reference"

// Ascending by createdAt — the order entries were added in, which is also
// the order the initial server fetch returns them. Only needed after a
// failed delete puts an entry back; every other mutation already preserves
// order (appends go to the end, edits don't move anything).
function sortByCreatedAt(references: ContentReference[]) {
  return [...references].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// Mirrors components/instructions/writing-style-card.tsx exactly — the
// "References" card works the same way My writing style does: empty state
// is the labeled "Add a reference" CTA; once entries exist, the CTA
// collapses to the header's compact "+" and each entry renders with its own
// divider above it. New entries are appended to local state directly from
// the modal's return value — no re-fetch needed.
function ReferenceCard({
  projectId,
  initial,
  className,
}: {
  projectId: string
  initial: ContentReference[]
  className?: string
}) {
  const [references, setReferences] = React.useState(initial)
  // Split from the toast's own open/close lifecycle so the message doesn't
  // blank out mid-exit-animation — see Toast's `mounted` stays true for
  // EXIT_DURATION after `open` flips false, and would render whatever
  // `children` is at that instant.
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")
  const hasReferences = references.length > 0

  const showError = (message: string) => {
    setToastMessage(message)
    setToastOpen(true)
  }

  const handleAdded = (reference: ContentReference) => {
    setReferences((prev) => [...prev, reference])
  }

  // Optimistic: the item disappears the instant the trash icon is clicked,
  // and the delete happens in the background — per AGENTS.md's feedback
  // convention. Only on failure does it reappear, alongside a danger Toast.
  const handleDelete = (reference: ContentReference) => {
    setReferences((prev) => prev.filter((r) => r.id !== reference.id))

    void deleteReference({ projectId, id: reference.id }).then((result) => {
      if ("error" in result) {
        setReferences((prev) => sortByCreatedAt([...prev, reference]))
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
        title="References"
        description="Give Presto material to draw ideas and context from when generating posts."
        headerAction={
          hasReferences ? (
            <ReferenceModal
              projectId={projectId}
              onAdded={handleAdded}
              compact
            />
          ) : null
        }
        className={className}
      >
        {hasReferences ? (
          references.map((reference) => (
            // Enter-only mount-in (CSS @starting-style, no JS) — removal is
            // instant, on purpose: see writing-style-card.tsx's identical
            // comment (same fix, same root cause as the topic chips).
            <div
              key={reference.id}
              // flex flex-col gap-dist-lg: matches InstructionsCard's own
              // gap so the divider-to-entry spacing inside this wrapper is
              // identical to the old Fragment version — see
              // writing-style-card.tsx's identical comment.
              className="flex flex-col gap-dist-lg transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]"
            >
              <DottedDivider />
              <ReferenceEntry
                reference={reference}
                onDelete={() => handleDelete(reference)}
                onSaveFailed={handleSaveFailed}
              />
            </div>
          ))
        ) : (
          <>
            <DottedDivider />
            <ReferenceModal projectId={projectId} onAdded={handleAdded} />
          </>
        )}
      </InstructionsCard>
    </>
  )
}

export { ReferenceCard }
