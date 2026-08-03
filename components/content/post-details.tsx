"use client"

import Link from "next/link"
import {
  ArrowsClockwise,
  CalendarDots,
  CaretLeft,
  PencilSimple,
  Scribble,
  Trash,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { formatFullDate } from "@/lib/format-date"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

// One post on its own page, from the Figma "Content / Post details" exports
// (calendar-post and drafts). The two are the same screen with two
// differences: the heading is the scheduled date or the word "Draft", and the
// middle action moves it the other way — a dated post goes back to drafts, a
// draft goes onto the calendar.
//
// UI only for now, by request: the three actions and the edit pencil render
// but do nothing. Back is wired, since a page with no way out isn't a screen
// you can look at.
export function PostDetails({
  post,
  backHref,
}: {
  post: Post
  // The Content page this was opened from.
  backHref: string
}) {
  const scheduled = post.scheduledFor ? new Date(post.scheduledFor) : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-dist-xl p-pad-2xl">
      <div className="flex shrink-0 items-center justify-between">
        <Button
          variant="brand-secondary"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={backHref} aria-label="Back to content" />}
        >
          <CaretLeft weight="bold" />
        </Button>

        <div className="flex items-center gap-dist-md">
          <Button variant="brand" size="icon-sm" aria-label="Regenerate post">
            <ArrowsClockwise weight="bold" />
          </Button>
          {/* The export's own labels: "Move to drafts" on a dated post. The
              drafts screen shows a calendar icon here instead — its label prop
              was left unchanged in the file, but the icon is the tell, and it
              matches what this action does on a draft everywhere else. */}
          <Button
            variant="brand-secondary"
            size="icon-sm"
            aria-label={scheduled ? "Move to drafts" : "Add to calendar"}
          >
            {scheduled ? (
              <Scribble weight="bold" />
            ) : (
              <CalendarDots weight="bold" />
            )}
          </Button>
          <Button variant="danger" size="icon-sm" aria-label="Delete post">
            <Trash weight="bold" />
          </Button>
        </div>
      </div>

      {/* The post itself, centred in the panel: a heading naming the date (or
          the lack of one) with the edit affordance beside it, then the content
          in its own fixed 400px measure — the export's width, and a sane line
          length to read at. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-dist-lg">
        <div className="flex shrink-0 items-center gap-dist-md">
          {/* font-display (Phudu) renders caps on its own — no `uppercase`. */}
          <h1 className="text-heading-sm font-display text-text-bold">
            {scheduled ? formatFullDate(scheduled) : "Draft"}
          </h1>
          <button
            type="button"
            aria-label="Edit post"
            className="flex cursor-pointer items-center text-icon-subtle transition-[color,scale] duration-150 ease-out outline-none hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
          >
            <PencilSimple weight="bold" className="size-6" />
          </button>
        </div>

        <div
          className={cn(
            "w-100 min-h-0 flex-1 overflow-y-auto text-body-lg whitespace-pre-wrap text-text-bold",
            HIDE_NATIVE_SCROLLBAR_CLASSNAME
          )}
        >
          {post.content}
        </div>
      </div>
    </div>
  )
}
