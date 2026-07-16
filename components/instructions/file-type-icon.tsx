import Image from "next/image"

import { cn } from "@/lib/utils"

// From the Figma "FileTypes" export (design-sync/filetypes): one shared 3D
// file illustration (public/images/instructions/file-icon-base.webp, same
// raster for every extension) with a colored extension tag layered on top.
// The tag's gradient/border values are the export's literal hex — a one-off
// illustration color, not a design token (same exception noted on the
// dashboard's pixel-gradient artwork and toast.tsx's info purple). Only the
// extensions this card can actually receive (writing-style-actions.ts'
// ALLOWED_FILE_EXTENSIONS) are mapped; anything else renders the base file
// with no tag rather than guessing a color.
const EXTENSION_TAGS = {
  pdf: { label: "pdf", from: "#ff4949", to: "#ee2525", border: "#b51e1e" },
  doc: { label: "doc", from: "#3c76ff", to: "#1756ec", border: "#1e4bb5" },
  docx: { label: "doc", from: "#3c76ff", to: "#1756ec", border: "#1e4bb5" },
  txt: { label: "txt", from: "#3e4c63", to: "#344054", border: "#344054" },
} as const

function FileTypeIcon({
  fileName,
  className,
}: {
  fileName: string
  className?: string
}) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  const tag = EXTENSION_TAGS[extension as keyof typeof EXTENSION_TAGS]

  return (
    <span className={cn("relative block h-10 w-[1.875rem] shrink-0", className)}>
      <Image
        src="/images/instructions/file-icon-base.webp"
        alt=""
        width={60}
        height={80}
        className="h-full w-full object-contain"
      />
      {tag ? (
        <span
          className="absolute bottom-0.5 left-0 rounded-[3px] border px-[3px] py-px text-[8px] leading-tight font-extrabold text-white uppercase shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
          style={{
            background: `linear-gradient(135deg, ${tag.from}, ${tag.to})`,
            borderColor: tag.border,
          }}
        >
          {tag.label}
        </span>
      ) : null}
    </span>
  )
}

export { FileTypeIcon }
