"use client"

import type { Post } from "@/types/post"
import { cn } from "@/lib/utils"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { DashboardPostCard } from "@/components/dashboard/dashboard-post-card"

function PostList({
  title,
  posts,
  emptyLabel,
  postBase,
  now,
}: {
  title: string
  posts: Post[]
  emptyLabel: string
  postBase: string
  now: Date
}) {
  return (
    <div className="flex flex-col gap-dist-md">
      <h3 className="text-body-lg-bold text-text-bold">{title}</h3>
      {posts.length === 0 ? (
        <p className="text-body-md text-text-subtle">{emptyLabel}</p>
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
        "flex flex-col gap-dist-lg overflow-y-auto rounded-rad-xmd bg-surface-3",
        HIDE_NATIVE_SCROLLBAR_CLASSNAME,
        className
      )}
    >
      <PostList
        title="Next up . . ."
        posts={upcoming}
        emptyLabel="Nothing scheduled ahead."
        postBase={postBase}
        now={now}
      />
      <PostList
        title="Recently out"
        posts={recent}
        emptyLabel="Nothing has gone out yet."
        postBase={postBase}
        now={now}
      />
    </div>
  )
}
