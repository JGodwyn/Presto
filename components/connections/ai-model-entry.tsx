"use client"

import { Sparkle, Trash, Warning } from "@phosphor-icons/react"

import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import type { UserAiModel } from "@/types/ai-model"

// Figma --rad-xmd as px for the squircle path math — see
// hooks/use-squircle-clip-path.ts.
const CARD_CORNER_RADIUS = 12

// One saved model. Follows components/instructions/writing-style-entry.tsx's
// shape: icon + label + trash in a header row, then the details below.
function AiModelEntry({ model, onDelete }: { model: UserAiModel; onDelete: () => void }) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: CARD_CORNER_RADIUS,
  })

  return (
    <div className="flex flex-col gap-dist-md">
      <div className="flex items-center gap-dist-lg">
        <div className="flex min-w-0 flex-1 items-center gap-dist-sm">
          <Sparkle className="size-5 shrink-0 text-text-bold" weight="bold" />
          <h3 className="truncate text-body-lg-bold text-text-bold">{model.label}</h3>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${model.label}`}
          className="shrink-0 cursor-pointer text-icon-subtle transition-colors duration-150 ease outline-none hover:text-icon-danger focus-visible:text-icon-danger"
        >
          <Trash className="size-5" weight="bold" />
        </button>
      </div>

      <div
        ref={ref}
        style={style}
        className="flex flex-col gap-dist-sm rounded-rad-xmd border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 p-pad-md"
      >
        <p className="truncate text-body-lg text-text-bold">{model.gatewayModelId}</p>
        {/* The key itself never leaves the server — key_last_four is stored
            as its own column precisely so this row has something to show. */}
        <p className="text-body-md text-text-subtle">
          Key ending &bull;&bull;&bull;&bull;{model.keyLastFour}
        </p>
      </div>

      {model.status === "error" ? (
        <p className="flex items-start gap-dist-sm text-body-md text-text-danger">
          <Warning className="size-4 shrink-0 translate-y-0.5" weight="bold" />
          <span>
            {model.lastError ?? "This key stopped working."} Remove it and add the model
            again with a working key.
          </span>
        </p>
      ) : null}
    </div>
  )
}

export { AiModelEntry }
