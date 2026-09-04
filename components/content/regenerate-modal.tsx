"use client"

import * as React from "react"
import { CaretDown, Info, PlugCharging, SpinnerGap } from "@phosphor-icons/react"

import { SelectPill, type SelectPillOption } from "@/components/generate/select-pill"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PillTextarea } from "@/components/ui/pill-textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { BUILTIN_MODEL_ID, TASTE_TEST_MODEL_ID } from "@/lib/ai/model-constants"
import { PLATFORM_LENGTH_LIMITS } from "@/lib/post-length"
import type { PostPlatform } from "@/types/post"
import { readPreferredModel } from "@/lib/generate-settings"
import { withNetworkStatus } from "@/lib/network-status"
import { createClient } from "@/lib/supabase/client"
import { fetchUserAiModels } from "@/lib/supabase/queries"

const BADGE_CORNER_RADIUS = 8 // rad-md

export type RegenerateMode = "regenerate" | "follow-up"

// The only thing the two modes disagree about — and it is deliberately very
// little. The title and both button labels are shared: this is Regenerate in
// both cases, and a published post's version of it should not read as a
// different feature (per direct request). The whole difference is the note
// below the title, which says what actually happens, and the tooltip on it,
// which says why.
const MODE_COPY: Record<
  RegenerateMode,
  { placeholder: string; note: string | null; noteTooltip: string | null }
> = {
  regenerate: {
    placeholder: "Anything you’d like to see in the new version? (Optional)",
    note: null,
    noteTooltip: null,
  },
  "follow-up": {
    placeholder: "Anything you’d like the new draft to do differently? (Optional)",
    note: "This will create another post in your drafts",
    noteTooltip:
      "A published post can’t be edited here — it’s already live. Regenerating writes a new draft instead.",
  },
}

// Same two no-setup models as generate-card.tsx's own BUILTIN_MODEL_OPTIONS
// (kept in sync by hand, same as that file already does against
// lib/ai/generate.ts) — a user's own Connections models are appended once
// the fetch below resolves.
const BUILTIN_MODEL_OPTIONS: SelectPillOption[] = [
  { value: BUILTIN_MODEL_ID, label: "Gemini 3.6 Flash" },
  { value: TASTE_TEST_MODEL_ID, label: "TasteTest" },
]

// TasteTest returns one of a handful of fixed canned posts and never reads the
// prompt at all, so a platform length limit has no effect on it — every one of
// its posts is over a thousand characters. Offering it for a reroll aimed at X
// is offering a button that cannot succeed: the result is always refused by the
// post-reroll length check, however many times it is pressed.
function builtinModelOptions(targetPlatform?: PostPlatform): SelectPillOption[] {
  const limited = targetPlatform
    ? PLATFORM_LENGTH_LIMITS[targetPlatform] !== undefined
    : false

  return BUILTIN_MODEL_OPTIONS.map((option) =>
    limited && option.value === TASTE_TEST_MODEL_ID
      ? { ...option, disabled: true }
      : option
  )
}

