"use client"

import { Eyes } from "@phosphor-icons/react"

import type { Post } from "@/types/post"
import { cn } from "@/lib/utils"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { EmptyState } from "@/components/shared/empty-state"
import { DashboardPostCard } from "@/components/dashboard/dashboard-post-card"

// --rad-xmd as px for the squircle path math, same as the dashboard's cards.
const TRAY_CORNER_RADIUS = 12

// A section with no posts (design-sync/emptydashboardpostsection): the list is
// replaced by a fixed 200px surface-2 tray holding the compact EmptyState.
// Surface-2, not the surface-4 the post cards use — nothing is being carded
// here, so the tray reads as a hollow where the cards would be.
function EmptyPostTray({ title }: { title: string }) {
  const { ref, style } = useSquircleClipPath<HTMLDivElement>({
    cornerRadius: TRAY_CORNER_RADIUS,
  })

  return (
    <div
      ref={ref}
      style={style}
      // h-50 is the export's 200px, fixed: the tray keeps its shape whether
      // its message runs to one line or two. rounded-rad-xmd is the fallback
      // shape until the clip-path is measured on mount.
      className="flex h-50 shrink-0 rounded-rad-xmd bg-surface-2 p-pad-2xl"
    >
      <EmptyState size="sm" icon={Eyes} caption="Nothing here" title={title} />
    </div>
  )
}

function PostList({
  title,
  posts,
  emptyTitle,
  postBase,
  now,
}: {
  title: string
  posts: Post[]
  // What the tray says when this section has nothing in it.
  emptyTitle: string
  postBase: string
  now: Date
}) {
  return (
    <div className="flex flex-col gap-dist-md">
      <h3 className="text-body-lg-bold text-text-bold">{title}</h3>
      {posts.length === 0 ? (
        <EmptyPostTray title={emptyTitle} />
      ) : (
        <div className="flex flex-col gap-dist-md">
          {posts.map((post) => (
            <DashboardPostCard
              key={post.id}
              post={post}
              href={`${postBase}/${post.id}`}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// The right-hand column of the calendar row: "Next up . . ." over "Recently
// out", both lists of post cards on the surface-3 canvas rather than in a card
// of their own — the export gives this column the canvas colour, so the white
// post cards are what read as cards.
//
// The export clips it mid-"Recently out" at the same height as the calendar
// card beside it, which is the whole design: the column is a **scroller**, not
// a list that grows the page. Bounding it is the caller's job — see the
// relative/absolute pair in dashboard-view.tsx, the same trick the Content
// page uses to get a definite height out of a content-sized ancestor.
//
// `useScrollFade` is safe here (unlike on `<main>` — see
// components/shared/section-scroll-area.tsx): nothing inside renders
// `position: fixed`, so there is no descendant for the mask to paint out.
export function NextUpColumn({
  upcoming,
  recent,
  postBase,
  now,
  className,
}: {
  upcoming: Post[]
  recent: Post[]
  postBase: string
  now: Date
  className?: string
}) {
  const { ref, onScroll } = useScrollFade({ axis: "y", start: 24, end: 24 })

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className={cn(
        // dist-2xl between the two sections, per the export.
        "flex flex-col gap-dist-2xl overflow-y-auto rounded-rad-xmd bg-surface-3",
        HIDE_NATIVE_SCROLLBAR_CLASSNAME,
        className
      )}
    >
      <PostList
        title="Next up . . ."
        posts={upcoming}
        // The export writes "Your have no posts scheduled for later." —
        // corrected, the same call made on Content's "view it's content".
        emptyTitle="You have no posts scheduled for later."
        postBase={postBase}
        now={now}
      />
      <PostList
        title="Recently out"
        posts={recent}
        emptyTitle="No post has gone out"
        postBase={postBase}
        now={now}
      />
    </div>
  )
}
