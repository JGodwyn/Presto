"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X } from "@phosphor-icons/react"

import {
  deletePost,
  regeneratePost,
  updatePost,
} from "@/app/projects/[projectId]/generate/post-actions"
import { GeneratedPostCard } from "@/components/generate/generated-post-card"
import {
  nextPostAccount,
  resolvePostAccount,
  type PostAccountTarget,
} from "@/lib/post-account"
import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { useFlipReorder } from "@/hooks/use-flip-reorder"
import { generationFailureCopy } from "@/lib/ai/failure-copy"
import { BUILTIN_MODEL_ID } from "@/lib/ai/generate"
import { readPreferredModel } from "@/lib/generate-settings"
import { reportNetworkIssue, withNetworkStatus } from "@/lib/network-status"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"
import type { ConnectedSocialAccount } from "@/types/social-account"

// The strong ease-out from .agents/skills/review-animations/STANDARDS.md —
// entering and exiting both use it ("never ease-in on UI": it delays the
// exact moment the user is watching).
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"

// The deck's motion, tuned on a DialKit panel and then frozen here — same
// treatment as toast.tsx's entrance and use-shake.ts (git history has the
// panel if any of this ever needs re-tuning).
//
// The exit running longer than the entrance inverts the usual asymmetry, and
// is deliberate: the cards have further to travel back into a single chip than
// they did fanning out of it.
//
//   MAX_STAGGER_MS  written for short lists; a 20-post day would run past a
//               second at 80ms each, so the total is capped. Past the cap the
//               remaining cards share the last step, which still reads as a
//               fan rather than a block.
//   bounce      how far past its resting scale a card carries before settling
//               — a scale ratio, not a spring's bounce parameter, so
//               STANDARDS' "keep bounce 0.1-0.3" doesn't map onto it directly.
//               Settled at 0: the deck reads better as a clean fan than a
//               springy one, with the wider stagger carrying the "dealt one
//               after another" feel instead. Anything above 0 puts the
//               overshoot keyframe back (see enterKeyframes/exitKeyframes).
//   tilt        degrees per card off centre while still stacked on the chip.
const ENTER_MS = 400
const ENTER_STAGGER_MS = 80
const ENTER_BOUNCE = 0
const EXIT_MS = 480
const EXIT_STAGGER_MS = 80
const EXIT_BOUNCE = 0
const MAX_STAGGER_MS = 270
const TILT_STEP_DEG = 8

// The fan never opens wider than three steps' worth of tilt, whatever
// TILT_STEP_DEG above is set to.
const MAX_TILT_STEPS = 3

// Backstop for the unmount if a WAAPI `finished` promise never settles — a
// backgrounded tab suspends animations and their completion events, the same
// trap the skip-dates carousel's exit hit (see generate-calendar-column.tsx).
const CLOSE_FALLBACK_BUFFER_MS = 120

// The elastic overshoot springing back after a drag (hooks/use-drag-scroll.ts)
// — the strong ease-in-out this codebase uses for on-screen movement.
const ELASTIC_SETTLE_MS = 200
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)"

// The card's own height (`h-98`) and the gap under the row, both kept in sync
// by hand with the classes below — they place the Close button now that the
// cards' container fills the whole overlay rather than sitting in a column
// with it.
const CARD_HEIGHT_PX = 392
const CLOSE_BUTTON_GAP_PX = 48

// The scrim and the close button. Entry rides `@starting-style` (no JS, and
// nothing to miss if the tab is backgrounded at the moment it opens — an
// rAF-driven class flip silently never fires there, leaving the scrim
// invisible); exit is a class flip against the same transition.
const CHROME_MS = 200