// design-sync/regeneratemodal — a title, an optional free-text note on what
// the new version should do differently, a model picker ("Using X"), a
// single primary action (its label switches on whether that note is empty),
// and a static badge confirming the project's own Instructions are always
// part of the brief regardless. Left-aligned title (unlike ConfirmationModal's
// centered layout — this export isn't the same "icon + centered copy" shape).
export function RegenerateModal({
  open,
  onOpenChange,
  projectId,
  topics,
  currentTopic,
  onConfirm,
  isPending = false,
  targetPlatform,
  mode = "regenerate",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // For seeding the model pill with whichever model the Generate page last
  // ran on (lib/generate-settings.ts) — the same "no model picker of its
  // own, reuse the Generate page's preference" default day-deck.tsx's own
  // regenerate already uses, just now overridable per regenerate instead of
  // fixed.
  projectId: string
  // The project's current Instructions topics, and whichever topic this post
  // already carries. The pill offers the union of the two: a topic deleted
  // from Instructions since the post was written is still what the post is
  // about, so dropping it from the list would silently retopic the post the
  // moment you regenerated it.
  topics: string[]
  currentTopic?: string
  // The platform this reroll will be written for — the post's own, or the one
  // a refused switch is waiting on. Only used to rule out models that cannot
  // meet that platform's length limit; see disabledModelReason below.
  targetPlatform?: PostPlatform
  // The trimmed guidance text ("" when left blank), the chosen model id
  // (either a BUILTIN_MODEL_OPTIONS value or a user_ai_models row id), and
  // the topic to write about — undefined only when this project has no
  // topics at all and the post carries none either, in which case no pill is
  // shown and the prompt falls back to the post's own (absent) topic.
  onConfirm: (guidance: string, model: string, topic: string | undefined) => void
  isPending?: boolean
  // What this reroll produces. "regenerate" rewrites the post in place;
  // "follow-up" writes a brand-new draft off the back of it, which is what
  // Regenerate becomes once a post has gone out and can no longer be changed
  // (isPostLocked, lib/post-publish.ts). Only the copy differs — the brief,
  // the model pill and the topic pill are the same question either way, which
  // is exactly why this is a mode rather than a second modal.
  mode?: RegenerateMode
}) {
  // Cleared on a successful confirm (see the button below), not on every
  // open/close — closing via the X without submitting keeps the draft, same
  // as CreateProjectModal preserves its own field across a close.
  const [guidance, setGuidance] = React.useState("")

  // Read through useSyncExternalStore rather than an effect that calls
  // setState (react-hooks/set-state-in-effect) — localStorage doesn't exist
  // during this "use client" component's server-rendered first pass, so the
  // server snapshot is the safe built-in default and the real preference
  // only shows up once the client snapshot runs post-hydration. Same "server
  // snapshot differs from the client one" shape as lib/network-status.ts.
  const preferredModel = React.useSyncExternalStore(
    () => () => {},
    () => readPreferredModel(projectId) ?? BUILTIN_MODEL_ID,
    () => BUILTIN_MODEL_ID
  )
  // Picking a different model here is a one-off for this regenerate only —
  // it deliberately does not write back to the stored preference, so this
  // stays local override state rather than replacing preferredModel above.
  // null (not yet touched) falls back to whatever was actually preferred.
  const [modelOverride, setModelOverride] = React.useState<string | null>(null)
  const model = modelOverride ?? preferredModel

  // Connections models the user added — fetched with the browser client
  // since this modal (like generate-card.tsx) has no server-rendered props
  // to receive them through. The built-ins render immediately; these append
  // once the fetch resolves. Non-fatal on failure: the built-ins stay
  // selectable, and Connections is where a broken model list actually gets
  // diagnosed (a connectivity failure never reaches the catch — withNetworkStatus
  // turns it into a null result and raises the toast instead).
  const [userModelOptions, setUserModelOptions] = React.useState<SelectPillOption[]>([])
  React.useEffect(() => {
    let cancelled = false
    void withNetworkStatus(fetchUserAiModels(createClient()))
      .then((models) => {
        if (models === null || cancelled) return
        setUserModelOptions(
          models.map((userModel) => ({ value: userModel.id, label: userModel.label }))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const modelOptions = React.useMemo(
    () => [...builtinModelOptions(targetPlatform), ...userModelOptions],
    [userModelOptions, targetPlatform]
  )
  // Falls back to the first built-in rather than a non-null assertion: the
  // restored `model` above could in principle name a since-deleted
  // Connections model before this list finishes loading.
  const found = modelOptions.find((option) => option.value === model)
  // A disabled option falls back too, not just a missing one: the persisted
  // preference is per project, so arriving here with TasteTest already
  // selected is the common case for anyone who last generated with it — and
  // confirming a greyed-out model would start a reroll that cannot succeed.
  const selectedModel =
    found && !found.disabled ? found : modelOptions[0] ?? BUILTIN_MODEL_OPTIONS[0]

  // The post's own topic leads, then the project's, deduped — so the pill
  // opens on what this post is already about and the rest are alternatives.
  const topicOptions = React.useMemo<SelectPillOption[]>(() => {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const topic of [currentTopic, ...topics]) {
      if (!topic || seen.has(topic)) continue
      seen.add(topic)
      ordered.push(topic)
    }
    return ordered.map((topic) => ({ value: topic, label: topic }))
  }, [currentTopic, topics])

  // Same one-off-override shape as the model above: picking here applies to
  // this regenerate, and reverts to the post's own topic next time.
  const [topicOverride, setTopicOverride] = React.useState<string | null>(null)
  const topic = topicOverride ?? topicOptions[0]?.value

  const { ref: badgeRef, style: badgeStyle } = useSquircleClipPath<HTMLDivElement>(
    { cornerRadius: BADGE_CORNER_RADIUS }
  )

  const hasGuidance = guidance.trim().length > 0
  const copy = MODE_COPY[mode]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent popupClassName="w-90">
        <DialogTitle>Regenerate post</DialogTitle>
        {/* Sits with the title rather than floating between it and the field:
            the dialog's own gap-dist-lg is 16px, and this is a caption on the
            heading, so -mt-dist-md cancels half of it. The icon goes to its
            right, per direct request — the other info lines in the app lead
            with it, but here the sentence is the thing being read and the icon
            is the offer of more. */}
        {copy.note ? (
          <p className="-mt-dist-md flex items-center gap-dist-sm text-body-md text-text-subtle">
            {copy.note}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="Why this creates a draft"
                    className="flex cursor-pointer items-center text-icon-subtle transition-colors duration-150 ease-out outline-none hover:text-icon-bold focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Info className="size-4" />
                  </button>
                }
              />
              {/* Capped and wrapping: a sentence this long renders as one
                  ~440px line by default, which reaches past the dialog and
                  sits on its close button. Every other tooltip in the app is
                  a couple of words, so this is the one that needs a width. */}
              <TooltipContent className="max-w-64 text-balance whitespace-normal">
                {copy.noteTooltip}
              </TooltipContent>
            </Tooltip>
          </p>
        ) : null}
        <PillTextarea
          name="guidance"
          placeholder={copy.placeholder}
          value={guidance}
          onChange={(event) => setGuidance(event.target.value)}
          disabled={isPending}
        />
        {/* The export's own pill is a bordered surface-4 capsule, not the
            Generate page's borderless surface-3 one — SelectPill's default
            stays unchanged for that page; this is the one call site so far
            that overrides it. The hover tint is overridden alongside the
            fill for the same reason: SelectPill's own hover mixes toward
            surface-3, which would look wrong against a surface-4 rest state. */}
        <SelectPill
          options={modelOptions}
          value={model}
          onChange={setModelOverride}
          ariaLabel="AI model"
          className="h-10 w-full justify-center border-[length:var(--stroke-lg)] border-border-subtle bg-surface-4 hover:bg-[color-mix(in_oklch,var(--surface-4),var(--foreground)_5%)]"
        >
          <span className="text-text-subtle">Using</span>
          <span className="text-text-bold">{selectedModel.label}</span>
          <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
        </SelectPill>
        {/* The export's second pill, identical to the model one above but
            naming the subject. Regenerating is where changing a post's topic
            belongs (per direct request): it is the one action that rewrites
            the post outright, so a new subject produces a post that actually
            matches it — where changing the topic anywhere else would leave
            the label disagreeing with the words.

            Hidden entirely when there is nothing to choose between: no
            project topics and none on the post. A pill offering one option
            that is already selected is just a dead control. */}
        {topicOptions.length > 0 && topic !== undefined && (
          <SelectPill
            options={topicOptions}
            value={topic}
            onChange={setTopicOverride}
            ariaLabel="Topic"
            className="h-10 w-full justify-center border-[length:var(--stroke-lg)] border-border-subtle bg-surface-4 hover:bg-[color-mix(in_oklch,var(--surface-4),var(--foreground)_5%)]"
          >
            <span className="text-text-subtle">Topic</span>
            <span className="truncate text-text-bold">{topic}</span>
            <CaretDown className="size-4 shrink-0 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
          </SelectPill>
        )}
        <Button
          variant="brand"
          size="xl"
          className="w-full"
          disabled={isPending}
          onClick={() => {
            // selectedModel, not `model` — see its fallback above.
            onConfirm(guidance.trim(), selectedModel.value, topic)
            setGuidance("")
            // Both revert to their defaults next time this opens, rather than
            // staying stuck on a one-off pick from just now.
            setModelOverride(null)
            setTopicOverride(null)
          }}
        >
          {isPending ? (
            <SpinnerGap weight="bold" className="animate-spin" />
          ) : hasGuidance ? (
            "Regenerate"
          ) : (
            "Just regenerate"
          )}
        </Button>
        {/* Always on — this app's Instructions are never optional, so this is
            purely reassurance that the note above is *additional* guidance,
            not a replacement for the project's own voice/rules. -mt-px is the
            export's own -1 gap: the icon sits slightly tucked into the pill's
            top edge rather than flush above it. */}
        <div className="flex flex-col items-center">
          <PlugCharging weight="bold" className="z-10 size-5 text-icon-minimal" />
          <div
            ref={badgeRef}
            style={badgeStyle}
            className="-mt-px rounded-rad-md border-[length:var(--stroke-lg)] border-gray-200 bg-surface-4 px-pad-md py-pad-2xs text-body-md text-text-minimal"
          >
            Instructions plugged in
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
