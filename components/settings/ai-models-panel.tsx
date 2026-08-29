"use client"

import * as React from "react"

import { deleteUserAiModel } from "@/app/projects/[projectId]/settings/model-actions"
import { Toast } from "@/components/ui/toast"
import { ToastSlot } from "@/components/shared/toast-slot"
import { withNetworkStatus } from "@/lib/network-status"
import { AddModelModal } from "@/components/settings/add-model-modal"
import { AiModelEntry } from "@/components/settings/ai-model-entry"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import type { UserAiModel } from "@/types/ai-model"

// Ascending by createdAt — the order models were added in, which is also the
// order the initial server fetch returns them. Only needed after a failed
// delete puts one back; appends already go to the end.
function sortByCreatedAt(models: UserAiModel[]) {
  return [...models].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// The body of Profile's expanded "AI models" row (Figma
// "profilescreenexpanded"): the description, then the entries, then a
// full-width "Add a model" button.
//
// This was `AiModelsCard`, which wrapped the same content in InstructionsCard
// and moved the trigger into that shell's header once entries existed. The
// export's disclosure header has no room for a second control beside the
// caret, so the button stays put at the foot and the list grows above it —
// one obvious CTA in both states, and it matches the export exactly when
// empty. Add/delete behaviour is unchanged: append from the action's own
// return value with no re-fetch, and an optimistic delete per AGENTS.md.
export function AiModelsPanel({
  projectId,
  initial,
}: {
  projectId?: string
  initial: UserAiModel[]
}) {
  const [models, setModels] = React.useState(initial)
  // Split from the toast's own open/close lifecycle so the message doesn't
  // blank out mid-exit-animation.
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")

  const handleAdded = (model: UserAiModel) => {
    setModels((prev) => [...prev, model])
  }

  // Optimistic per AGENTS.md's feedback convention: the row disappears on the
  // click, and only comes back — with a danger Toast — if the delete fails.
  const handleDelete = (model: UserAiModel) => {
    setModels((prev) => prev.filter((m) => m.id !== model.id))

    void withNetworkStatus(deleteUserAiModel({ projectId, id: model.id })).then(
      (result) => {
        if (result === null) {
          setModels((prev) => sortByCreatedAt([...prev, model]))
          return
        }
        if ("error" in result) {
          setModels((prev) => sortByCreatedAt([...prev, model]))
          setToastMessage("Couldn't remove that model")
          setToastOpen(true)
        }
      }
    )
  }

  return (
    <>
      {/* Portalled out of this card: the card carries a squircle clip-path,
          which would otherwise both position and crop this fixed toast to the
          card itself — see components/shared/toast-slot.tsx. */}
      <ToastSlot>
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="danger"
          direction="top"
        >
          {toastMessage}
        </Toast>
      </ToastSlot>

      <div className="flex flex-col gap-dist-md">
        <p className="text-body-lg text-text-bold">
          Add a model with your own API key. Presto generates on your account,
          so you keep control of the cost.
        </p>

        {models.map((model) => (
          // Enter-only mount-in (CSS @starting-style, no JS) — removal is
          // instant, matching writing-style-card.tsx: an exit fade leaves the
          // row on screen for its whole duration, which reads as a delay
          // before the gap closes.
          <div
            key={model.id}
            className="flex flex-col gap-dist-md transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]"
          >
            <DottedDivider />
            <AiModelEntry model={model} onDelete={() => handleDelete(model)} />
          </div>
        ))}

        <AddModelModal projectId={projectId} onAdded={handleAdded} block />
      </div>
    </>
  )
}
