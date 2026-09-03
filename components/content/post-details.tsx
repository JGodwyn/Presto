"use client"

import * as React from "react"
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
import { DateTimePickerDialog } from "@/components/shared/date-time-picker-dialog"
import { PostAccountPill } from "@/components/shared/post-account-pill"
import { AnimateText } from "@/components/ui/animated-text"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { Toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  exceedsPlatformLimit,
  PLATFORM_LENGTH_LIMITS,
} from "@/lib/post-length"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { STREAM_DONE_MARKER, STREAM_ERROR_MARKER } from "@/lib/ai/model-constants"
import { generationFailureCopy } from "@/lib/ai/failure-copy"
import { getCaretOffsetFromPoint } from "@/lib/caret"
import { formatDate } from "@/lib/format-date"
import { formatClockTime } from "@/lib/time-of-day"
import {
  nextPostAccount,
  PLATFORM_LABELS,
  resolvePostAccount,
  type PostAccountTarget,
} from "@/lib/post-account"
import { isNetworkError } from "@/lib/network-error"
import { reportNetworkIssue, withNetworkStatus } from "@/lib/network-status"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"
import type { ConnectedSocialAccount } from "@/types/social-account"

// How long the regenerate stream may go without producing a single byte
// before it is given up on. This is the "the agent hung" case: the request
// connects, the model never answers, and nothing below would ever resolve on
// its own — reader.read() simply waits forever, leaving the page looping
// "generating post . . ." with no error and no way out but a reload. The clock
// is reset by every chunk that arrives, so a slow-but-alive generation is
// never cut off; only a genuinely silent one is. Generous because the first
// token can legitimately take a while (a long prompt, a cold provider).
const STREAM_STALL_TIMEOUT_MS = 45_000

// The regenerating heading's elastic loop — the same "generating N posts . . ."
// recipe generating-view.tsx uses, tuned on a DialKit panel and frozen here
// once the feel was right (git history has the panel if it needs re-tuning),
// same treatment as toast.tsx's entrance and use-shake.ts.
const REGENERATING_HEADING = {
  offset: 5,
  stagger: 0.03,
  duration: 0.3,
  bounce: 0.4,
  loopDelay: 800,
}

// Extra breathing room after a chunk's own entrance has fully settled (see
// nextRevealAtRef below) before the next one is let through. The server
// (app/api/regenerate-post) streams raw text as fast as the model produces it
// with no pacing of its own, so this and the entrance values below are the
// only things controlling how the reveal actually feels.
const REGENERATING_LINE_DELAY_MS = 10

