"use client"

import { Plus } from "@phosphor-icons/react"

import { CreateProjectModal } from "@/components/create-project/create-project-modal"
import { DialogTrigger } from "@/components/ui/dialog"

// Dashed "new project" folder card — same silhouette as ProjectFolder but the
// exported vector is 258×170 with a center-aligned dashed stroke, so the SVG
// bleeds 1px past the 256×168 card box (-inset-px) to line up with siblings.
export function NewProjectFolder() {
  return (
    <CreateProjectModal
      trigger={
        <DialogTrigger
          render={
            <button
              type="button"
              className="relative flex h-42 w-full min-w-64 cursor-pointer flex-col items-center justify-end gap-dist-md rounded-rad-lg p-pad-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          {/* Explicit size, not just -inset-px: an absolutely-positioned svg
              with auto width/height gets sized from its viewBox aspect ratio,
              overriding the bottom inset — at the Figma-exact 256px card
              width the two coincided, but a fluid (stretched) card made the
              svg render taller than the button. */}
          <svg
            viewBox="0 0 258 170"
            preserveAspectRatio="none"
            aria-hidden
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)]"
          >
            <path
              vectorEffect="non-scaling-stroke"
              d="M112.591 169H27.9447C18.5131 169 13.7971 169 10.1948 167.331C7.0263 165.863 4.44981 163.521 2.83575 160.64C1 157.365 1 153.077 1 144.502V25.4983C1 16.9231 1 12.6355 2.83575 9.36026C4.44981 6.47915 7.0263 4.13684 10.1948 2.66883C13.7971 1 18.5131 1 27.9447 1H61.5786C67.4181 1 70.8175 1.95703 77.4836 6.63533C80.4557 8.72167 81.0333 9.13772 81.3204 9.34464L81.4294 9.42297C81.6468 9.57914 81.8674 9.73166 83.5309 10.8793L85.0848 11.952C85.4777 12.2233 85.8717 12.4795 86.2652 12.7211C92.1954 16.3626 98.1449 16.7366 102.861 16.7366H187.507H193.916H230.055C239.487 16.7366 244.203 16.7366 247.805 18.4055C250.974 19.8735 253.55 22.2158 255.164 25.0969C257 28.3721 257 32.6597 257 41.235V144.502C257 153.077 257 157.365 255.164 160.64C253.55 163.521 250.974 165.863 247.805 167.331C244.203 169 239.487 169 230.055 169H193.916H112.591Z"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="2 8"
              className="fill-surface-4 stroke-border-bold"
            />
          </svg>

          <Plus size={32} aria-hidden className="relative text-text-subtle" />
          <span className="relative text-heading-sm font-display text-text-subtle">
            new project
          </span>
        </DialogTrigger>
      }
    />
  )
}