export interface DeckOrigin {
  left: number
  top: number
  width: number
  height: number
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// Where a card sits while it's still part of the deck: centred on the chip
// that was clicked, shrunk to that chip's width, and turned a few degrees.
// Measured per card at the moment it animates, so it stays correct after the
// row has been scrolled.
function collapsedTransform(
  element: HTMLElement,
  origin: DeckOrigin,
  index: number,
  count: number,
  tiltStepDeg: number,
): string {
  const rect = element.getBoundingClientRect()
  const dx = origin.left + origin.width / 2 - (rect.left + rect.width / 2)
  const dy = origin.top + origin.height / 2 - (rect.top + rect.height / 2)
  // The chip's real width over the card's — the card genuinely is the size of
  // the thing it came out of, which is what sells the spatial link. (Nothing
  // here starts at scale 0; the floor is the chip's own footprint.)
  const scale = origin.width / rect.width
  const middle = (count - 1) / 2
  const maxTilt = tiltStepDeg * MAX_TILT_STEPS
  const tilt = Math.max(
    -maxTilt,
    Math.min(maxTilt, (index - middle) * tiltStepDeg),
  )
  return `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${tilt}deg)`
}

// The resting state, written as the same transform-function list the
// collapsed state uses so every keyframe interpolates function-for-function
// (a bare `none` would make the browser fall back to matrix interpolation).
const RESTING_TRANSFORM = "translate(0px, 0px) scale(1) rotate(0deg)"

function overshootTransform(bounce: number): string {
  return `translate(0px, 0px) scale(${1 + bounce}) rotate(0deg)`
}

// Out of the chip and into place: the card fades in over the first third of
// its flight (legible for most of the travel rather than materialising as it
// lands), then carries `bounce` past its resting scale before settling.
function enterKeyframes(collapsed: string, bounce: number): Keyframe[] {
  const frames: Keyframe[] = [
    { transform: collapsed, opacity: 0 },
    { opacity: 1, offset: 0.35 },
  ]
  if (bounce > 0) {
    frames.push({ transform: overshootTransform(bounce), offset: 0.72 })
  }
  frames.push({ transform: RESTING_TRANSFORM, opacity: 1 })
  return frames
}

// Back into the chip, with the same overshoot read as a wind-up: the card
// swells slightly before it's pulled home.
function exitKeyframes(collapsed: string, bounce: number): Keyframe[] {
  const frames: Keyframe[] = [{ transform: RESTING_TRANSFORM, opacity: 1 }]
  if (bounce > 0) {
    frames.push({ transform: overshootTransform(bounce), offset: 0.22 })
  }
  frames.push({ opacity: 1, offset: 0.4 })
  frames.push({ transform: collapsed, opacity: 0 })
  return frames
}

// Cards nearest the middle of the row resolve first and the flanks follow, so
// the deck reads as opening outwards from the chip rather than being dealt
// left-to-right. Closing runs the same order backwards.
function stepsFromMiddle(index: number, count: number): number {
  // Floor, not round: an even-numbered deck has no single middle card, and
  // rounding would put its innermost *pair* on step 1 — delaying the whole
  // deck by one beat before anything moved.
  return Math.floor(Math.abs(index - (count - 1) / 2))
}

function enterDelay(
  index: number,
  count: number,
  stagger: number,
  MAX_STAGGER_MS: number,
): number {
  return Math.min(stepsFromMiddle(index, count) * stagger, MAX_STAGGER_MS)
}

// The mirror of enterDelay: whatever went out first comes home last.
function exitDelay(
  index: number,
  count: number,
  stagger: number,
  MAX_STAGGER_MS: number,
): number {
  const steps = stepsFromMiddle(0, count) - stepsFromMiddle(index, count)
  return Math.min(steps * stagger, MAX_STAGGER_MS)
}

// The longest delay any card in the deck waits — an outermost card entering,
// or a middle card leaving. Both work out to the same arithmetic, since the
// two orders are mirrors of each other.
function longestDelay(
  count: number,
  stagger: number,
  MAX_STAGGER_MS: number,
): number {
  return Math.min(stepsFromMiddle(0, count) * stagger, MAX_STAGGER_MS)
}

export function DayDeck({
  projectId,
  accounts,
  activeTopics,
  dateLabel,
  posts,
  origin,
  dayKey,
  keyForPost,
  onClose,
  onPostsChange,
}: {
  projectId: string
  // This project's connected accounts, and its current Instructions topics —
  // what a card needs to name its account rather than its platform, and to
  // tell a live topic chip from a deleted one. See ContentView's own notes.
  accounts: ConnectedSocialAccount[]
  activeTopics: Set<string>
  // Read out to screen readers as the dialog's name, e.g. "July 5, 2026".
  dateLabel: string
  // Just this day's posts, already filtered and ordered by the caller. The
  // deck closes itself if this ever empties (every post deleted or moved to
  // another day from inside it).
  posts: Post[]
  // The clicked chip's viewport rect, captured at click time — every card
  // flies out of, and back into, this exact box.
  origin: DeckOrigin
  // This deck's own day, and how to work out where any post belongs after an
  // edit (lib/content-grouping.ts). Together they answer the one question an
  // edit raises here: does this post still belong to this day? A new date can
  // move it to another day, to another tab, or off every tab — and that
  // decides whether its card flies home or just updates in place.
  dayKey: string
  keyForPost: (post: Post) => string | null
  onClose: () => void
  // The caller owns the post list; the deck writes its optimistic updates
  // straight into it, same shape as a setState updater.
  onPostsChange: (updater: (prev: Post[]) => Post[]) => void
}) {
  const router = useRouter()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const animations = React.useRef(new Map<string, Animation>())
  const openedRef = React.useRef(false)
  const [closing, setClosing] = React.useState(false)
  const [toastOpen, setToastOpen] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState("")
  // Split from the message so it can't blank out mid-exit-animation, same as
  // the message itself.
  const [toastExtraInfo, setToastExtraInfo] = React.useState<string | undefined>(
    undefined
  )

  // How long the whole put-away takes, last card included — what the scrim
  // waits for before it starts fading (see its own note below), and what the
  // unmount backstop is measured against. The last card home is the *middle*
  // one, not the first: the flanks leave first on the way out.
  const exitTotalMs =
    EXIT_MS + longestDelay(posts.length, EXIT_STAGGER_MS, MAX_STAGGER_MS)

  const dragScroll = useDragScroll()

  const showError = (message: string, extraInfo?: string) => {
    setToastMessage(message)
    setToastExtraInfo(extraInfo)
    setToastOpen(true)
  }

  // A string, not the array: `posts` is rebuilt every render, and these
  // callbacks must only change when the set of cards actually does.
  const postIdsKey = posts.map((post) => post.id).join(",")

  // Closes the gap when a card leaves: the row is centred (`mx-auto w-max`),
  // so losing one shifts every remaining card — the ones after it move left,
  // the ones before it move right as the whole row re-centres — and a reflow
  // is not something CSS can transition on its own. Same hook, same 150ms
  // quick-move curve as the Generate page's grid. It measures offsetLeft
  // rather than viewport rects, which matters here: this row scrolls and
  // carries an elastic drag transform, and neither should read as a layout
  // move (see the hook's own note).
  //
  // skipOnGrowth, as on that grid: this list only ever shrinks, apart from a
  // failed delete putting its card back, which shouldn't displace anything.
  const { register: registerFlip } = useFlipReorder(
    posts.map((post) => post.id),
    { skipOnGrowth: true },
  )

  // Ordered the way the DOM is, so index/count below match what's on screen.
  // Read out of the DOM by data-post-id rather than kept in a ref map of its
  // own: the wrappers already carry the FLIP hook's ref, and composing a
  // second one meant caching a callback per id, which is a ref read during
  // render (react-hooks/refs). Only ever called from effects and handlers.
  const orderedCards = React.useCallback(
    () =>
      postIdsKey
        .split(",")
        .map((id, index) => ({
          id,
          index,
          element:
            scrollRef.current?.querySelector<HTMLElement>(
              `[data-post-id="${id}"]`,
            ) ?? undefined,
        }))
        .filter(
          (
            entry,
          ): entry is { id: string; index: number; element: HTMLElement } =>
            entry.element !== undefined,
        ),
    [postIdsKey],
  )

  // The deal-out. useLayoutEffect so the collapsed transform is applied in the
  // same frame the cards first paint — a plain effect would show them at full
  // size for a frame before snapping back onto the chip. Runs once per open,
  // and deliberately isn't keyed on the card set: a delete mustn't re-deal the
  // whole deck.
  React.useLayoutEffect(() => {
    if (openedRef.current) return
    openedRef.current = true

    // A deck too wide for the screen opens on its middle, bleeding off both
    // edges (the export's own framing), rather than pinned to its first card:
    // auto margins collapse to 0 once the row overflows, so centring is a
    // scroll position, not a layout property. Done before the cards are
    // measured below, so they fan out to where they'll actually rest.
    const scroller = scrollRef.current
    if (scroller) {
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
    }

    const cards = orderedCards()
    const count = cards.length
    const reduced = prefersReducedMotion()

    for (const { id, index, element } of cards) {
      // A replay has to clear the previous animation first, or the old one's
      // filled end state fights the new one's keyframes.
      animations.current.get(id)?.cancel()

      const delay = reduced
        ? 0
        : enterDelay(index, count, ENTER_STAGGER_MS, MAX_STAGGER_MS)
      // Reduced motion keeps the fade (it explains where the content came
      // from) and drops the travel, per STANDARDS' accessibility note.
      //
      // The transform is a full string, not Motion's x/y/scale shorthands:
      // WAAPI hands this to the compositor, which matters with a dozen-plus
      // cards moving at once.
      const keyframes = reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : enterKeyframes(
            collapsedTransform(element, origin, index, count, TILT_STEP_DEG),
            ENTER_BOUNCE,
          )

      const animation = element.animate(keyframes, {
        duration: reduced ? CHROME_MS : ENTER_MS,
        delay,
        easing: EASE_OUT,
        fill: "both",
      })
      animations.current.set(id, animation)

      // Dropping the animation once it lands matters at this scale: `fill:
      // both` keeps every one of them alive and holding a transform, which
      // keeps a compositor layer per card for as long as the deck is open.
      // The final keyframe is the element's own resting state, so cancelling
      // changes nothing visually.
      animation.finished.then(
        () => {
          if (animations.current.get(id) !== animation) return
          animation.cancel()
          animations.current.delete(id)
        },
        () => {
          // Cancelled by the close below — nothing to clean up.
        },
      )
    }
  }, [orderedCards, origin])

  const startClose = React.useCallback(() => {
    setClosing(true)
  }, [setClosing])

  // Run once the put-away has finished and the deck is unmounting. "Open up"
  // is the only thing that uses it: the deck should be seen to close before
  // the page underneath it changes, rather than the whole overlay vanishing
  // mid-flight. A ref rather than state because nothing renders from it and
  // the close effect below reads it at the end of an animation, well after
  // the render that set it.
  const afterClose = React.useRef<(() => void) | null>(null)

  const closeThenOpen = (postId: string) => {
    const href = `/projects/${projectId}/calendar/${postId}`
    // Warms the route during the close, so the ~half second the cards spend
    // flying home is spent fetching rather than added to the wait.
    router.prefetch(href)
    afterClose.current = () => router.push(href)
    startClose()
  }

  // Edits that take a post off this day don't remove its card outright — the
  // card flies home into the chip first, exactly the way it would if the whole
  // deck were closing, and the change is only handed to the caller once it
  // has. Keeping the change pending until then is what keeps the card on
  // screen to animate: the moment the caller's list stops including this post,
  // its card unmounts and there's nothing left to animate.
  const pendingCommits = React.useRef(new Map<string, () => void>())

  const runPendingCommit = (postId: string) => {
    const commit = pendingCommits.current.get(postId)
    if (!commit) return
    pendingCommits.current.delete(postId)
    commit()
  }

  // A server call that failed after its card already started leaving: drop the
  // pending change and put the card back. Cancelling the animation snaps it
  // home rather than flying it back — a rare enough path that the abruptness
  // is worth not building a second animation for.
  const cancelLeave = (postId: string) => {
    pendingCommits.current.delete(postId)
    animations.current.get(postId)?.cancel()
    animations.current.delete(postId)
  }

  // One card's put-away, on its own — same keyframes, dials and origin as the
  // full close, just without a stagger to wait for.
  const animateCardHome = React.useCallback(
    (postId: string) => {
      const cards = orderedCards()
      const index = cards.findIndex((entry) => entry.id === postId)
      const element = cards[index]?.element
      if (!element) return Promise.resolve()

      animations.current.get(postId)?.cancel()
      const reduced = prefersReducedMotion()
      const duration = reduced ? CHROME_MS : EXIT_MS
      const keyframes = reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : exitKeyframes(
            collapsedTransform(element, origin, index, cards.length, TILT_STEP_DEG),
            EXIT_BOUNCE,
          )

      const animation = element.animate(keyframes, {
        duration,
        easing: EASE_OUT,
        fill: "both",
      })
      animations.current.set(postId, animation)

      // Same backstop as the full close — a suspended tab never settles
      // `finished`, and the change must not be stranded with it.
      return Promise.race([
        animation.finished.catch(() => {}),
        new Promise((resolve) =>
          setTimeout(resolve, duration + CLOSE_FALLBACK_BUFFER_MS),
        ),
      ])
    },
    [orderedCards, origin],
  )

  const leaveDeck = (postId: string, commit: () => void) => {
    pendingCommits.current.set(postId, commit)
    // The last card takes the deck with it: the same put-away, plus the scrim,
    // rather than animating one card away and leaving an empty overlay up.
    if (posts.length <= 1) {
      startClose()
      return
    }
    void animateCardHome(postId).then(() => runPendingCommit(postId))
  }

  // The put-away: same flight, reversed, flanks first.
  React.useEffect(() => {
    if (!closing) return

    const cards = orderedCards()
    const count = cards.length
    const reduced = prefersReducedMotion()

    const finished = cards.map(({ id, index, element }) => {
      // A close that lands mid-open would otherwise measure a rect that's
      // still moving. Cancelling first snaps that card back to its resting
      // slot for a frame — only reachable by closing inside the first ~half
      // second, and the alternative (reading a moving rect) sends it to the
      // wrong place entirely.
      animations.current.get(id)?.cancel()

      const delay = reduced
        ? 0
        : exitDelay(index, count, EXIT_STAGGER_MS, MAX_STAGGER_MS)
      const keyframes = reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : exitKeyframes(
            collapsedTransform(element, origin, index, count, TILT_STEP_DEG),
            EXIT_BOUNCE,
          )

      const animation = element.animate(keyframes, {
        duration: reduced ? CHROME_MS : EXIT_MS,
        delay,
        easing: EASE_OUT,
        fill: "both",
      })
      animations.current.set(id, animation)
      return animation.finished
    })

    let done = false
    const finish = () => {
      if (done) return
      done = true
      // Anything that was waiting on a card's own put-away (a date change, a
      // delete) lands now — the deck is going away, so there's nothing left
      // to animate it out of.
      const commits = [...pendingCommits.current.values()]
      pendingCommits.current.clear()
      for (const commit of commits) commit()
      onClose()
      const after = afterClose.current
      afterClose.current = null
      after?.()
    }

    // allSettled, not all: `all` rejects the moment any one animation is
    // cancelled, and a rejection here would unmount the whole deck — cutting
    // every *other* card's flight short — rather than waiting for them.
    void Promise.allSettled(finished).then(finish)
    // Backstop for a `finished` that never settles at all (a backgrounded tab
    // suspends animations and their events).
    const fallback = setTimeout(
      finish,
      (reduced ? CHROME_MS : exitTotalMs) + CLOSE_FALLBACK_BUFFER_MS,
    )

    return () => clearTimeout(fallback)
  }, [closing, onClose, orderedCards, origin, exitTotalMs])

  // Escape closes, and the whole overlay takes focus on mount so the keypress
  // lands here rather than on whatever was focused behind it. Focus goes back
  // to the chip in the caller's own onClose.
  const containerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    containerRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        startClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [startClose])