// Each chunk's own word-wave entrance — the same spring-stagger-plus-blur idea
// as the heading, smaller and quicker per direct request ("less pronounced...
// faster") since this plays on every one of many chunks rather than once on a
// single short loop.
const REGENERATING_LINE_ENTRANCE = {
  offset: 6,
  stagger: 0.02,
  duration: 0.2,
  bounce: 0.1,
  blur: 1,
}

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
  accounts,
  activeTopics,
  backHref,
}: {
  post: Post
  // This project's connected social accounts, so the pill can name the
  // account this post goes out as and cycle between the alternatives.
  accounts: ConnectedSocialAccount[]
  // The project's current Instructions topics — a topic on this post that
  // isn't in here has since been deleted, and renders retired. An array, not
  // a Set: this crosses the server→client boundary, and ContentView takes the
  // same shape for the same reason.
  activeTopics: string[]
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
    // The small capsule tucked under the toast (toast.tsx's `extraInfo`) —
    // the same split the offline toast uses: what happened on the toast, what
    // to do about it underneath.
    extraInfo?: string
  }>({ open: false, variant: "danger", message: "" })

  const showError = (message: string, extraInfo?: string) =>
    setToast({ open: true, variant: "danger", message, action: undefined, extraInfo })

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

  // Membership is checked once per topic chip; the array keeps the order the
  // user arranged on the Instructions page, which the modal's picker uses.
  const activeTopicSet = React.useMemo(
    () => new Set(activeTopics),
    [activeTopics]
  )

  // Platform and isTryout move together: "Try out" is a cycle position rather
  // than a platform of its own, so a switch always writes both. Optimistic
  // with a revert, like every other edit on this page.
  //
  // Split into a commit half and a guard half so a reroll that was blocking a
  // switch can apply it once the new text lands.
  const commitSocialChange = (target: PostAccountTarget) => {
    const previous = {
      platform: currentPost.platform,
      isTryout: currentPost.isTryout,
    }
    const patch = { platform: target.platform, isTryout: target.isTryout }
    patchPost(patch)

    void withNetworkStatus(
      updatePost({ projectId: currentPost.projectId, id: currentPost.id, patch })
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost(previous)
        if (result !== null) showError("Couldn't change that post's account")
      }
    })
  }

  // The one rule the pill and the guard below must agree on: a position this
  // post cannot move to. Try out is never refused — postAccountCycle gives it
  // the post's own platform, and nothing is published from a try-out post.
  const refusesPost = (target: PostAccountTarget) =>
    !target.isTryout && exceedsPlatformLimit(currentPost.content, target.platform)

  // Where "Skip to …" goes: the next position this post can actually move to,
  // which is what the cycle would have landed on had the refused one not been
  // offered. Null when there is no such position, and the dialog then has no
  // second button — closing it is the only way out, which is correct.
  const skipTarget = nextPostAccount(currentPost, accounts, refusesPost)

  const handleSocialChange = (target: PostAccountTarget) => {
    // **The switch is refused while the post cannot fit the platform**, rather
    // than allowed with a warning. A post on X that X would reject is not a
    // state worth being able to reach: the only thing to do from there is fix
    // it, so the fix is asked for first.
    //
    // Skipped for a Try out target, and that exemption is load-bearing rather
    // than a special case: postAccountCycle gives a Try out position the
    // *post's own* platform, so an X post switching to Try out arrives here
    // with target.platform === "x" and would otherwise be blocked by a limit
    // that cannot apply — nothing is ever published from a try-out post.
    // The pill offers X like any other position, and the refusal happens here
    // rather than by quietly skipping it in the cycle: a position that silently
    // stops being offered reads as "X isn't connected", and the user never
    // learns the post is simply too long. The dialog is where both the reason
    // and the way past it live.
    if (refusesPost(target)) {
      setBlockedSwitch(target)
      return
    }

    commitSocialChange(target)
  }

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

  // Add to calendar / Change date. Also the time: the shared picker hands
  // back a full moment either way, so a time-only edit arrives here as a
  // date whose day happens to be unchanged, and needs no separate path.
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

  // `after` is the write this is undoing, when there is one. Both target the
  // same row, and a fire-and-forget pair has no ordering guarantee -- the undo
  // could land first and be overwritten by the move it was undoing, leaving
  // the DB scheduled while the page shows a draft. Waiting is free here: the
  // UI has already flipped optimistically, so nothing on screen is holding for
  // it. Same ordering rule AGENTS.md ships useSaveQueue for, at the one call
  // site that needs it rather than a queue for the whole page.
  const handleRestoreSchedule = (
    previous: {
      scheduledFor: string | null
      status: Post["status"]
    },
    after?: Promise<unknown>
  ) => {
    patchPost(previous)
    void (async () => {
      await after
      return withNetworkStatus(
        updatePost({
          projectId: currentPost.projectId,
          id: currentPost.id,
          patch: previous,
        })
      )
    })().then((result) => {
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

    // Issued before the toast so Undo can be handed the promise to sequence
    // itself behind (see handleRestoreSchedule). Nothing is awaited between
    // the two, so the toast is still raised in the same tick.
    const move = withNetworkStatus(
      updatePost({ projectId: currentPost.projectId, id: currentPost.id, patch })
    )

    // Raised here, not in the .then() below, per direct feedback about the
    // delay: the move itself is optimistic, so waiting on the round-trip to
    // confirm it made the toast trail the change it was reporting by a whole
    // request. This is the same optimistic-then-undo shape the rest of the app
    // uses — the failure branch reverts the patch *and* replaces this toast
    // with the error, so a toast offering Undo can never outlive the move it
    // is offering to undo.
    setToast({
      open: true,
      variant: "info",
      message: "Moved to draft",
      action: {
        icon: <ArrowArcLeftIcon weight="bold" />,
        label: "Undo",
        onClick: () => handleRestoreSchedule(previous, move),
      },
    })

    void move.then((result) => {
      if (result === null || "error" in result) {
        patchPost(previous)
        // Replaces the confirmation above rather than stacking on it.
        if (result !== null) showError("Couldn't move that post to drafts")
        else setToast((prev) => ({ ...prev, open: false }))
      }
    })
  }

  const [regenerateOpen, setRegenerateOpen] = React.useState(false)
  // The account switch that was refused for being too long, held so the modal
  // can name it and so a successful reroll knows what to switch to afterwards.
  const [blockedSwitch, setBlockedSwitch] =
    React.useState<PostAccountTarget | null>(null)
  // The switch to apply after a reroll launched from the too-long dialog. State
  // rather than a ref because the regenerate dialog renders from it — it is
  // what tells that dialog which platform the reroll is *for*, and so which
  // models can meet its length limit. Cleared once used, so an ordinary later
  // reroll can't re-trigger a switch the user already got.
  const [pendingSwitch, setPendingSwitch] =
    React.useState<PostAccountTarget | null>(null)
  // The account a reroll is currently writing *for*, while it is in flight.
  // Display only — the post genuinely stays on its old platform until the new
  // text lands (that ordering is the whole point of refusing the switch), but
  // showing the old one while the user watches a post being written for the
  // new one is a lie about what is happening. State rather than the ref above
  // because the pill has to re-render when it changes.
  const [regeneratingFor, setRegeneratingFor] =
    React.useState<PostAccountTarget | null>(null)
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
  // The in-flight regenerate, so the stall watchdog can cut it off and this
  // page's own unmount can stop touching state.
  //
  // Unmount deliberately does *not* abort. A client disconnect aborts the
  // request the route handler is running in, so its onEnd sees `ok: false`
  // and persists nothing (see that route's own comment) -- aborting here
  // would throw away a generation, and its token spend, for anyone who taps
  // Back a second after Regenerate. Instead the read loop runs on to keep the
  // connection open, and this flag stops it calling setState on a gone
  // component. Same shape as generating-view.tsx's `cancelled`.
  const regenerateRunRef = React.useRef<{ cancelled: boolean } | null>(null)

  React.useEffect(
    () => () => {
      if (regenerateRunRef.current) regenerateRunRef.current.cancelled = true
    },
    []
  )

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
            (Math.max(wordCount - 1, 0) * REGENERATING_LINE_ENTRANCE.stagger +
              REGENERATING_LINE_ENTRANCE.duration) *
            1000
          nextRevealAtRef.current = performance.now() + settleMs + REGENERATING_LINE_DELAY_MS
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
    // The reveal-pacing values are module constants now (they were dial
    // readings before), so they can't change between renders and aren't deps.
  }, [isRegenerating])

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
  const handleRegenerate = async (
    guidance: string,
    model: string,
    topic: string | undefined,
    // Set only by the too-long-to-switch flow. The post is still on its old
    // platform for the whole of this call — the switch is applied at the end,
    // and only on a clean finish — so the prompt has to be told what it is
    // writing for rather than reading it off the row.
    switchTo?: PostAccountTarget
  ) => {
    setRegenerateOpen(false)
    // Consumed, not read: `switchTo` already holds it, and leaving it set would
    // make a later ordinary reroll apply a switch nobody asked for — no failure
    // path below clears it, they all return early.
    setPendingSwitch(null)
    setRegeneratingFor(switchTo ?? null)
    setIsRegenerating(true)
    setChunks([])
    receivedRef.current = ""
    revealedRef.current = ""
    streamDoneRef.current = false
    nextRevealAtRef.current = 0

    // One controller for the whole exchange, tripped only by the stall
    // watchdog below -- unmount cancels via `run` instead, so that an abort
    // now always means "we gave up waiting" and nothing else.
    const controller = new AbortController()
    const run = { cancelled: false }
    regenerateRunRef.current = run
    let timedOut = false
    let stallTimer: ReturnType<typeof setTimeout> | undefined
    const armStallTimer = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, STREAM_STALL_TIMEOUT_MS)
    }
    // Teardown only — deliberately no setState, so the unmount path below can
    // release the timer and the ref without touching a gone component.
    const releaseRegenerate = () => {
      clearTimeout(stallTimer)
      if (regenerateRunRef.current === run) regenerateRunRef.current = null
    }
    armStallTimer()

    let response: Response
    try {
      response = await fetch("/api/regenerate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          projectId: currentPost.projectId,
          id: currentPost.id,
          model,
          guidance: guidance || undefined,
          topic,
          targetPlatform: switchTo?.platform,
        }),
      })
    } catch (error) {
      releaseRegenerate()
      // Unmounted while this was in flight: nothing to report, and nothing
      // left to report it to.
      if (run.cancelled) return
      setIsRegenerating(false)
      if (timedOut) showError("That took too long", "Please try again")
      else if (isNetworkError(error)) reportNetworkIssue()
      else showError("Couldn't regenerate that post.")
      return
    }

    if (!response.ok || !response.body) {
      releaseRegenerate()
      if (run.cancelled) return
      setIsRegenerating(false)
      const body = await response.json().catch(() => null)
      showError(body?.error ?? "Couldn't regenerate that post.")
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    // Set once the server's end-of-stream marker arrives. A stream that ends
    // without it was cut off in transit (see STREAM_DONE_MARKER) and must not
    // be treated as a finished post.
    let sawDone = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Something arrived, so the stall clock starts over — a slow
        // generation is fine, a silent one is not.
        armStallTimer()
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
          // The failure reason is written directly behind the marker, but one
          // server-side write is not guaranteed to arrive as one chunk — so
          // read out whatever is left (the server closes immediately after
          // that write, so this can't wait on a live generation) before
          // deciding what to say. Worst case the tail never lands and this
          // falls back to the generic line, which is what it said before.
          try {
            while (true) {
              const tail = await reader.read()
              if (tail.done) break
              receivedRef.current += decoder.decode(tail.value, { stream: true })
            }
          } catch {
            // Nothing more to read; the marker alone is enough to report on.
          }
          releaseRegenerate()
          if (run.cancelled) return
          setIsRegenerating(false)
          const { message, extraInfo } = generationFailureCopy(
            receivedRef.current.split(STREAM_ERROR_MARKER)[1]?.trim() || undefined,
            { message: "Couldn't regenerate that post", extraInfo: "Please try again" }
          )
          showError(message, extraInfo)
          return
        }
        // Stripped the moment it lands, so the reveal loop can never render
        // it. Safe to do here rather than at the end: nothing is awaited
        // between the append above and this line, so the reveal interval
        // cannot tick in between and see the marker in the buffer.
        if (receivedRef.current.includes(STREAM_DONE_MARKER)) {
          receivedRef.current = receivedRef.current.replace(STREAM_DONE_MARKER, "")
          sawDone = true
        }
      }
    } catch (error) {
      releaseRegenerate()
      if (run.cancelled) return
      setIsRegenerating(false)
      if (timedOut) showError("That took too long", "Please try again")
      else if (isNetworkError(error)) reportNetworkIssue()
      else showError("Couldn't regenerate that post.")
      return
    }

    // Ended without the server ever saying it finished: the connection was
    // severed mid-generation (a function hitting its duration ceiling, a
    // proxy idling the socket out). The server persisted nothing, so neither
    // does this page — the existing post stays exactly as it was.
    if (!sawDone) {
      releaseRegenerate()
      if (run.cancelled) return
      setIsRegenerating(false)
      showError("The connection dropped", "Try reloading")
      return
    }
    releaseRegenerate()
    // Read to the end so the server saw no disconnect and persisted, but this
    // page is gone -- there is no state left to bring in line with it.
    if (run.cancelled) return
    // The server persists the picked topic alongside the new content (see
    // that route's own topicsUpdate), so the chip above has to follow — this
    // is the same "keep local state in sync with what the server already
    // saved" patch the content itself gets, just for the one field the
    // stream can't carry back. Only on a clean finish: every failure path
    // above returns before here, and none of them persisted anything.
    if (topic && topic !== currentPost.topics[0]) {
      patchPost({ topics: [topic] })
    }
    // The switch that was refused before the reroll. Deliberately last, and
    // only on this clean-finish path: every failure above returns before here.
    //
    // **Re-checked against the new text rather than assumed.** "It has been
    // regenerated" is not the same as "it fits" — a model can overshoot, and
    // TasteTest ignores the prompt entirely and always will. Committing on the
    // strength of the reroll alone would put a post on X that X would reject,
    // which is the exact state the refusal exists to prevent.
    if (switchTo) {
      if (exceedsPlatformLimit(receivedRef.current, switchTo.platform)) {
        showError(
          `Still too long for ${PLATFORM_LABELS[switchTo.platform]}`,
          "The post was rewritten but stayed over the limit"
        )
      } else {
        commitSocialChange(switchTo)
      }
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

      {/* The post itself, per design-sync/contentpagenew: one 400px column
          (the export's own width, and a sane line length to read at) centred
          in the panel, with the heading, the account/topics row and the body
          all flush to *that column's* left edge rather than each centred on
          its own. The header used to be its own hugging, centred block, which
          left it floating over the body instead of lining up with it.

          items-center on this wrapper is what centres the column; items-start
          inside it is what left-aligns the contents. */}
      <div className="flex min-h-0 flex-1 flex-col items-center">
        <div className="flex w-100 min-h-0 flex-1 flex-col items-start gap-dist-lg">
          {/* Date • time on the heading line itself, the same shape the post
            cards read in — the time no longer sits on a line of its own
            below, and the icon that led it is gone with it (the bullet is the
            separator now, and the date has no icon either). It fits at
            heading-sm in this 400px column because the current year is
            dropped (lib/format-date.ts): "AUGUST 28 • 10 AM", where
            "AUGUST 28TH, 2026 · 10:00 AM" would have wrapped. */}
          <div className="flex shrink-0 items-center gap-dist-md">
              {isRegenerating ? (
                // Same AnimateText "elastic" treatment the Generate page loops on
                // its own "generating N posts . . ." heading (generating-view.tsx)
                // while a batch is in flight — this is the one-post version of it.
                <AnimateText
                  text="generating post . . ."
                  type="elastic"
                  className="text-heading-sm font-display text-text-bold"
                  offset={REGENERATING_HEADING.offset}
                  stagger={REGENERATING_HEADING.stagger}
                  duration={REGENERATING_HEADING.duration}
                  bounce={REGENERATING_HEADING.bounce}
                  loop
                  loopDelay={REGENERATING_HEADING.loopDelay}
                />
              ) : (
                <>
                  {/* font-display (Phudu) renders caps on its own — no `uppercase`.
                      The three parts are separate elements rather than one
                      morphed string: only the date carries text-bold, and
                      TextMorph takes a plain string, so a subtle bullet and
                      time can't ride inside the same one. Each half still
                      morphs on its own when the schedule changes. */}
                  <h1 className="flex items-baseline gap-dist-md text-heading-sm font-display text-text-bold">
                    <TextMorph duration={HEADING_MORPH_DURATION} ease={STRONG_EASE_OUT}>
                      {scheduled ? formatDate(scheduled) : "Draft"}
                    </TextMorph>
                    {scheduled ? (
                      <>
                        <span aria-hidden className="text-text-subtle">
                          •
                        </span>
                        <span className="whitespace-nowrap text-text-subtle">
                          <TextMorph
                            duration={HEADING_MORPH_DURATION}
                            ease={STRONG_EASE_OUT}
                          >
                            {formatClockTime(scheduled)}
                          </TextMorph>
                        </span>
                      </>
                    ) : null}
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

          {/* The account pill and this post's topics, per the export's own
            row under the heading. The pill cycles through every account this
            project can post as — "Try out" included, which is what keeps it
            tappable when only one real account is connected. Topics are
            display-only here (they're assigned at generation), and one whose
            topic has since been deleted from Instructions renders retired. */}
          <div className="flex shrink-0 flex-wrap items-center gap-dist-md">
            <PostAccountPill
              // While a reroll is in flight for a *different* account, the
              // pill shows that one. Gated on isRegenerating rather than
              // cleared on every exit path: releaseRegenerate deliberately
              // does no setState (it also runs on unmount), so the flag that
              // is already maintained everywhere is the reliable gate, and a
              // stale regeneratingFor simply never renders.
              account={resolvePostAccount(
                isRegenerating && regeneratingFor
                  ? { ...currentPost, ...regeneratingFor }
                  : currentPost,
                accounts
              )}
              nextAccount={
                isRegenerating ? null : nextPostAccount(currentPost, accounts)
              }
              onSelect={handleSocialChange}
              className="max-w-60"
            />
            {currentPost.topics.map((topic) => (
              <Chip
                key={topic}
                size="md"
                selected={false}
                retired={!activeTopicSet.has(topic)}
                // text-bold rather than Chip's own text-subtle, per direct
                // request and matching the export's own label fill
                // (Text/text-bold). Scoped to this screen rather than changed on
                // the component: everywhere else an unselected chip is secondary
                // to what it sits beside, but here the topic is one of only two
                // things describing the post. A retired chip keeps its own
                // text-minimal — the point of that state is that it has faded
                // out of the project, which a bold label would undo.
                className={activeTopicSet.has(topic) ? "text-text-bold" : undefined}
              >
                {topic}
              </Chip>
            ))}
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
                "w-full min-h-0 flex-1 resize-none bg-transparent text-body-lg whitespace-pre-wrap text-text-bold outline-none",
                HIDE_NATIVE_SCROLLBAR_CLASSNAME
              )}
            />
          ) : (
            // relative: the old text's exit (and, on a failed regenerate, its
            // re-entrance) is absolutely positioned over this box rather than
            // in normal flow, so it can fade away over a genuinely blank area
            // instead of pushing the streaming view below it down for the
            // ~300ms the exit takes.
            <div className="relative w-full min-h-0 flex-1">
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
                      offset={REGENERATING_LINE_ENTRANCE.offset}
                      stagger={REGENERATING_LINE_ENTRANCE.stagger}
                      duration={REGENERATING_LINE_ENTRANCE.duration}
                      bounce={REGENERATING_LINE_ENTRANCE.bounce}
                      blur={REGENERATING_LINE_ENTRANCE.blur}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Closes immediately on confirm (unlike the delete confirmation,
          which stays open with its own spinner) — the loading state lives on
          the page itself, in the heading swap and dimmed content above, per
          direct request to mirror the Generate page's own treatment. */}
      <RegenerateModal
        open={regenerateOpen}
        onOpenChange={(open) => {
          // Backing out of the reroll abandons the switch it was going to
          // apply — the post stays where it was, which is what refusing the
          // switch in the first place promised.
          if (!open) setPendingSwitch(null)
          setRegenerateOpen(open)
        }}
        projectId={currentPost.projectId}
        // The same live topic list the chips above are checked against — no
        // extra fetch, and the two can't disagree about what still exists.
        topics={activeTopics}
        currentTopic={currentPost.topics[0]}
        // The platform this reroll writes for: the one a refused switch is
        // waiting on, or the post's own when it is an ordinary regenerate.
        targetPlatform={pendingSwitch?.platform ?? currentPost.platform}
        onConfirm={(guidance, model, topic) =>
          void handleRegenerate(guidance, model, topic, pendingSwitch ?? undefined)
        }
      />

      {/* The refused switch. Confirming hands straight over to the regenerate
          dialog, carrying the pending switch with it — the post moves only once
          text written for the target platform exists. Dismissing leaves the
          post exactly where it was. */}
      <ConfirmationModal
        open={blockedSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedSwitch(null)
        }}
        title={`Too long for ${blockedSwitch ? PLATFORM_LABELS[blockedSwitch.platform] : ""}`}
        description={
          blockedSwitch
            ? `This post is ${currentPost.content.trim().length.toLocaleString()} characters and ${PLATFORM_LABELS[blockedSwitch.platform]} allows ${(PLATFORM_LENGTH_LIMITS[blockedSwitch.platform] ?? 0).toLocaleString()}. Regenerate it to fit, or shorten it yourself first.`
            : ""
        }
        actionLabel="Regenerate"
        actionVariant="brand"
        secondaryAction={
          skipTarget
            ? {
                label: `Skip to ${resolvePostAccount({ ...currentPost, ...skipTarget }, accounts).label}`,
                onClick: () => {
                  const target = skipTarget
                  setBlockedSwitch(null)
                  commitSocialChange(target)
                },
              }
            : undefined
        }
        onConfirm={() => {
          // Handed over before this modal closes, so the regenerate dialog
          // opens already knowing which platform the reroll is for.
          setPendingSwitch(blockedSwitch)
          setBlockedSwitch(null)
          setRegenerateOpen(true)
        }}
      />

      {/* The same shared picker the generated-post card uses
          (components/shared/date-time-picker-dialog.tsx) — a date click
          commits and closes, the time inside it commits on its own. */}
      <DateTimePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        date={scheduled}
        onDateChange={handleDateChange}
      />

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
              extraInfo={toast.extraInfo}
            >
              {toast.message}
            </Toast>
          </div>,
          document.body
        )}
    </div>
  )
}
