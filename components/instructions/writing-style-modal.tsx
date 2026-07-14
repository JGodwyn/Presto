"use client"

import * as React from "react"
import { Plus, UploadSimple } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillTextarea } from "@/components/ui/pill-textarea"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"

// Figma --rad-xmd for the upload dropzone, as px for the squircle path math —
// see hooks/use-squircle-clip-path.ts.
const DROPZONE_CORNER_RADIUS = 12

type StyleTab = "type" | "url" | "upload"

const STYLE_TABS: { value: StyleTab; label: string }[] = [
  { value: "type", label: "Type" },
  { value: "url", label: "URL" },
  { value: "upload", label: "Upload" },
]

const TEXTAREA_PLACEHOLDERS: Record<Exclude<StyleTab, "upload">, string> = {
  type: "Type out a real example of a post",
  url: "Paste a post URL or a link with multiple posts for Presto to read.",
}

// The "Add a style" modal from the Figma "Instruction Modal - Type/URL/Upload"
// exports: one dialog whose middle section swaps with the segmented control.
// UI only for now — Save just closes; persisting styles (and listing them on
// the card) comes with the writing-styles data model.
function WritingStyleModal() {
  const [tab, setTab] = React.useState<StyleTab>("type")

  return (
    <Dialog
      onOpenChange={(open) => {
        // Reopen in the Figma default state rather than wherever it was left.
        if (!open) setTab("type")
      }}
    >
      <DialogTrigger
        render={<Button variant="brand" size="sm" className="self-start" />}
      >
        <Plus weight="bold" />
        Add a style
      </DialogTrigger>

      <DialogContent popupClassName="w-90">
        <DialogTitle>Writing style</DialogTitle>
        <DialogDescription>
          Show Presto real examples of writing you want your posts to sound
          like.
        </DialogDescription>

        <SegmentedControl
          items={STYLE_TABS}
          value={tab}
          onValueChange={(value) => setTab(value as StyleTab)}
        />

        {/* key'd per tab so each panel gets the codebase's small starting:
            entrance when swapped in (mount-in only, no exit). */}
        <div
          key={tab}
          className="transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          {tab === "upload" ? (
            <UploadDropzone />
          ) : (
            <PillTextarea placeholder={TEXTAREA_PLACEHOLDERS[tab]} />
          )}
        </div>

        <DialogClose
          render={<Button variant="brand" size="xl" className="w-full" />}
        >
          Save
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

// Figma's upload state: a surface-3 well the height of the sibling textarea.
// Picking a file only shows its name for now — parsing/storage comes with the
// writing-styles data model.
function UploadDropzone() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const { ref, style } = useSquircleClipPath<HTMLButtonElement>({
    cornerRadius: DROPZONE_CORNER_RADIUS,
  })

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(event) =>
          setFileName(event.target.files?.[0]?.name ?? null)
        }
      />
      <button
        type="button"
        ref={ref}
        style={style}
        onClick={() => inputRef.current?.click()}
        className="flex h-30 w-full cursor-pointer flex-col items-center justify-center gap-dist-sm rounded-rad-xmd border-[length:var(--stroke-xl)] border-border-subtle bg-surface-3 px-pad-sm py-pad-xl transition-colors duration-150 ease outline-none hover:bg-surface-2 focus-visible:border-border-focused"
      >
        <UploadSimple className="size-5 text-text-bold" />
        <span className="w-full truncate text-body-lg text-text-bold">
          {fileName ?? "Tap to upload a file"}
        </span>
        <span className="text-body-md text-text-subtle">
          Supports PDF, Word, TXT files
        </span>
      </button>
    </>
  )
}

export { WritingStyleModal }