  // Emptying the deck from inside it (deleting the last post, or moving it to
  // another day) is handled by the caller, which stops rendering a day that
  // has no posts — so this component simply unmounts, without the put-away
  // animation. Deliberate: playing it would mean holding a deck of nothing on
  // screen while it ran.

  const patchPost = (id: string, patch: Partial<Post>) =>
    onPostsChange((prev) =>
      prev.map((post) => (post.id === id ? { ...post, ...patch } : post)),
    )

  const handleDateChange = (post: Post, date: Date) => {
    const previous = { scheduledFor: post.scheduledFor, status: post.status }
    const patch = {
      scheduledFor: date.toISOString(),
      status: "scheduled" as const,
    }
    const commit = () => patchPost(post.id, patch)

    // Picking the same day again (or another day that still lands in this
    // group) leaves the card where it is; anything else is a departure.
    if (keyForPost({ ...post, ...patch }) === dayKey) commit()
    else leaveDeck(post.id, commit)

    void withNetworkStatus(updatePost({ projectId, id: post.id, patch })).then(
      (result) => {
        if (result === null || "error" in result) {
          cancelLeave(post.id)
          patchPost(post.id, previous)
          if (result !== null) showError("Couldn't save that date")
        }
      },
    )
  }

  // Always a departure: only a dated post offers this, and losing its date
  // moves it to the Draft tab.
  const handleTurnToDraft = (post: Post) => {
    const previous = { scheduledFor: post.scheduledFor, status: post.status }
    const patch = { scheduledFor: null, status: "draft" as const }
    leaveDeck(post.id, () => patchPost(post.id, patch))

    void withNetworkStatus(updatePost({ projectId, id: post.id, patch })).then(
      (result) => {
        if (result === null || "error" in result) {
          cancelLeave(post.id)
          patchPost(post.id, previous)
          if (result !== null) showError("Couldn't turn that post into a draft")
        }
      },
    )
  }

