"use client"

import { Trash, Warning } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { providerDisplayName } from "@/lib/ai/provider-names"
import type { UserAiModel } from "@/types/ai-model"

// The trash affordance's own radius (rad-sm) as px for the squircle path math.
const DELETE_CORNER_RADIUS = 4

// One saved model, as a single row in the shared list — per the Figma
// "ProfileScreenRedesign" export. The row itself is square-cornered
// (rad-null): AiModelsPanel's list container owns the rounding and clips it,
// and the 2px gaps between rows are the container's own surface-2 showing
// through, which is what draws the separators. There is no divider element.
function AiModelEntry({ model, onDelete }: { model: UserAiModel; onDelete: () => void }) {
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: DELETE_CORNER_RADIUS,
  })

  return (
    <div className="flex items-start gap-dist-md bg-surface-3 px-pad-sm py-pad-xs">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-body-lg text-text-bold">{model.label}</p>
        {/* The key itself never leaves the server — key_last_four is stored as
            its own column precisely so this line has something to show. */}
        {/* One template string rather than JSX text around expressions: with
            the literal split across lines, JSX dropped the space before "key"
            and rendered "Anthropickey ending". */}
        <p className="truncate text-body-md text-text-subtle">
          {`${providerDisplayName(model.providerSlug)} key ending ***${model.keyLastFour}`}
        </p>

        {model.status === "error" ? (
          // Not in the export, which draws no error state — kept because the
          // condition is real, and folded into the row rather than given its
          // own block so a broken model still reads as one list item.
          <p className="mt-dist-sm flex items-start gap-dist-sm text-body-md text-text-danger">
            <Warning className="size-4 shrink-0 translate-y-0.5" weight="bold" />
            <span>
              {model.lastError ?? "This key stopped working."} Remove it and add the
              model again with a working key.
            </span>
          </p>
        ) : null}
      </div>

      <button
        ref={ref}
        style={style}
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${model.label}`}
        // Sits on surface-2 against the row's surface-3, per the export — the
        // affordance reads as inset rather than as a floating icon.
        className="mt-dist-sm shrink-0 cursor-pointer rounded-rad-sm bg-surface-2 p-pad-xs text-icon-subtle transition-colors duration-150 ease outline-none hover:text-icon-danger focus-visible:text-icon-danger"
      >
        <Trash className="size-4" weight="bold" />
      </button>
    </div>
  )
}

export { AiModelEntry }
