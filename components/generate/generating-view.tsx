"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowClockwise,
  CaretLeft,
  EyeClosed,
  Info,
  Pause,
  Play,
  SpinnerGap,
  StopCircle,
  Warning,
} from "@phosphor-icons/react"

import {
  generateAndSavePost,
  deletePost,
  regeneratePost,
  updatePost,
} from "@/app/projects/[projectId]/generate/post-actions"
import { AnimateText } from "@/components/ui/animated-text"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { Toast } from "@/components/ui/toast"
import { GeneratedPostCard } from "@/components/generate/generated-post-card"
import { GeneratingPostCard } from "@/components/generate/generating-post-card"
import { SectionSpinner } from "@/components/shared/section-spinner"
import type { SocialPlatform } from "@/components/generate/social-platform-options"
import {
  nextAllowedPostAccount,  nextPostAccount,
  PLATFORM_LABELS,
  resolvePostAccount,
  type PostAccountTarget,
} from "@/lib/post-account"
import { exceedsPlatformLimit, PLATFORM_LENGTH_LIMITS } from "@/lib/post-length"
import { fetchSocialAccounts } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/client"
import type { ConnectedSocialAccount } from "@/types/social-account"
import { useFlipReorder } from "@/hooks/use-flip-reorder"
import { useShake } from "@/hooks/use-shake"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { generationFailureCopy } from "@/lib/ai/failure-copy"
import type { GenerationFailureReason } from "@/lib/ai/model-constants"
import { readScheduledDates } from "@/lib/generate-schedule"
import { setGenerationLock } from "@/lib/generation-lock"
import { reportNetworkIssue, withNetworkStatus } from "@/lib/network-status"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"
import { useExpiredConnection } from "@/components/connections/expired-connection-provider"

// Figma --rad-md as px for the squircle path math (the status pill).
const STATUS_PILL_CORNER_RADIUS = 8

// Matches the delete exit animation's own duration-300 below (kept in sync
// by hand, same convention as the skip-dates carousel's EXIT_ANIMATION_MS) —
// the extra buffer is slack for the fallback timer, not part of the visible
// animation.
const DELETE_EXIT_MS = 300
const DELETE_FALLBACK_BUFFER_MS = 50

// The heading's elastic entrance, tuned live on a DialKit panel and frozen
// here once the feel was right — same treatment as toast.tsx's entrance and
// use-shake.ts (git history has the panel if this ever needs re-tuning).
// These override AnimateText's own ELASTIC_DEFAULTS, which are a much larger
// throw (offset 50, duration 0.5, bounce 0.2) than a heading this size wants,
// so they do have to be passed rather than left to the component.
const HEADING_ANIMATION = {
  offset: 5,
  stagger: 0.03,
  duration: 0.3,
  bounce: 0.4,
  loopDelay: 800,
}

// How long the generation-failure message stays in place of "Double-tap to
// edit posts" before reverting on its own (per direct request).
const GENERATION_ERROR_DISPLAY_MS = 15_000

// How long after the batch completes (in total failure) before the modal
// appears — a deliberate pause so the failed state behind it (the red
// header/message) registers first, rather than the modal covering it
// immediately (per direct request).
const TOTAL_FAILURE_MODAL_DELAY_MS = 1_000

// One sentence per classifyGenerationError reason (lib/ai/generate.ts) plus
// the two failure kinds that never reach it (missing_instructions/
// not_signed_in) — picked from whichever the batch's last failure reported,
// so "check your model or network" is only the fallback when nothing more
// specific is known, not the default story.
const TOTAL_FAILURE_MESSAGES: Record<GenerationFailureReason, string> = {
  missing_instructions:
    "This project doesn't have Instructions set up yet. Add some on the Instructions page, then try again.",
  not_signed_in: "You've been signed out. Sign back in and try again.",
  model_unavailable:
    "That model isn't available anymore. Pick another one on the Generate page, or add one in Connections.",
  rate_limit:
    "You've hit your model's rate limit or usage quota. Wait a bit and try again, or switch to TasteTest to keep testing for free.",
  auth: "There's a problem with the model's API key. Check it's set up correctly and try again.",
  server: "The model's service is having trouble right now. Try again in a bit.",
  network:
    "We couldn't reach the model. Check your internet connection and try again.",
  unknown:
    "We couldn't generate a post. This could be due to your model or your network. Check both and try again.",
}

// Every post that's finished generating and is still on screen (not
// deleted). id/content/topics come straight from the persisted Post row —
// date/social are the two review-time-editable fields, kept as their own
// client-friendly shapes (Date instead of an ISO string, undefined instead
// of null) and pushed back to the server on every change (see
// handlePostDateChange etc. below). undefined date = draft (design-sync/
// ChangesToGenerateCard) — every freshly-generated post starts here unless
// a calendar-based batch assigned it a real date. "Add to calendar"/"Change
// date" (GeneratedPostCard) is what turns a post scheduled.
interface GeneratedPost {
  id: string
  content: string
  topics: string[]
  date: Date | undefined
  // Seeded from whichever account GenerateCard's SelectPill had selected
  // (the `account`/`isTryout` props below); tapping the card's own account
  // pill cycles both independently from there. They travel as a pair because
  // "Try out" is a cycle position, not a platform — a try-out post still has
  // to be written for somewhere.
  social: SocialPlatform
  isTryout: boolean
  // Which slot of the batch produced this post — i.e. the loop index it was
  // generated at, which for a calendar-based batch is also the index into
  // scheduledDates that gave it its day. Restart uses this to line each slot
  // back up with the row it already filled, so a second run rerolls that
  // post's text instead of inserting a second post onto the same day (see
  // restartTargetsRef below). Not the post's position in `posts`, which
  // shifts as cards are deleted.
  batchIndex: number
}

