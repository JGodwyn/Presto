"use client"

import * as React from "react"
import { useDialKit } from "dialkit"
import { AnimatePresence, motion } from "motion/react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  ArrowArcLeftIcon,
  ArrowClockwise,
  CalendarDots,
  CaretLeft,
  PencilSimple,
  Scribble,
  SpinnerGap,
  Trash,
} from "@phosphor-icons/react"
import { TextMorph } from "torph/react"

import { deletePost, updatePost } from "@/app/projects/[projectId]/generate/post-actions"
import { RegenerateModal } from "@/components/content/regenerate-modal"
import { StreamedLine } from "@/components/content/streamed-line"
import { AnimateText } from "@/components/ui/animated-text"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { STREAM_ERROR_MARKER } from "@/lib/ai/generate"
import { getCaretOffsetFromPoint } from "@/lib/caret"
import { formatFullDate } from "@/lib/format-date"
import { isNetworkError } from "@/lib/network-error"
import { reportNetworkIssue, withNetworkStatus } from "@/lib/network-status"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

interface ToastAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

// Same recipe Button already uses for its own label swaps (button.tsx) — this
// app's one strong ease-out curve (STANDARDS.md) at a button-press-band
// duration, reused here rather than inventing a second pair of values for the
// same "text changed in place" job. Also reused below for the content's own
// fade-out into blank when a regenerate starts — same curve, same reasoning.
// Two forms of the same curve: torph's `ease` takes a CSS string, Motion's
// `transition.ease` takes the numeric cubic-bezier tuple instead.
const HEADING_MORPH_DURATION = 150
const STRONG_EASE_OUT = "cubic-bezier(0.23,1,0.32,1)"
const STRONG_EASE_OUT_TUPLE: [number, number, number, number] = [0.23, 1, 0.32, 1]

// Where the body-reveal splits a chunk off to animate in on its own: an
// explicit newline, or sentence-ending punctuation followed by whitespace (or
// the end of whatever's arrived so far — a period doesn't need to wait for a
// space that just hasn't streamed in yet). Per direct feedback that revealing
// only at literal \n boundaries read as "paragraph by paragraph" rather than
// "line by line" — most paragraphs here are themselves one un-broken line of
// several sentences, so \n alone was almost never firing mid-paragraph.
const CHUNK_BREAK_RE = /[.!?](?=\s|$)|\n/g