  // The one place this deck departs from the app's optimistic-delete
  // convention (AGENTS.md): the card still goes immediately, it just goes by
  // flying home into the chip first rather than blinking out. The server call
  // fires straight away either way, so a failure still surfaces at once.
  const handleDelete = (post: Post) => {
    leaveDeck(post.id, () =>
      onPostsChange((prev) => prev.filter((entry) => entry.id !== post.id)),
    )

    void withNetworkStatus(deletePost({ projectId, id: post.id })).then(
      (result) => {
        if (result === null || "error" in result) {
          cancelLeave(post.id)
          onPostsChange((prev) =>
            prev.some((entry) => entry.id === post.id) ? prev : [...prev, post],
          )
          if (result !== null) showError("Couldn't delete that post")
        }
      },
    )
  }

  // Platform and isTryout move together: "Try out" is a cycle position rather
  // than a platform of its own, so a switch always writes both.
  const handleSocialChange = (post: Post, target: PostAccountTarget) => {
    const previous = { platform: post.platform, isTryout: post.isTryout }
    const patch = { platform: target.platform, isTryout: target.isTryout }
    patchPost(post.id, patch)
    void withNetworkStatus(
      updatePost({ projectId, id: post.id, patch }),
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost(post.id, previous)
        if (result !== null) showError("Couldn't change that post's account")
      }
    })
  }

  const handleContentChange = (post: Post, content: string) => {
    const previous = post.content
    patchPost(post.id, { content })
    void withNetworkStatus(
      updatePost({ projectId, id: post.id, patch: { content } }),
    ).then((result) => {
      if (result === null || "error" in result) {
        patchPost(post.id, { content: previous })
        if (result !== null) showError("Couldn't save your edit")
      }
    })
  }

  // Awaited, not optimistic — there's nothing to show until the model has
  // produced it, and the card holds its own placeholder for exactly this long
  // (same contract as the Generating page's own regenerate).
  const handleRegenerate = async (post: Post) => {
    // This screen has no model picker of its own, so it reuses whichever
    // model the Generate page last ran on — a BYOK user's reroll should keep
    // running on their own key.
    const model = readPreferredModel(projectId) ?? BUILTIN_MODEL_ID
    const result = await withNetworkStatus(
      regeneratePost({ projectId, id: post.id, model }),
    )
    if (result === null) return
    if ("error" in result) {
      if (result.reason === "network") reportNetworkIssue()
      else {
        // A quota hit is the model refusing, not us failing — say so rather
        // than hiding it behind the action's own generic line.
        const { message, extraInfo } = generationFailureCopy(result.reason, {
          message: result.error,
        })
        showError(message, extraInfo)
      }
      return
    }
    patchPost(post.id, { content: result.post.content })
  }

  // Portalled to <body>, and it has to be: GlowPanel carries a clip-path (the
  // squircle), and any clip-path other than `none` makes that element the
  // containing block for its fixed-position descendants — so rendered in
  // place, this "fixed inset-0" overlay laid itself out inside the panel and
  // was then cropped by the panel's own overflow-hidden. Same reason the
  // app's dialogs go through Base UI's Portal.
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Posts for ${dateLabel}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 outline-none"
    >
      {/* The app's standard modal scrim (identical treatment to dialog.tsx's
          backdrop, which is what the export draws here too). Clicking it
          closes, same as the Close button. */}
      {/* The scrim holds at full strength until the cards are almost home,
          then clears in its own CHROME_MS — it can't just fade on its own
          200ms clock, because a long deck's put-away runs several times that
          and the backdrop was disappearing while cards were still flying
          across a fully lit page. */}
      <div
        onClick={startClose}
        style={{
          transitionDuration: `${CHROME_MS}ms`,
          transitionDelay: closing
            ? `${Math.max(0, exitTotalMs - CHROME_MS)}ms`
            : "0ms",
        }}
        className={cn(
          "absolute inset-0 bg-black/25 opacity-100 backdrop-blur-[8px] transition-opacity ease-out starting:opacity-0",
          closing && "opacity-0",
        )}
      />

      {/* The cards get the whole overlay as their scroll container, rather
          than a box drawn around the row.
          `overflow-x: auto` forces overflow-y to `auto` too (an axis can't
          stay visible once the other one scrolls), so this box clips
          vertically whether or not anything ever scrolls that way — and every
          card's flight starts and ends at the chip, which can sit hundreds of
          pixels above or below the row. Padding the box out (the previous fix)
          only ever buys a fixed amount of headroom; making it the viewport
          means the clip edge *is* the screen edge, and the chip is by
          definition on screen. The Close button below is positioned rather
          than laid out in a column with this, since this now fills everything.

          pointer-events: the container itself is transparent to them so a
          click on empty space still reaches the scrim and closes the deck;
          the row re-enables them, and a drag starting on a card still bubbles
          up to the handlers here.

          The row overflows the viewport on both sides by design. w-max +
          mx-auto centres a short row without the justify-center overflow bug
          (which cuts off the leading items).

          Drag-to-scroll on top of the wheel/trackpad scrolling overflow-x-auto
          already gives — the same shared gesture the skip-dates carousel uses,
          including the 4px threshold that keeps a tap on a card's button from
          being swallowed, and the resisted overshoot at either end.
          select-none only while a drag is actually running, so text inside a
          card stays selectable (and the double-tap-to-edit textarea keeps
          working) the rest of the time. */}
      <div
        ref={scrollRef}
        onPointerDown={dragScroll.onPointerDown}
        onPointerMove={dragScroll.onPointerMove}
        onPointerUp={dragScroll.onPointerUp}
        onPointerCancel={dragScroll.onPointerCancel}
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center overflow-x-auto overscroll-contain",
          dragScroll.isDragging && "cursor-grabbing select-none",
          HIDE_NATIVE_SCROLLBAR_CLASSNAME,
        )}
      >
          {/* The elastic overshoot rides its own wrapper rather than the row
              itself, and that placement is what makes the gap-close work: a
              transformed element becomes its descendants' offsetParent, so
              with the transform on the row, every card's offsetLeft was
              measured *inside* the row — cards after a removal would show a
              delta, but cards before it read zero even though the whole row
              re-centres and visibly shifts them. Measured from here, the
              row's own re-centring is part of what each card sees. */}
        <div
          style={{
            transform: `translateX(${dragScroll.elasticOffset}px)`,
            // No transition while actively dragging — the offset has to
            // track the pointer 1:1. Only the release springs back.
            transition: dragScroll.isDragging
              ? "none"
              : `transform ${ELASTIC_SETTLE_MS}ms ${EASE_IN_OUT}`,
          }}
          // Full width, never w-max: the row inside is what re-centres when a
          // card leaves, and FLIP measures against this box (see above).
          className="w-full"
        >
          <div className="pointer-events-auto mx-auto flex w-max items-center gap-dist-lg px-pad-2xl">
              {posts.map((post) => (
                <div
                  key={post.id}
                  ref={registerFlip(post.id)}
                  data-post-id={post.id}
                  className="w-68 shrink-0"
                >
                  <Tooltip>
                    <TooltipTrigger render={<div />}>
                      <GeneratedPostCard
                        className="h-98 min-w-0"
                        content={post.content}
                        onContentChange={(content) =>
                          handleContentChange(post, content)
                        }
                        topics={post.topics}
                        activeTopics={activeTopics}
                        date={
                          post.scheduledFor
                            ? new Date(post.scheduledFor)
                            : undefined
                        }
                        onDateChange={(date) => handleDateChange(post, date)}
                        onDelete={() => handleDelete(post)}
                        onTurnToDraft={() => handleTurnToDraft(post)}
                        onOpen={() => closeThenOpen(post.id)}
                        onRegenerate={() => handleRegenerate(post)}
                        account={resolvePostAccount(post, accounts)}
                        nextAccount={nextPostAccount(post, accounts)}
                        onSocialChange={(target) =>
                          handleSocialChange(post, target)
                        }
                      />
                    </TooltipTrigger>
                    <TooltipContent>Double-tap to edit post</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* Lands after the deck has finished opening — it's the way out, not
          part of the content, so it shouldn't compete with the cards for
          attention on the way in.
          Positioned rather than stacked under the row: the cards' container
          fills the overlay now, so there's no column left to sit in. The
          offset is half a card plus the gap that column used to provide —
          both hand-synced with the card's own `h-98` and `gap-dist-4xl`. */}
      <div
        style={{
          top: `calc(50% + ${CARD_HEIGHT_PX / 2 + CLOSE_BUTTON_GAP_PX}px)`,
          transitionDuration: `${CHROME_MS}ms`,
          // Waits for the deck on the way in; leaves immediately on the way
          // out, since by then it's the thing being dismissed.
          transitionDelay: closing ? "0ms" : `${MAX_STAGGER_MS}ms`,
        }}
        className={cn(
          "absolute inset-x-0 flex translate-y-0 justify-center opacity-100 transition-[opacity,translate] ease-out starting:translate-y-2 starting:opacity-0",
          closing && "translate-y-2 opacity-0",
        )}
      >
        <Button variant="danger" size="xl" onClick={startClose}>
          <X weight="bold" />
          Close
        </Button>
      </div>

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
    </div>,
    document.body,
  )
}
