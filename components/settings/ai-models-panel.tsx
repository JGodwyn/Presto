"use client"

import * as React from "react"
import { Trash } from "@phosphor-icons/react"

import { deleteUserAiModel } from "@/app/projects/[projectId]/settings/model-actions"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import { Toast } from "@/components/ui/toast"
import { ToastSlot } from "@/components/shared/toast-slot"
import { withNetworkStatus } from "@/lib/network-status"
import { AddModelModal } from "@/components/settings/add-model-modal"
import { AiModelEntry } from "@/components/settings/ai-model-entry"
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

  // Holds the row awaiting confirmation. The delete itself stays optimistic
  // (AGENTS.md's feedback convention) — the modal gates *starting* it, it
  // doesn't turn the delete into a wait-for-the-server operation.
  const [pendingDelete, setPendingDelete] = React.useState<UserAiModel | null>(null)

  // rad-md (8px) from the export, as px for the squircle path math.
  const { ref: listRef, style: listStyle } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: 8,
  })

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
          Add your API key to generate on your own account and control your costs.
        </p>

        {models.length > 0 ? (
          // One bordered surface-2 tray holding every model, per the Figma
          // "ProfileScreenRedesign" export. The rows are surface-3 with a 2px
          // gap, so the tray's own colour showing through *is* the separator —
          // which is why the DottedDivider that used to sit between entries is
          // gone.
          //
          // max-h rather than the export's fixed 152px height: at three rows
          // the export deliberately clips the third mid-line to signal there's
          // more, and max-h reproduces that exactly while letting one or two
          // rows hug instead of leaving a band of empty tray beneath them.
          // Native scrollbar hidden per AGENTS.md; no custom thumb, because at
          // this width it would sit on top of the delete buttons — the same
          // call made for the page-level <main>. The half-visible row is the
          // scroll affordance.
          <div
            ref={listRef}
            style={listStyle}
            className={cn(
              "flex max-h-38 flex-col gap-dist-xs overflow-y-auto rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-2",
              HIDE_NATIVE_SCROLLBAR_CLASSNAME
            )}
          >
            {models.map((model) => (
              // Enter-only mount-in (CSS @starting-style, no JS) — removal is
              // instant, matching writing-style-card.tsx: an exit fade leaves
              // the row on screen for its whole duration, which reads as a
              // delay before the gap closes.
              <div
                key={model.id}
                className="transition-[opacity,filter,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]"
              >
                <AiModelEntry model={model} onDelete={() => setPendingDelete(model)} />
              </div>
            ))}
          </div>
        ) : null}

        <AddModelModal projectId={projectId} onAdded={handleAdded} block />
      </div>

      <ConfirmationModal
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        icon={<Trash weight="bold" className="size-12 text-icon-minimal" />}
        title="Delete this model"
        // Names the real consequence: the key is the thing being destroyed,
        // and Presto genuinely cannot show it again, so re-adding means
        // fetching a fresh one from the provider.
        description="Presto will forget this API key. You'll need to paste it again to use this model."
        actionLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