function toGeneratedPost(post: Post, batchIndex: number): GeneratedPost {
  return {
    id: post.id,
    content: post.content,
    topics: post.topics,
    date: post.scheduledFor ? new Date(post.scheduledFor) : undefined,
    social: post.platform,
    isTryout: post.isTryout,
    batchIndex,
  }
}

// Built from the Figma "Generate / Generating template" export
// (design-sync/generate-generating-template). UI + navigation only — real
// generation isn't wired up yet, so every card renders the same loading
// placeholder regardless of status. Stop/Resume/Restart toggle in place;
// Close (only shown once stopped or completed) is what actually leaves for
// the settings screen. Deliberately its own page (not folded into
// GenerateCard) so the transition and this state's animations can be
// iterated on independently.
export function GeneratingView({
  backHref,
  projectId,
  count,
  account,
  isTryout,
  model,
}: {
  backHref: string
  projectId: string
  count: number
  account: SocialPlatform
  // The account pill was on "Try out" — see the generating page's own note.
  isTryout: boolean
  // A built-in id ("gemini-3.6-flash"/"tastetest") or a user_ai_models row
  // id — resolved and validated server-side in post-actions.ts.
  model: string
}) {
  const router = useRouter()
  const { blockPostingWithExpiredConnection } = useExpiredConnection()
  // The heading loops and cards keep revealing only while status is
  // "generating"; Close is the only way off this page (it navigates away,
  // unmounting everything, which is what actually stops every animation —
  // see AnimateText's loop effect cleanup).
  const [status, setStatus] = React.useState<
    "generating" | "stopped" | "completed"
  >("generating")
  // Lock the app's chrome for as long as a run is in flight. Leaving this page
  // unmounts the view, and that unmount *is* what stops the run, so a sidebar
  // tab or the back arrow would quietly discard whatever was left to generate.
  // Released the moment the run stops or completes — by then leaving costs
  // nothing — and on unmount, so the lock can't outlive the page that set it
  // (Close, a failed run that navigates away, a route error).
  React.useEffect(() => {
    setGenerationLock(status === "generating")
    return () => setGenerationLock(false)
  }, [status])

  // How many of the `count` posts have finished so far — drives the reveal
  // pacing and the "batch complete" check below, same role the old plain
  // `generatedCount` number played. Kept separate from `posts` (below)
  // because deleting a finished post shouldn't make the pacing effect think
  // fewer posts have been generated than actually have — it only ever
  // increases, once per post, regardless of what happens to that post
  // afterward.
  const [generatedSoFar, setGeneratedSoFar] = React.useState(0)
  // Every generated post still on screen — id is a stable identity for
  // delete/regenerate/date-change to target one specific card independent of
  // its position (posts never reorder, but this is the same reasoning as
  // keying list items on id rather than index).
  const [posts, setPosts] = React.useState<GeneratedPost[]>([])
  // This project's connected accounts, so a finished card names the account
  // it goes out as rather than its bare platform — the same thing the Content
  // page does, and the same browser-side read GenerateCard already makes
  // (this is a client component; it can't fetch server-side).
  //
  // Starts empty and stays empty on failure, which resolves to the platform
  // label — the pre-existing behaviour, so a failed read costs nothing but
  // the names.
  const [socialAccounts, setSocialAccounts] = React.useState<
    ConnectedSocialAccount[]
  >([])

  React.useEffect(() => {
    let cancelled = false

    void withNetworkStatus(fetchSocialAccounts(createClient(), projectId))
      .then((accounts) => {
        if (accounts === null || cancelled) return
        setSocialAccounts(accounts)
      })
      .catch(() => {
        // Non-fatal, same as GenerateCard's own read of this.
      })

    return () => {
      cancelled = true
    }
  }, [projectId])
  // How many generation calls in this run have failed — surfaced as one
  // summarizing inline error once the batch completes (see the completion
  // effect below and generationErrorMessage), rather than a per-card error
  // state (none exists yet).
  const [failedCount, setFailedCount] = React.useState(0)
  // The account switch refused for being too long, with the post it was for.
  const [blockedSwitch, setBlockedSwitch] = React.useState<{
    post: GeneratedPost
    target: PostAccountTarget
  } | null>(null)
  // See day-deck.tsx: a reroll from that dialog bypasses the card's own
  // placeholder and its re-entrancy guard unless the card is told about it.
  const [dialogRegeneratingId, setDialogRegeneratingId] = React.useState<
    string | null
  >(null)
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")
  // Split from the message so it can't blank out mid-exit-animation.
  const [toastExtraInfo, setToastExtraInfo] = React.useState<string | undefined>(
    undefined
  )
  const showError = (message: string, extraInfo?: string) => {
    setToastMessage(message)
    setToastExtraInfo(extraInfo)
    setToastOpen(true)
  }
  // The "N of {count} posts couldn't be generated" message replaces the
  // "Double-tap to edit posts" info line in place (per direct request) —
  // rather than a Toast, since this describes the state of the whole batch,
  // not a one-off action. Reverts back to the info line on its own after
  // GENERATION_ERROR_DISPLAY_MS so it doesn't linger indefinitely once the
  // user has seen it.
  const [generationErrorMessage, setGenerationErrorMessage] = React.useState<string | null>(null)
  const generationErrorTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  const showGenerationError = (message: string) => {
    clearTimeout(generationErrorTimeoutRef.current)
    setGenerationErrorMessage(message)
    generationErrorTimeoutRef.current = setTimeout(() => {
      setGenerationErrorMessage(null)
    }, GENERATION_ERROR_DISPLAY_MS)
  }

  // Whichever failure reason the batch's most recent failed attempt
  // reported — read at completion to pick the total-failure modal's
  // message.
  const [lastFailureReason, setLastFailureReason] =
    React.useState<GenerationFailureReason>("unknown")
  // "Total failure" (every attempted post failed, none generated) gets its
  // own modal on top of the inline message above — see the completion
  // effect below for the delay before it appears.
  const [showFailureModal, setShowFailureModal] = React.useState(false)
  const failureModalTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => {
    return () => {
      clearTimeout(generationErrorTimeoutRef.current)
      clearTimeout(failureModalTimeoutRef.current)
    }
  }, [])
  // The calendar-based tab's actual per-post dates, handed off from
  // GenerateCard via sessionStorage (see lib/generate-schedule.ts) — null
  // for a number-based batch, which has no dates to assign at all. Read
  // once, lazily, rather than in an effect: an effect would leave a window
  // (however brief) where the batch effect below could fire before this
  // resolves, and — since Restart reuses the same array to replay the same
  // schedule — this only ever needs to be read the one time this component
  // mounts, not on every render.
  const [scheduledDates] = React.useState(() => readScheduledDates())
  // Bumped to (re)start the batch effect below — on mount (initial value),
  // on Resume, and on Restart. Plain state changes (like generatedSoFar
  // ticking up as the loop progresses) must NOT bump this, or every
  // completed post would tear down and restart the whole loop.
  const [runId, setRunId] = React.useState(0)
  // The effect reads this instead of `status` directly so pausing doesn't
  // require tearing down/recreating the effect (which would also reset
  // wherever the loop currently is) — Stop just flips this ref, and the
  // loop checks it once per iteration boundary, between generation calls
  // (an in-flight network call itself can't be interrupted mid-request).
  const statusRef = React.useRef(status)
  React.useEffect(() => {
    statusRef.current = status
  }, [status])
  // See the batch effect below for what these three are for and why plain
  // effect-local state can't do this job under Strict Mode.
  const startedForRunIdRef = React.useRef<number | null>(null)
  const activeRunIdRef = React.useRef(runId)
  const isUnmountedRef = React.useRef(false)
  // The batchContextId returned from this batch's first (cache-miss)
  // generateAndSavePost call (see post-actions.ts) — every subsequent call
  // in the same batch passes it back so the writing-style/reference
  // resolution (including any Storage file downloads) only happens once
  // per batch instead of once per post. A ref, not state: it only affects
  // what's sent on the *next* call, never a render. Reset to undefined only
  // in handleRestart (a genuinely new batch — old cached context could be
  // stale if Instructions changed since); left untouched by handleResume
  // and by ordinary loop continuation, both of which are the same logical
  // batch carrying on.
  const batchContextIdRef = React.useRef<string | undefined>(undefined)
  // batchIndex → the post id that slot already filled, captured by
  // handleRestart from whatever was on screen when Restart was clicked.
  // A restarted run rerolls those rows in place (regeneratePost) instead of
  // generating fresh ones, so a calendar-based batch can be re-run without
  // stacking a second post onto every day it already scheduled — the row
  // keeps its id, its date and its platform, and only its text changes.
  // Empty on the first run (nothing to reroll), and for any slot whose post
  // was deleted before the restart — those fall through to a real insert,
  // since that day genuinely has no post anymore. A ref, not state: the
  // batch loop reads it, nothing renders from it. Survives Resume
  // untouched, which is the same run carrying on.
  const restartTargetsRef = React.useRef(new Map<number, string>())
  React.useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])
  // Delete plays an exit animation (reversing the card's own entrance)
  // before actually leaving `posts` — this tracks which ids are mid-exit, so
  // the header's own count (below) can drop the instant delete is clicked
  // rather than waiting for the animation to finish, while the card itself
  // stays rendered (with the reversed classes) until then. Same
  // animate-before-remove shape as the skip-dates carousel's
  // useCarouselPresence (generate-calendar-column.tsx), scoped down to a
  // single Set since there's no reordering to also account for here.
  const [exitingPostIds, setExitingPostIds] = React.useState<Set<string>>(
    new Set()
  )
  const deleteFallbackTimeouts = React.useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  )
  // Excludes ids mid-delete-exit so this drops the instant delete is clicked,
  // not once the fade-out finishes — which is what lets the header's count and
  // the leaving-the-page check below both react immediately.
  const availablePostCount = posts.length - exitingPostIds.size
  // Every post this batch produced has been deleted, so there's nothing left
  // to review and the page is on its way back to Generate (see
  // handleDeletePost). Derived rather than tracked: generatedSoFar minus
  // failedCount is how many posts actually landed, so a positive count with an
  // empty grid can only mean they were all deleted. That's also what separates
  // this from a batch that generated *nothing* — same empty grid, but it keeps
  // its "Nothing to show" modal instead of a spinner.
  const isEmptiedByDeleting =
    status === "completed" &&
    availablePostCount === 0 &&
    generatedSoFar > failedCount

  const finishDeletePost = React.useCallback((id: string) => {
    const timeout = deleteFallbackTimeouts.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      deleteFallbackTimeouts.current.delete(id)
    }
    setPosts((prev) => prev.filter((post) => post.id !== id))
    setExitingPostIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Optimistic, same shape as writing-style-card.tsx's handleDelete: the
  // exit animation starts immediately and the server call fires in
  // parallel, rather than waiting for it — only a failure needs to undo
  // anything, which can land either before or after the animation has
  // already removed the card from `posts`, so both cases are handled below.
  const handleDeletePost = (post: GeneratedPost) => {
    // Deleting the last post empties this page, and an empty results grid
    // isn't a screen worth standing on — so leave for the Generate page right
    // away, in the same click. Deliberately not waiting on the exit animation
    // or on the server's answer: both put roughly a second between the click
    // and anything happening, and the app's optimistic-delete convention says
    // the card is gone the moment you ask for it. A refused delete is the one
    // case this can't undo, so it reports through the toast the delete call
    // raises rather than by putting the card back.
    if (status === "completed" && availablePostCount === 1) goBack()
    setExitingPostIds((prev) => new Set(prev).add(post.id))
    // Fallback in case onTransitionEnd never fires (e.g. the tab is
    // backgrounded mid-fade, which suspends transitions and their events) —
    // same reasoning as the carousel's own fallback timer.
    const timeout = setTimeout(
      () => finishDeletePost(post.id),
      DELETE_EXIT_MS + DELETE_FALLBACK_BUFFER_MS
    )
    deleteFallbackTimeouts.current.set(post.id, timeout)

    void withNetworkStatus(deletePost({ projectId, id: post.id })).then((result) => {
      // Both branches undo the optimistic removal; only a server-side refusal
      // gets its own toast, since a network failure already has one.
      if (result === null || "error" in result) {
        const pending = deleteFallbackTimeouts.current.get(post.id)
        if (pending) {
          clearTimeout(pending)
          deleteFallbackTimeouts.current.delete(post.id)
        }
        setExitingPostIds((prev) => {
          const next = new Set(prev)
          next.delete(post.id)
          return next
        })
        setPosts((prev) =>
          prev.some((p) => p.id === post.id) ? prev : [...prev, post]
        )
        if (result !== null) showError("Couldn't delete that post")
      }
    })
  }

  const handlePostDateChange = (post: GeneratedPost, date: Date) => {
    if (blockPostingWithExpiredConnection(post.social, post.isTryout)) return

    const previousDate = post.date
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, date } : p))
    )
    void withNetworkStatus(updatePost({
      projectId,
      id: post.id,
      patch: { scheduledFor: date.toISOString(), status: "scheduled" },
    })).then((result) => {
      if (result === null || "error" in result) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, date: previousDate } : p))
        )
        if (result !== null) showError("Couldn't save that date")
      }
    })
  }

  const handleTurnToDraft = (post: GeneratedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, date: undefined } : p))
    )
    void withNetworkStatus(updatePost({
      projectId,
      id: post.id,
      patch: { scheduledFor: null, status: "draft" },
    })).then((result) => {
      if (result === null || "error" in result) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, date: post.date } : p))
        )
        if (result !== null) showError("Couldn't turn that post into a draft")
      }
    })
  }

  // The one rule the pill and the guard share, matching post-details.tsx and
  // day-deck.tsx. Try out is never refused: postAccountCycle gives it the
  // post's own platform, and nothing is published from a try-out post.
  const refusesPost = (post: GeneratedPost, target: PostAccountTarget) =>
    !target.isTryout && exceedsPlatformLimit(post.content, target.platform)

  const handleSocialChange = (post: GeneratedPost, target: PostAccountTarget) => {
    // Refused here too — a post generated for LinkedIn on this page is exactly
    // as unpostable on X as one opened from Content, and this is the screen
    // where a fresh batch is most likely to be reassigned.
    if (refusesPost(post, target)) {
      setBlockedSwitch({ post, target })
      return
    }

    commitSocialChange(post, target)
  }

  const commitSocialChange = (
    post: GeneratedPost,
    target: PostAccountTarget
  ) => {
    const previous = { social: post.social, isTryout: post.isTryout }
    const next = { social: target.platform, isTryout: target.isTryout }
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, ...next } : p))
    )
    void withNetworkStatus(updatePost({
      projectId,
      id: post.id,
      patch: { platform: target.platform, isTryout: target.isTryout },
    })).then((result) => {
      if (result === null || "error" in result) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, ...previous } : p))
        )
        showError("Couldn't change that post's account")
      }
    })
  }

  // Rerolls one post's text against the same brief it was generated from (see
  // regeneratePost — the prompt is rebuilt server-side from the stored row, so
  // nothing about the batch's own state needs to be replayed here). Awaited
  // rather than optimistic, unlike every handler above: there's no new content
  // to show until the model has actually produced it, and GeneratedPostCard
  // holds its placeholder up for exactly as long as this takes. The batch's
  // cached writing-style/reference context is passed and refreshed the same
  // way the generation loop does it.
  const handleRegeneratePost = async (
    post: GeneratedPost,
    switchTo?: PostAccountTarget
  ) => {
    const result = await withNetworkStatus(
      regeneratePost({
        projectId,
        id: post.id,
        model,
        batchContextId: batchContextIdRef.current,
        // The post is still on its old platform until this succeeds, so the
        // prompt has to be told what it is writing for.
        targetPlatform: switchTo?.platform,
      })
    )

    if (result === null) return

    if (result.batchContextId) batchContextIdRef.current = result.batchContextId

    if ("error" in result) {
      if (result.reason === "network") reportNetworkIssue()
      else {
        // A quota hit is the model refusing, not us failing — say so rather
        // than hiding it behind the action's own generic line. The batch's
        // own total-failure screen says the same thing at its own length
        // (TOTAL_FAILURE_MESSAGES above).
        const { message, extraInfo } = generationFailureCopy(result.reason, {
          message: result.error,
        })
        showError(message, extraInfo)
      }
      return
    }

    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, content: result.post.content } : p))
    )

    // Re-checked against the new text rather than assumed — a reroll having
    // happened is not the same as the result fitting. See post-details.tsx.
    if (switchTo) {
      if (exceedsPlatformLimit(result.post.content, switchTo.platform)) {
        showError(
          `Still too long for ${PLATFORM_LABELS[switchTo.platform]}`,
          "The post was rewritten but stayed over the limit"
        )
      } else {
        commitSocialChange({ ...post, content: result.post.content }, switchTo)
      }
    }
  }

  const handleContentChange = (post: GeneratedPost, content: string) => {
    const previousContent = post.content
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, content } : p))
    )
    void withNetworkStatus(updatePost({
      projectId,
      id: post.id,
      patch: { content },
    })).then((result) => {
      if (result === null || "error" in result) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, content: previousContent } : p
          )
        )
        if (result !== null) showError("Couldn't save your edit")
      }
    })
  }

  React.useEffect(() => {
    const timeouts = deleteFallbackTimeouts.current
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
    }
  }, [])

  // Runs the actual batch: one real generateAndSavePost call at a time,
  // sequential rather than concurrent (gentler on the free-tier model's
  // rate limits, and it naturally matches the "one card reveals at a time"
  // pacing the UI already had). Re-(started) whenever runId changes — see
  // its own comment above for exactly when that happens.
  //
  // generateAndSavePost is a real, non-idempotent side effect (it spends a
  // model call and inserts a DB row) — unlike a plain GET fetch, calling it
  // twice for the same post isn't harmless. That rules out the common
  // "let cancelled = false; ...; return () => { cancelled = true }" effect
  // pattern here: React (Strict Mode, dev only) runs an effect's
  // setup→cleanup→setup again on every mount specifically to surface
  // exactly this kind of bug, and a plain local `cancelled` flag only
  // stops the *first* setup's loop from applying its state updates — it
  // does nothing to stop the *second* setup from independently starting
  // its own loop and duplicating every call (confirmed empirically: two
  // rows landed in Supabase for index 0 before this fix).
  //
  // The fix: startedForRunIdRef, a ref (refs survive Strict Mode's
  // synchronous double-invoke, unlike a closure-local variable) that's
  // checked and set atomically at the top of the effect, so only the
  // first of the two setups for a given runId ever calls run() — the
  // second sees its runId already claimed and returns immediately.
  // activeRunIdRef lets an in-flight loop notice it's been superseded by a
  // genuinely new run (Resume/Restart bumping runId again) even mid-await,
  // and isUnmountedRef (below, its own effect) is what actually stops a
  // loop on a real unmount — a plain boolean toggle is safe to double-set
  // under Strict Mode in a way starting a new async operation is not.
  React.useEffect(() => {
    activeRunIdRef.current = runId

    if (startedForRunIdRef.current === runId) return
    startedForRunIdRef.current = runId

    async function run() {
      for (let i = generatedSoFar; i < count; i++) {
        if (
          isUnmountedRef.current ||
          activeRunIdRef.current !== runId ||
          statusRef.current !== "generating"
        ) {
          return
        }

        // A restarted slot rerolls the post it already produced rather than
        // adding another one beside it — see restartTargetsRef. regeneratePost
        // reads platform/topic/date off the stored row and returns the same
        // shape this loop already handles, so everything below is unchanged.
        const restartTargetId = restartTargetsRef.current.get(i)
        const scheduledFor = scheduledDates?.[i] ?? null
        const result = await withNetworkStatus(
          restartTargetId
            ? regeneratePost({
                projectId,
                id: restartTargetId,
                model,
                batchContextId: batchContextIdRef.current,
              })
            : generateAndSavePost({
                projectId,
                platform: account,
                isTryout,
                model,
                batchIndex: i,
                batchTotal: count,
                scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
                batchContextId: batchContextIdRef.current,
              })
        )

        if (isUnmountedRef.current || activeRunIdRef.current !== runId) return

        // null = the browser couldn't reach us at all; withNetworkStatus has
        // raised the toast. Count it as a failure so the batch still finishes
        // and reports honestly rather than hanging on a missing post.
        if (result === null) {
          setLastFailureReason("network")
          setFailedCount((c) => c + 1)
          setGeneratedSoFar((c) => c + 1)
          continue
        }

        if (result.batchContextId) batchContextIdRef.current = result.batchContextId

        if ("error" in result) {
          // The other direction: the browser reached us fine, but the server
          // couldn't reach what *it* needed, so only this flag reveals it.
          if (result.reason === "network") reportNetworkIssue()
          setLastFailureReason(result.reason)
          setFailedCount((c) => c + 1)
        } else {
          setPosts((prev) => [...prev, toGeneratedPost(result.post, i)])
        }
        setGeneratedSoFar((c) => c + 1)
      }
    }

    run()
    // generatedSoFar is deliberately excluded — it's read once as this
    // effect's starting point (correct: "carry on from wherever we are"),
    // not a trigger to restart on every single increment, which would tear
    // down and recreate the loop after every post. count/account/model/
    // projectId/scheduledDates are all stable for the lifetime of this
    // component (props from a URL that doesn't change, and scheduledDates
    // per its own comment above), so including them here is safe and never
    // causes an unwanted restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, count, account, isTryout, model, projectId, scheduledDates])

  // Separate from the effect above: once every post has finished, the batch
  // is done.
  React.useEffect(() => {
    if (
      status === "generating" &&
      generatedSoFar > 0 &&
      generatedSoFar >= count
    ) {
      // The completion state is intentionally synchronized from the batch
      // counters after paint; the generating loop owns those counters.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("completed")
      if (failedCount > 0) {
        showGenerationError(
          `${failedCount} of ${count} posts couldn't be generated.`
        )
      }
      // Total failure — failedCount reaching count means zero posts
      // succeeded (every attempted slot is either a success, pushed to
      // posts, or a failure, counted here — see the loop above). The modal
      // waits a beat so the red header/message underneath registers first,
      // rather than being covered immediately.
      // Missing instructions is now prevented on the Generate page before a
      // run starts. Keep the server guard for stale tabs, but don't revive the
      // obsolete failure modal if that race reaches this route.
      if (failedCount === count && lastFailureReason !== "missing_instructions") {
        failureModalTimeoutRef.current = setTimeout(() => {
          setShowFailureModal(true)
        }, TOTAL_FAILURE_MODAL_DELAY_MS)
      }
    }
  }, [status, generatedSoFar, count, failedCount, lastFailureReason])

  const handleStop = () => setStatus("stopped")
  // Resume (from "stopped") continues from wherever it left off; Restart
  // (from "completed") starts the whole batch over from zero — same status
  // transition, different starting point for the count. Both bump runId to
  // (re)start the batch effect.
  const handleResume = () => {
    setStatus("generating")
    setRunId((id) => id + 1)
  }
  const handleRestart = () => {
    // Line every slot of the new run back up with the row that slot already
    // filled, so a re-run rewrites those posts rather than adding a second
    // one to each day they're scheduled on. Cards already mid-delete-exit
    // are left out — their rows are on their way to being gone, so those
    // slots should generate fresh.
    restartTargetsRef.current = new Map(
      posts
        .filter((post) => !exitingPostIds.has(post.id))
        .map((post) => [post.batchIndex, post.id] as const)
    )
    deleteFallbackTimeouts.current.forEach(clearTimeout)
    deleteFallbackTimeouts.current.clear()
    clearTimeout(generationErrorTimeoutRef.current)
    clearTimeout(failureModalTimeoutRef.current)
    setGeneratedSoFar(0)
    setPosts([])
    setExitingPostIds(new Set())
    setFailedCount(0)
    setGenerationErrorMessage(null)
    setShowFailureModal(false)
    setLastFailureReason("unknown")
    batchContextIdRef.current = undefined
    setStatus("generating")
    setRunId((id) => id + 1)
  }
  // Same reasoning as the Generate button's own useTransition
  // (generate-card.tsx): router.push doesn't resolve instantly, so isPending
  // is the signal for that gap — Close swaps to a spinner (the app's
  // standard SpinnerGap-bold-animate-spin loading treatment, e.g.
  // logout-button.tsx) rather than sitting there unresponsive.
  const [isNavigatingBack, startNavigateBack] = React.useTransition()
  const goBack = React.useCallback(
    () => startNavigateBack(() => router.push(backHref)),
    [router, backHref]
  )

  // Warms backHref's route ahead of the click, same reasoning as
  // generate-card.tsx's own prefetch of this page — arriving here via a
  // plain Button click (not <Link>) meant the Generate page never got a
  // chance to prefetch ahead of time either.
  React.useEffect(() => {
    router.prefetch(backHref)
  }, [router, backHref])

  // Smoothly closes the gap a deleted card leaves behind — without this,
  // the remaining cards would just snap into their new grid cell the
  // instant `posts` drops the deleted one. Same FLIP hook the skip-dates
  // carousel uses (hooks/use-flip-reorder.ts), just 2D here since this is a
  // multi-column grid (a delete can shift later cards up a row, not just
  // sideways) rather than that carousel's single horizontal row.
  // skipOnGrowth: true — a new post always appends into the grid's next
  // empty cell (confirmed nothing else shifts when that happens), so this
  // only ever needs to correct for a genuine removal, not the reveal timer
  // adding one — without it, the card right before a freshly-revealed one
  // would briefly (and incorrectly) animate as if it had also moved.
  const flipReorder = useFlipReorder(
    posts.map((post) => String(post.id)),
    { skipOnGrowth: true }
  )

  // "N/count" in the status pill next to Stop — the post currently in
  // flight (or, while stopped, whichever one would resume next), not how
  // many have actually finished. Clamped to `count` for the one-render
  // window where generatedSoFar can reach count while status hasn't yet
  // flipped to "completed" (the two effects above run in separate passes).
  const currentPostNumber = Math.min(generatedSoFar + 1, count)
  const { ref: statusPillRef, style: statusPillStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: STATUS_PILL_CORNER_RADIUS,
    })
  // Same shared shake as the calendar-based date-selection error
  // (generate-calendar-column.tsx) — see hooks/use-shake.ts.
  const generationErrorRef = useShake<HTMLParagraphElement>(generationErrorMessage !== null)

  // Deleting the last post starts the trip back to Generate immediately (see
  // handleDeletePost), but the router still has to fetch and render that page
  // — so the page it's leaving hands over to the same centered spinner every
  // other in-project navigation uses (loading.tsx, section-content.tsx) rather
  // than holding an empty grid up in the meantime. Safe as an early return:
  // every hook above runs first, and this is the last thing the view does
  // before it's replaced.
  if (isEmptiedByDeleting) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <SectionSpinner />
      </div>
    )
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="danger"
          direction="top"
          extraInfo={toastExtraInfo}
        >
          {toastMessage}
        </Toast>
      </div>

      {/* The refused switch — same dialog and same two ways out as the Content
          surfaces (components/content/post-details.tsx). */}
      <ConfirmationModal
        open={blockedSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedSwitch(null)
        }}
        title={`Too long for ${blockedSwitch ? PLATFORM_LABELS[blockedSwitch.target.platform] : ""}`}
        description={
          blockedSwitch
            ? `This post is ${blockedSwitch.post.content.trim().length.toLocaleString()} characters and ${PLATFORM_LABELS[blockedSwitch.target.platform]} allows ${(PLATFORM_LENGTH_LIMITS[blockedSwitch.target.platform] ?? 0).toLocaleString()}. Regenerate it to fit, or shorten it yourself first.`
            : ""
        }
        actionLabel="Regenerate"
        actionVariant="brand"
        secondaryAction={(() => {
          if (!blockedSwitch) return undefined
          // nextAllowedPostAccount, not nextPostAccount — see post-details.
          const skip = nextAllowedPostAccount(
            { platform: blockedSwitch.post.social, isTryout: blockedSwitch.post.isTryout },
            socialAccounts,
            (target) => refusesPost(blockedSwitch.post, target)
          )
          if (!skip) return undefined
          return {
            label: `Skip to ${resolvePostAccount({ platform: skip.platform, isTryout: skip.isTryout }, socialAccounts).label}`,
            onClick: () => {
              const { post } = blockedSwitch
              setBlockedSwitch(null)
              commitSocialChange(post, skip)
            },
          }
        })()}
        onConfirm={() => {
          const pending = blockedSwitch
          setBlockedSwitch(null)
          if (!pending) return
          setDialogRegeneratingId(pending.post.id)
          void handleRegeneratePost(pending.post, pending.target).finally(() =>
            setDialogRegeneratingId(null)
          )
        }}
      />

      {/* design-sync/model-variant-2 — the outer DialogContent card (320px,
        bg-surface-4, rounded-rad-lg, px-pad-lg py-pad-xl, gap-dist-lg between
        its 3 direct children) already matches the export's own frame styling
        exactly, so only the children needed building. The icon/heading/body
        group's own internal gap is exported as a flat 14px with no token
        bound to it (unlike every other spacing value here) — closer to
        dist-lg (16, off by 2px) than dist-md (8, off by 6px), so treated as
        the same rhythm as the outer gap rather than inventing a value. */}
      <Dialog open={showFailureModal} onOpenChange={setShowFailureModal}>
        <DialogContent showCloseButton={false}>
          <div className="flex flex-col items-center gap-dist-lg">
            <EyeClosed className="size-12 text-icon-minimal" />
            <DialogTitle className="text-center">Nothing to show</DialogTitle>
            <DialogDescription className="text-center text-body-lg text-text-bold">
              {TOTAL_FAILURE_MESSAGES[lastFailureReason]}
            </DialogDescription>
          </div>
          <Button
            variant="brand"
            size="xl"
            className="w-full"
            onClick={() => {
              setShowFailureModal(false)
              handleRestart()
            }}
          >
            Try again
          </Button>
          <Button
            variant="brand-secondary"
            size="xl"
            className="w-full"
            onClick={() => {
              setShowFailureModal(false)
              goBack()
            }}
          >
            Go back
          </Button>
        </DialogContent>
      </Dialog>

      <div className="flex w-full flex-col gap-dist-xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="flex w-full flex-col gap-dist-md">
        <div className="flex w-full flex-col gap-dist-md md:flex-row md:items-center md:justify-between">
          {/* Trying out nyxui.com's "elastic" AnimateText effect
            (components/ui/animated-text.tsx) on this heading specifically
            — a spot for tweaking animations, per the reason this page
            exists as its own route. Loops (hold → reset → re-enter) only
            while status is "generating". Once completed, the count tracks
            however many generated posts are still actually on screen
            (availablePostCount) rather than the original target `count` —
            deleting a post should drop this number, not just remove the
            card. */}
          <AnimateText
            text={
              status === "completed"
                ? availablePostCount === 0
                  ? "no post generated"
                  : `here's ${availablePostCount} ${availablePostCount === 1 ? "post" : "posts"} for you`
                : `generating ${count} ${count === 1 ? "post" : "posts"}…`
            }
            type="elastic"
            className="w-full text-center text-heading-sm font-display text-text-bold md:w-auto md:text-left"
            offset={HEADING_ANIMATION.offset}
            stagger={HEADING_ANIMATION.stagger}
            duration={HEADING_ANIMATION.duration}
            bounce={HEADING_ANIMATION.bounce}
            loop={status === "generating"}
            loopDelay={HEADING_ANIMATION.loopDelay}
          />

          <div className="flex w-full items-center gap-dist-md md:w-auto">
            {/* design-sync/generatepoststatus — visible while there's still
              something to generate or resume (generating or stopped),
              gone once the batch is actually done. Spinner while
              generating, Pause once stopped (per direct request) — same
              icon slot, swapped rather than two separate elements. */}
            {status !== "completed" && (
              <div
                ref={statusPillRef}
                style={statusPillStyle}
                className="flex items-center gap-dist-sm rounded-rad-md border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 py-pad-xs px-pad-sm"
              >
                {status === "generating" ? (
                  <SpinnerGap
                    weight="bold"
                    className="size-5 animate-spin text-icon-subtle"
                  />
                ) : (
                  <Pause weight="bold" className="size-5 text-icon-subtle" />
                )}
                <span className="text-body-lg text-text-subtle">
                  {currentPostNumber}/{count}
                </span>
              </div>
            )}

            {status === "generating" ? (
              <Button
                variant="danger"
                size="sm"
                cornerRadius={12}
                mobileCornerRadius={12}
                mobileCornerSmoothing={0.5}
                className="flex-1 max-md:min-h-[var(--pad-2xl)] max-md:min-w-0 max-md:rounded-rad-xmd md:flex-none"
                onClick={handleStop}
              >
                <StopCircle weight="bold" />
                Stop
              </Button>
            ) : (
              <Button
                variant={status === "stopped" ? "success" : "brand"}
                size="sm"
                cornerRadius={12}
                mobileCornerRadius={12}
                mobileCornerSmoothing={0.5}
                className="flex-1 max-md:min-h-[var(--pad-2xl)] max-md:min-w-0 max-md:rounded-rad-xmd md:flex-none"
                onClick={status === "stopped" ? handleResume : handleRestart}
              >
                {/* Two top-level children (not one wrapped in a fragment)
                  so Button's per-child TextMorph — see button.tsx's
                  withTextMorph — still animates the label the same way
                  "Stop"/"Generate post(s)" already do elsewhere. */}
                {status === "stopped" ? (
                  <Play weight="bold" />
                ) : (
                  <ArrowClockwise weight="bold" />
                )}
                {status === "stopped" ? "Resume" : "Restart"}
              </Button>
            )}

            {/* Hidden while generating — only a stopped or completed batch
              has anything to walk away from. */}
            {status !== "generating" && (
              <Button
                variant="brand-secondary"
                size="icon-sm"
                className="order-first md:order-none"
                aria-label="Close"
                onClick={goBack}
                disabled={isNavigatingBack}
              >
                {isNavigatingBack ? (
                  <SpinnerGap weight="bold" className="animate-spin" />
                ) : (
                  <CaretLeft weight="bold" />
                )}
              </Button>
            )}
          </div>
        </div>

        {generationErrorMessage ? (
          <p
            ref={generationErrorRef}
            className="flex items-center gap-dist-md text-body-md text-text-danger"
          >
            <Warning className="size-4" weight="bold" />
            {generationErrorMessage}
          </p>
        ) : (
          <p className="hidden items-center gap-dist-md text-body-md text-text-subtle md:flex">
            <Info className="size-4 text-icon-subtle" />
            Double-tap to edit posts
          </p>
        )}
      </div>

      {/* Fluid grid, same technique as the /projects folder grid
        (app/projects/page.tsx): fit as many ≥17.5rem (280px, the card's own
        width) columns as the viewport allows, then stretch them equally to
        fill the row — a fixed-width flex-wrap row left whatever didn't
        divide evenly as dead space on the right once the browser was
        maximized. auto-fill keeps empty tracks so a partial row (or a
        single generating card) still lands left-aligned instead of
        stretching alone to fill the whole row. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] content-start gap-dist-md p-pad-xs">
        {/* Each finished card mounts with the app's usual blur+opacity
          entrance, plus a subtle scale-in (0.9 → 1, the same mount-in floor
          used elsewhere — e.g. the skip-dates carousel's per-item enter in
          generate-calendar-column.tsx) rather than just popping in at full
          size. Deleting reverses those exact same classes in place (see
          exitingPostIds above) before the card actually leaves `posts` —
          onTransitionEnd is guarded to the wrapper itself so a transition
          bubbling up from inside the card (e.g. a button hover) can't
          trigger it early. flipReorder.register smoothly closes the gap
          this leaves in the grid for whichever cards shift into it, rather
          than them snapping straight to their new cell. */}
        {posts.map((post) => {
          const exiting = exitingPostIds.has(post.id)
          return (
            <div
              key={post.id}
              ref={flipReorder.register(String(post.id))}
              className={cn(
                "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 starting:blur-[8px]",
                exiting && "scale-90 opacity-0 blur-[8px]"
              )}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && exiting) {
                  finishDeletePost(post.id)
                }
              }}
            >
              <GeneratedPostCard
                content={post.content}
                onContentChange={(content) => handleContentChange(post, content)}
                topics={post.topics}
                date={post.date}
                onDateChange={(date) => handlePostDateChange(post, date)}
                onDelete={() => handleDeletePost(post)}
                onTurnToDraft={() => handleTurnToDraft(post)}
                onRegenerate={() => handleRegeneratePost(post)}
                regenerating={dialogRegeneratingId === post.id}
                account={resolvePostAccount(
                  { platform: post.social, isTryout: post.isTryout },
                  socialAccounts
                )}
                nextAccount={nextPostAccount(
                  { platform: post.social, isTryout: post.isTryout },
                  socialAccounts
                )}
                onSocialChange={(target) => handleSocialChange(post, target)}
              />
            </div>
          )
        })}

        {/* The one active card — hidden while stopped (not just paused in
          place), and naturally absent once generatedSoFar reaches count
          (nothing left to generate). Keyed on generatedSoFar so the next
          post after this one gets a genuinely fresh instance (own mount
          time, own animations) rather than reusing this one's — pausing/
          resuming within the same post doesn't change generatedSoFar, so
          it doesn't remount for that. */}
        {status !== "stopped" && generatedSoFar < count && (
          <div
            key={generatedSoFar}
            className="transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"
          >
            <GeneratingPostCard />
          </div>
        )}
      </div>
      </div>
    </>
  )
}