// One post on its own page, from the Figma "Content / Post details" exports
// (calendar-post and drafts). The two are the same screen with two
// differences: the heading is the scheduled date or the word "Draft", and the
// middle action moves it the other way — a dated post goes back to drafts, a
// draft goes onto the calendar.
export function PostDetails({
  post,
  backHref,
}: {
  post: Post
  // The Content page this was opened from.
  backHref: string
}) {
  const router = useRouter()
  const [isNavigatingBack, startNavigateBack] = React.useTransition()

  // A local mutable copy: this page owns the one post it's showing, the same
  // way day-deck.tsx owns the posts it renders, so a move/reschedule/delete
  // can update the screen immediately rather than waiting on a re-fetch.
  const [currentPost, setCurrentPost] = React.useState(post)
  const scheduled = currentPost.scheduledFor
    ? new Date(currentPost.scheduledFor)
    : undefined

  const { ref: contentFadeRef, onScroll: onContentScroll } = useScrollFade()
  // A separate instance for the streaming view specifically: during the
  // ~300ms the old view is fading out (AnimatePresence, below), both it and
  // the streaming view are briefly mounted at once, and a single shared
  // callback ref would only ever end up attached to whichever one mounted
  // last in that commit.
  const { ref: streamFadeRef, onScroll: onStreamScroll } = useScrollFade()

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const [toast, setToast] = React.useState<{
    open: boolean
    variant: "info" | "danger"
    message: string
    action?: ToastAction
  }>({ open: false, variant: "danger", message: "" })

  const showError = (message: string) =>
    setToast({ open: true, variant: "danger", message, action: undefined })

  // Portalling the toast to <body> needs to wait for the client, unlike
  // PostActionsMenu's portal (which is naturally gated by its own `open`
  // state starting false) — the toast's *presence* is what plays the exit
  // animation, so gating the portal itself on toast.open would tear the
  // portal target out from under AnimatePresence mid-exit. This page is
  // server-rendered, so `document` doesn't exist on the first pass — read
  // through useSyncExternalStore rather than an effect that calls setState
  // (react-hooks/set-state-in-effect), same "server snapshot differs from the
  // client one" shape as lib/network-status.ts.
  const mounted = React.useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )

  // Warms the Content page ahead of the tap, the same reason the Generating
  // page prefetches whatever its Close button points at: arriving here through
  // a menu item rather than a <Link> means nothing prefetched it.
  React.useEffect(() => {
    router.prefetch(backHref)
  }, [router, backHref])

  const patchPost = (patch: Partial<Post>) =>
    setCurrentPost((prev) => ({ ...prev, ...patch }))

  // Click-to-edit content, in place: same idea as GeneratedPostCard's
  // double-click quick-edit, but a single click here (there's nothing else
  // on this box to disambiguate against) and no commit-on-Enter — this page
  // is a full multi-paragraph post rather than a compact card, so Enter has
  // to stay a plain newline. `draft` is a scratch copy, only committed on
  // blur (or Escape to cancel) so keystrokes don't fire a save each time.
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(currentPost.content)
  // Shared between the view div and the edit textarea (only one is ever
  // mounted at a time) so useScrollFade's callback ref reattaches to
  // whichever is actually rendered — see its own comment for why that works
  // across an element swap with no extra plumbing here.
  const caretOffsetRef = React.useRef(0)
  const pendingScrollTopRef = React.useRef(0)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const caret = getCaretOffsetFromPoint(event.clientX, event.clientY)
    caretOffsetRef.current =
      caret && el.contains(caret.node) ? caret.offset : currentPost.content.length
    pendingScrollTopRef.current = el.scrollTop
    window.getSelection()?.removeAllRanges()
    setDraft(currentPost.content)
    setIsEditing(true)
  }

  // Runs before paint so the caret/scroll restore lands in the same frame
  // the textarea replaces the view div, rather than flashing scrollTop 0 (or
  // an end-of-text caret) for a frame first — same reasoning as
  // GeneratedPostCard's own focus effect.
  React.useLayoutEffect(() => {
    if (!isEditing) return
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    const offset = Math.min(caretOffsetRef.current, textarea.value.length)
    textarea.setSelectionRange(offset, offset)
    textarea.scrollTop = pendingScrollTopRef.current
  }, [isEditing])

  const commitContentEdit = () => {
    setIsEditing(false)
    const trimmed = draft.trim()
    // An empty save would fail the DB's own non-empty constraint anyway —
    // silently reverting to the last real content reads better than a
    // save-error Toast for what's almost always an accidental
    // select-all-delete (same call GeneratedPostCard's own edit makes).
    if (!trimmed || trimmed === currentPost.content) return
    const previous = currentPost.content
    patchPost({ content: trimmed })
    void withNetworkStatus(
      updatePost({
        projectId: currentPost.projectId,
        id: currentPost.id,
        patch: { content: trimmed },
      })
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost({ content: previous })
        if (result !== null) showError("Couldn't save your edit")
      }
    })
  }

  const handleContentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setIsEditing(false)
    }
  }

  // Add to calendar / Change date: the same picker as GeneratedPostCard's own
  // (design-sync/calendarwithactionbar) — commits on every date click and
  // closes right away, no separate Apply step, so there's no staged
  // selection to track here either.
  const handleDateChange = (date: Date) => {
    const previous = {
      scheduledFor: currentPost.scheduledFor,
      status: currentPost.status,
    }
    const patch = { scheduledFor: date.toISOString(), status: "scheduled" as const }
    patchPost(patch)

    void withNetworkStatus(
      updatePost({ projectId: currentPost.projectId, id: currentPost.id, patch })
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost(previous)
        if (result !== null) showError("Couldn't save that date")
      }
    })
  }

  const handleRestoreSchedule = (previous: {
    scheduledFor: string | null
    status: Post["status"]
  }) => {
    patchPost(previous)
    void withNetworkStatus(
      updatePost({
        projectId: currentPost.projectId,
        id: currentPost.id,
        patch: previous,
      })
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost({ scheduledFor: null, status: "draft" })
        if (result !== null) showError("Couldn't restore that post")
      }
    })
  }

  // Always a departure from being scheduled — moves the post to the Draft
  // tab and shows an undo-able confirmation, per direct request.
  const handleMoveToDraft = () => {
    const previous = {
      scheduledFor: currentPost.scheduledFor,
      status: currentPost.status,
    }
    const patch = { scheduledFor: null, status: "draft" as const }
    patchPost(patch)

    void withNetworkStatus(
      updatePost({ projectId: currentPost.projectId, id: currentPost.id, patch })
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost(previous)
        if (result !== null) showError("Couldn't move that post to drafts")
        return
      }
      setToast({
        open: true,
        variant: "info",
        message: "Moved to draft",
        action: {
          icon: <ArrowArcLeftIcon weight="bold" />,
          label: "Undo",
          onClick: () => handleRestoreSchedule(previous),
        },
      })
    })
  }

  const [regenerateOpen, setRegenerateOpen] = React.useState(false)
  const [isRegenerating, setIsRegenerating] = React.useState(false)
  // What's actually shown in the body while regenerating — advances toward
  // `receivedRef.current` one line at a time (see the reveal effect below).
  // Empty until the first full line has arrived, which is also what the
  // content box below uses to know whether to still show the dimmed old
  // text or the streamed-in new one.
  // Each already-revealed chunk (one sentence/line, per CHUNK_BREAK_RE above),
  // rendered as its own StreamedLine that plays its word-wave once on mount
  // and never again — appending to this array is what "reveals" a chunk.
  const [chunks, setChunks] = React.useState<string[]>([])
  // The raw text received so far, and how much of it has been sliced into
  // `chunks` already — both refs rather than state because the reveal
  // interval's own closure (recreated only when isRegenerating/the pacing
  // dial changes, not on every chunk) would otherwise read a stale value
  // across ticks. Plain refs read/written from inside the interval callback,
  // never during render, so react-hooks/refs doesn't apply here.
  const receivedRef = React.useRef("")
  const revealedRef = React.useRef("")
  const streamDoneRef = React.useRef(false)
  // performance.now() timestamp before which the next chunk must not reveal
  // — see the reveal effect below for why this exists.
  const nextRevealAtRef = React.useRef(0)

  // Live-tunable via the DialKit panel (top-right, dev only) — same "Generating
  // heading (elastic)" recipe generating-view.tsx tunes its own loading
  // heading with, just a separate named panel since this is a different
  // screen/animation instance.
  const regeneratingHeadingDial = useDialKit("Regenerating heading (elastic)", {
    offset: [5, 0, 150, 5],
    stagger: [0.03, 0, 0.15, 0.005],
    duration: [0.3, 0.1, 1.5, 0.05],
    bounce: [0.4, 0, 1, 0.05],
    loopDelay: [800, 300, 4000, 100],
  })
  // Extra breathing room after a chunk's own entrance has fully settled
  // (see nextRevealAtRef below) before the next one is let through — the
  // server (app/api/regenerate-post) streams raw text as fast as the model
  // produces it with no artificial pacing of its own, so this and the entrance
  // dial below are the only things controlling how the reveal actually feels,
  // and adjusting either takes effect on the very next chunk even mid-stream.
  const regeneratingBodyDial = useDialKit("Regenerating body reveal", {
    lineDelayMs: [10, 0, 300, 5],
  })
  // Each chunk's own word-wave entrance — the same spring-stagger-plus-blur
  // idea as the heading above, smaller and quicker per direct request ("less
  // pronounced... faster") since this plays on every one of many chunks
  // rather than once on a single short loop.
  const regeneratingLineEntranceDial = useDialKit("Regenerating line entrance", {
    offset: [6, 0, 60, 1],
    stagger: [0.02, 0, 0.1, 0.002],
    duration: [0.2, 0.05, 1, 0.01],
    bounce: [0.1, 0, 1, 0.01],
    blur: [1, 0, 20, 0.5],
  })

  // Advances `chunks` toward whatever's landed in `receivedRef`, one complete
  // sentence/line at a time (CHUNK_BREAK_RE) — a tick that finds no complete
  // chunk past what's already revealed does nothing rather than guessing,
  // *except* once the stream itself is done, when the final (possibly
  // unterminated) remainder is revealed outright since nothing else is ever
  // coming to complete it. The same tick also notices when revealing has
  // fully caught up to a finished stream and finalizes there — the one place
  // this state machine actually ends.
  //
  // A new chunk isn't allowed to reveal until the *previous* one's own
  // word-wave entrance (StreamedLine) has actually finished settling —
  // without this, chunks were only paced by lineDelayMs (tens of ms) while
  // each one's own entrance takes several times that to play out, so a new
  // line would start rising in while the last one was still mid-animation
  // ("racing" instead of one-after-the-other, per direct feedback).
  // nextRevealAtRef is a wall-clock deadline computed from *this* chunk's own
  // word count and the current entrance dial, not a fixed cadence — a
  // 12-word sentence and a 2-word one don't take the same time to settle.
  React.useEffect(() => {
    if (!isRegenerating) return
    const tick = () => {
      if (performance.now() < nextRevealAtRef.current) return

      const received = receivedRef.current
      if (revealedRef.current.length < received.length) {
        CHUNK_BREAK_RE.lastIndex = revealedRef.current.length
        const match = CHUNK_BREAK_RE.exec(received)
        const next = match
          ? received.slice(0, match.index + 1)
          : streamDoneRef.current
            ? received
            : revealedRef.current
        if (next !== revealedRef.current) {
          const chunk = next.slice(revealedRef.current.length)
          revealedRef.current = next
          setChunks((prev) => [...prev, chunk])

          const wordCount = chunk.split(/\s+/).filter(Boolean).length
          const settleMs =
            (Math.max(wordCount - 1, 0) * regeneratingLineEntranceDial.stagger +
              regeneratingLineEntranceDial.duration) *
            1000
          nextRevealAtRef.current = performance.now() + settleMs + regeneratingBodyDial.lineDelayMs
        }
      }
      if (streamDoneRef.current && revealedRef.current.length === received.length) {
        setIsRegenerating(false)
        patchPost({ content: received })
      }
    }
    // The poll cadence, not the gate itself — the gate is nextRevealAtRef,
    // checked every tick regardless of how long a chunk's own entrance runs.
    const interval = setInterval(tick, 30)
    return () => clearInterval(interval)
  }, [
    isRegenerating,
    regeneratingBodyDial.lineDelayMs,
    regeneratingLineEntranceDial.stagger,
    regeneratingLineEntranceDial.duration,
  ])

  // The modal's own guidance note (empty when "Just regenerate" was clicked)
  // rides alongside the project's Instructions rather than replacing them —
  // see buildRegenerateSection (lib/ai/build-prompt.ts), which is what this
  // page's calls always go through (there's always a previous post here to
  // react to). The modal now has its own model picker (RegenerateModal),
  // seeded from whichever model the Generate page last ran on but overridable
  // per regenerate — `model` arrives here already resolved, this handler
  // doesn't pick a default.
  //
  // Goes through app/api/regenerate-post rather than the regeneratePost
  // Server Action day-deck.tsx uses — a plain "use server" action returns
  // one value once fully resolved, it can't stream chunks back, and
  // streaming the reveal above is the whole point here. Persistence happens
  // server-side (that route's own onEnd); patchPost below is purely this
  // page keeping its local state in sync with what the server already saved.
  const handleRegenerate = async (guidance: string, model: string) => {
    setRegenerateOpen(false)
    setIsRegenerating(true)
    setChunks([])
    receivedRef.current = ""
    revealedRef.current = ""
    streamDoneRef.current = false
    nextRevealAtRef.current = 0

    let response: Response
    try {
      response = await fetch("/api/regenerate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentPost.projectId,
          id: currentPost.id,
          model,
          guidance: guidance || undefined,
        }),
      })
    } catch (error) {
      setIsRegenerating(false)
      if (isNetworkError(error)) reportNetworkIssue()
      else showError("Couldn't regenerate that post.")
      return
    }

    if (!response.ok || !response.body) {
      setIsRegenerating(false)
      const body = await response.json().catch(() => null)
      showError(body?.error ?? "Couldn't regenerate that post.")
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        receivedRef.current += decoder.decode(value, { stream: true })
        // Plain-text streaming has no framing of its own, so a mid-stream
        // model failure (rate limit, bad key, provider outage) has no
        // HTTP-level signal — the response already got its 200 the moment
        // headers went out. The server appends STREAM_ERROR_MARKER once the
        // underlying stream ends in error (app/api/regenerate-post/route.ts)
        // so that's distinguishable from a normal finish here — without this,
        // whatever partial text had streamed in would get revealed and
        // treated as the finished post, even though the server-side onEnd
        // already skipped persisting it (so the DB never actually changed —
        // only this page's own view of it would have drifted from what's
        // actually saved).
        if (receivedRef.current.includes(STREAM_ERROR_MARKER)) {
          setIsRegenerating(false)
          showError("Couldn't regenerate that post. Please try again.")
          return
        }
      }
    } catch (error) {
      setIsRegenerating(false)
      if (isNetworkError(error)) reportNetworkIssue()
      else showError("Couldn't regenerate that post.")
      return
    }
    // The reveal effect's own tick takes it from here — it notices
    // streamDoneRef flipping true, catches the last (possibly unterminated)
    // line up, and finalizes once revealed has caught up to received.
    streamDoneRef.current = true
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    const result = await withNetworkStatus(
      deletePost({ projectId: currentPost.projectId, id: currentPost.id })
    )
    if (result === null) {
      setIsDeleting(false)
      return
    }
    if ("error" in result) {
      setIsDeleting(false)
      setDeleteOpen(false)
      showError(result.error)
      return
    }
    startNavigateBack(() => router.push(backHref))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-dist-xl p-pad-2xl">
      <div className="flex shrink-0 items-center justify-between">
        {/* A button with its own transition rather than a plain <Link>: going
            back re-runs the Content page's own server work, and until that
            lands there is nothing to show for the tap. `isPending` is the
            signal for exactly that gap — same treatment as the Generating
            page's Close button. (useLinkStatus is the other candidate and the
            wrong one here: it's skipped entirely for an already-prefetched
            route, which this one usually is.) */}
        <Button
          variant="brand-secondary"
          size="icon-sm"
          aria-label="Back to content"
          disabled={isNavigatingBack}
          onClick={() => startNavigateBack(() => router.push(backHref))}
        >
          {isNavigatingBack ? (
            <SpinnerGap weight="bold" className="animate-spin" />
          ) : (
            <CaretLeft weight="bold" />
          )}
        </Button>

        <div className="flex items-center gap-dist-md">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="brand"
                  size="icon-sm"
                  aria-label="Regenerate post"
                  disabled={isRegenerating}
                  onClick={() => setRegenerateOpen(true)}
                >
                  {isRegenerating ? (
                    <SpinnerGap weight="bold" className="animate-spin" />
                  ) : (
                    <ArrowClockwise weight="bold" />
                  )}
                </Button>
              }
            />
            <TooltipContent>Regenerate</TooltipContent>
          </Tooltip>
          {/* The export's own labels: "Move to drafts" on a dated post. The
              drafts screen shows a calendar icon here instead — its label prop
              was left unchanged in the file, but the icon is the tell, and it
              matches what this action does on a draft everywhere else. A
              draft's tap opens the same date picker the pencil does. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="brand-secondary"
                  size="icon-sm"
                  aria-label={scheduled ? "Move to drafts" : "Add to calendar"}
                  onClick={
                    scheduled ? handleMoveToDraft : () => setPickerOpen(true)
                  }
                >
                  {scheduled ? (
                    <Scribble weight="bold" />
                  ) : (
                    <CalendarDots weight="bold" />
                  )}
                </Button>
              }
            />
            <TooltipContent>
              {scheduled ? "Make draft" : "Add to calendar"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="danger"
                  size="icon-sm"
                  aria-label="Delete post"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash weight="bold" />
                </Button>
              }
            />
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* The post itself, centred in the panel: a heading naming the date (or
          the lack of one) with the edit affordance beside it, then the content
          in its own fixed 400px measure — the export's width, and a sane line
          length to read at. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-dist-lg">
        <div className="flex shrink-0 items-center gap-dist-md">
          {isRegenerating ? (
            // Same AnimateText "elastic" treatment the Generate page loops on
            // its own "generating N posts . . ." heading (generating-view.tsx)
            // while a batch is in flight — this is the one-post version of it.
            <AnimateText
              text="generating post . . ."
              type="elastic"
              className="text-heading-sm font-display text-text-bold"
              offset={regeneratingHeadingDial.offset}
              stagger={regeneratingHeadingDial.stagger}
              duration={regeneratingHeadingDial.duration}
              bounce={regeneratingHeadingDial.bounce}
              loop
              loopDelay={regeneratingHeadingDial.loopDelay}
            />
          ) : (
            <>
              {/* font-display (Phudu) renders caps on its own — no `uppercase`. */}
              <h1 className="text-heading-sm font-display text-text-bold">
                <TextMorph duration={HEADING_MORPH_DURATION} ease={STRONG_EASE_OUT}>
                  {scheduled ? formatFullDate(scheduled) : "Draft"}
                </TextMorph>
              </h1>
              {/* Not a content edit — this pencil is the date action:
                  reschedule a dated post, or give a draft its first date.
                  Same picker as the button above; this is just the quicker
                  way to reach it. */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={scheduled ? "Change date" : "Add to calendar"}
                      onClick={() => setPickerOpen(true)}
                      className="flex cursor-pointer items-center text-icon-subtle transition-[color,scale] duration-150 ease-out outline-none hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
                    >
                      <PencilSimple weight="bold" className="size-6" />
                    </button>
                  }
                />
                <TooltipContent>
                  {scheduled ? "Change date" : "Add to calendar"}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Click-to-edit, no textarea chrome of any kind (per direct
            request) — bg-transparent/outline-none/resize-none, same box,
            same type styles, same fade mask as the plain view below, so
            swapping between them reads as the text itself becoming
            editable rather than a field appearing around it. */}
        {isEditing ? (
          <textarea
            ref={(node) => {
              textareaRef.current = node
              contentFadeRef(node)
            }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleContentKeyDown}
            onBlur={commitContentEdit}
            onScroll={onContentScroll}
            className={cn(
              "w-100 min-h-0 flex-1 resize-none bg-transparent text-body-lg whitespace-pre-wrap text-text-bold outline-none",
              HIDE_NATIVE_SCROLLBAR_CLASSNAME
            )}
          />
        ) : (
          // relative: the old text's exit (and, on a failed regenerate, its
          // re-entrance) is absolutely positioned over this box rather than
          // in normal flow, so it can fade away over a genuinely blank area
          // instead of pushing the streaming view below it down for the
          // ~300ms the exit takes.
          <div className="relative w-100 min-h-0 flex-1">
            <AnimatePresence>
              {!isRegenerating && (
                <motion.div
                  key="content"
                  ref={contentFadeRef}
                  onScroll={onContentScroll}
                  onClick={handleContentClick}
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.3, ease: STRONG_EASE_OUT_TUPLE }}
                  className={cn(
                    "absolute inset-0 cursor-text overflow-y-auto text-body-lg whitespace-pre-wrap text-text-bold",
                    HIDE_NATIVE_SCROLLBAR_CLASSNAME
                  )}
                >
                  {currentPost.content}
                </motion.div>
              )}
            </AnimatePresence>
            {isRegenerating && (
              // No placeholder/dimming while empty — per direct request this
              // reads as new text streaming onto a genuinely blank page, not
              // a loading state layered over the old one. The heading's own
              // "generating post . . ." loop is the only affordance until the
              // first chunk lands.
              <div
                ref={streamFadeRef}
                onScroll={onStreamScroll}
                className={cn(
                  "h-full overflow-y-auto text-body-lg whitespace-pre-wrap text-text-bold",
                  HIDE_NATIVE_SCROLLBAR_CLASSNAME
                )}
              >
                {chunks.map((chunk, index) => (
                  <StreamedLine
                    key={index}
                    text={chunk}
                    offset={regeneratingLineEntranceDial.offset}
                    stagger={regeneratingLineEntranceDial.stagger}
                    duration={regeneratingLineEntranceDial.duration}
                    bounce={regeneratingLineEntranceDial.bounce}
                    blur={regeneratingLineEntranceDial.blur}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Closes immediately on confirm (unlike the delete confirmation,
          which stays open with its own spinner) — the loading state lives on
          the page itself, in the heading swap and dimmed content above, per
          direct request to mirror the Generate page's own treatment. */}
      <RegenerateModal
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        projectId={currentPost.projectId}
        onConfirm={(guidance, model) => void handleRegenerate(guidance, model)}
      />

      {/* Just the calendar (design-sync/calendarwithactionbar) — same dialog
          shape as GeneratedPostCard's own "Add to calendar"/"Change date"
          picker: no title/padding/card wrapper of this dialog's own, so
          Calendar's own card (border, shadow, p-pad-md) reads as the only
          chrome. showCloseButton off (Cancel already closes it);
          popupClassName clears the default w-80/padding/background so the
          Popup just hugs Calendar's own size="lg" footprint. clipContent off
          too — this wrapper's own clip-path would otherwise hard-cut
          Calendar's drop shadow at almost the same boundary it's supposed to
          soften. */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          showCloseButton={false}
          clipContent={false}
          popupClassName="w-fit"
          className="gap-0 rounded-none bg-transparent p-0"
        >
          <Calendar
            mode="single"
            selected={scheduled}
            onSelect={(newDate) => {
              if (newDate) handleDateChange(newDate)
              setPickerOpen(false)
            }}
            size="lg"
            showActionBar
            onCancel={() => setPickerOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* The app's default confirmation-modal layout (components/ui/
          confirmation-modal.tsx, design-sync/defaultconfirmationmodal) — a
          single full-width danger action, no separate Cancel button; the
          dialog's own corner X is the dismiss. */}
      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={<Trash weight="bold" className="size-12 text-icon-minimal" />}
        title="Delete post"
        description="You can't undo this. Are you sure you want to delete this post?"
        actionLabel="Delete post"
        isPending={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
      />

      {/* Portalled to <body>, same reason as day-deck.tsx's own overlay:
          GlowPanel carries a clip-path, and a clip-path clips its entire
          painted subtree — including a `fixed` descendant that's laid out
          relative to the true viewport, not the panel. Rendered in place,
          this toast was landing near the real top of the screen but getting
          clipped away entirely, since that y-position falls above GlowPanel's
          own clipped region. */}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
            <Toast
              open={toast.open}
              onOpenChange={(open) => setToast((prev) => ({ ...prev, open }))}
              variant={toast.variant}
              direction="top"
              showIcon={!toast.action}
              action={toast.action}
            >
              {toast.message}
            </Toast>
          </div>,
          document.body
        )}
    </div>
  )
}
