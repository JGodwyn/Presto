"use client"

import * as React from "react"

import { deleteUserAiModel } from "@/app/projects/[projectId]/connections/model-actions"
import { Toast } from "@/components/ui/toast"
import { AddModelModal } from "@/components/connections/add-model-modal"
import { AiModelEntry } from "@/components/connections/ai-model-entry"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import type { UserAiModel } from "@/types/ai-model"

// Ascending by createdAt — the order models were added in, which is also the
// order the initial server fetch returns them. Only needed after a failed
// delete puts one back; appends already go to the end.
function sortByCreatedAt(models: UserAiModel[]) {
  return [...models].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// Structurally a copy of components/instructions/writing-style-card.tsx —
// same empty-state-CTA-becomes-header-"+" swap, same append-from-the-action's
// return value with no re-fetch, same optimistic delete. InstructionsCard is
// reused as-is rather than copied: despite the name it's a generic card
// shell, and a fourth near-identical one would only drift.
function AiModelsCard({
  projectId,
  initial,
  className,
}: {
  projectId: string
  initial: UserAiModel[]
  className?: string
}) {
  const [models, setModels] = React.useState(initial)
  // Split from the toast's own open/close lifecycle so the message doesn't
  // blank out mid-exit-animation.
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")
  const hasModels = models.length > 0

  const handleAdded = (model: UserAiModel) => {
    setModels((prev) => [...prev, model])
  }

  // Optimistic per AGENTS.md's feedback convention: the row disappears on the
  // click, and only comes back — with a danger Toast — if the delete fails.
  const handleDelete = (model: UserAiModel) => {
    setModels((prev) => prev.filter((m) => m.id !== model.id))

    void deleteUserAiModel({ projectId, id: model.id }).then((result) => {
      if ("error" in result) {
        setModels((prev) => sortByCreatedAt([...prev, model]))
        setToastMessage("Couldn't remove that model")
        setToastOpen(true)
      }
    })
  }

  return (
    <>
      {/* Same fixed top-center slot as the create-project/My-voice toasts. */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast open={toastOpen} onOpenChange={setToastOpen} variant="danger" direction="top">
          {toastMessage}
        </Toast>
      </div>

      <InstructionsCard
        title="AI models"
        description="Add a model with your own API key. Presto generates on your account, so you keep control of the cost."
        headerAction={
          hasModels ? (
            <AddModelModal projectId={projectId} onAdded={handleAdded} compact />
          ) : null
        }
        className={className}
      >
        {hasModels ? (
          models.map((model) => (
            // Enter-only mount-in (CSS @starting-style, no JS) — removal is
            // instant, matching writing-style-card.tsx: an exit fade leaves
            // the row on screen for its whole duration, which reads as a
            // delay before the gap closes.
            <div
              key={model.id}
              // gap-dist-lg matches InstructionsCard's own gap, so wrapping
              // the divider and entry together doesn't flush them against
              // each other.
              className="flex flex-col gap-dist-lg transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]"
            >
              <DottedDivider />
              <AiModelEntry model={model} onDelete={() => handleDelete(model)} />
            </div>
          ))
        ) : (
          <>
            <DottedDivider />
            <AddModelModal projectId={projectId} onAdded={handleAdded} />
          </>
        )}
      </InstructionsCard>
    </>
  )
}

export { AiModelsCard }
