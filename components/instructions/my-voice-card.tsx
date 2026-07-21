"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import type { UseFormRegisterReturn } from "react-hook-form"
import { Eye, EyeClosed, Info } from "@phosphor-icons/react"

import {
  saveInstructions,
  type SaveInstructionsInput,
} from "@/app/projects/[projectId]/instructions/actions"
import { PillTextarea } from "@/components/ui/pill-textarea"
import { Switch } from "@/components/ui/switch"
import { Toast } from "@/components/ui/toast"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import { TopicPicker } from "@/components/instructions/topic-picker"
import { useSaveQueue } from "@/hooks/use-save-queue"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"
import type { Instructions } from "@/types/instructions"

interface VoiceFormValues {
  singlePromptText: string
  tone: string
  contentRules: string
  postStructure: string
  whatToAvoid: string
}

// The Figma export only shows Tone expanded; the other fields' placeholders
// come from the UX reference's field examples (§6 Instructions).
const VOICE_FIELDS: {
  key: keyof Omit<VoiceFormValues, "singlePromptText">
  label: string
  defaultVisible: boolean
  placeholder: string
}[] = [
    {
      key: "tone",
      label: "Tone",
      defaultVisible: true,
      placeholder:
        'How your posts should sound\nE.g. "Direct, first-person, confident but not arrogant."',
    },
    {
      key: "contentRules",
      label: "Content rules",
      defaultVisible: false,
      placeholder:
        'What to always do and never do\nE.g. "Always end with a question, never use jargon."',
    },
    {
      key: "postStructure",
      label: "Post structure",
      defaultVisible: false,
      placeholder:
        'Your preferred hook, body, and CTA patterns\nE.g. "Hook + 3 short paragraphs + one question."',
    },
    {
      key: "whatToAvoid",
      label: "What to avoid",
      defaultVisible: false,
      placeholder:
        'Phrases, formats, or topics to never include\nE.g. "No threads, no motivational clichés."',
    },
  ]

// Figma "Toggle" row radius (--rad-lg) as px for the squircle path math —
// see hooks/use-squircle-clip-path.ts.
const TOGGLE_ROW_CORNER_RADIUS = 16

// There's no save button in the design: blurring any field (and flipping the
// single-prompt toggle) saves to public.instructions via the server action.
// Field values live in react-hook-form's store rather than the DOM alone, so
// they survive the keyed remount when the toggle swaps the card's lower half
// and the eye buttons unmounting a field's textarea.
function MyVoiceCard({
  projectId,
  initial,
  className,
}: {
  projectId: string
  initial: Instructions | null
  className?: string
}) {
  const [singlePrompt, setSinglePrompt] = React.useState(
    initial?.singlePrompt ?? false
  )
  const [topics, setTopics] = React.useState<string[]>(initial?.topics ?? [])
  const [saveFailed, setSaveFailed] = React.useState(false)
  const switchId = React.useId()
  const { register, getValues } = useForm<VoiceFormValues>({
    defaultValues: {
      singlePromptText: initial?.singlePromptText ?? "",
      tone: initial?.tone ?? "",
      contentRules: initial?.contentRules ?? "",
      postStructure: initial?.postStructure ?? "",
      whatToAvoid: initial?.whatToAvoid ?? "",
    },
  })
  const { ref: toggleRowRef, style: toggleRowStyle } =
    useSquircleClipPath<HTMLDivElement>({
      cornerRadius: TOGGLE_ROW_CORNER_RADIUS,
    })

  // Coalesces bursts of autosaves (rapid topic add/remove, several field
  // blurs in a row) into a strictly ordered request stream — see
  // hooks/use-save-queue.ts. The callback below only closes over the
  // stable `saveInstructions` import and the stable `setSaveFailed`
  // setter, so it's safe to memoize once and never resync.
  const queueSave = useSaveQueue(
    React.useCallback(async (payload: SaveInstructionsInput) => {
      const result = await saveInstructions(payload)
      if ("error" in result) setSaveFailed(true)
    }, [])
  )

  // The toggle and the topic picker pass their next value explicitly —
  // setState hasn't committed yet when their save fires.
  const save = (next?: { singlePrompt?: boolean; topics?: string[] }) => {
    queueSave({
      projectId,
      singlePrompt: next?.singlePrompt ?? singlePrompt,
      topics: next?.topics ?? topics,
      ...getValues(),
    })
  }

  const saveOnBlur = () => save()

  const handleToggle = (next: boolean) => {
    setSinglePrompt(next)
    save({ singlePrompt: next })
  }

  const addTopic = (topic: string) => {
    const next = [...topics, topic]
    setTopics(next)
    save({ topics: next })
  }

  const removeTopic = (topic: string) => {
    const next = topics.filter((t) => t !== topic)
    setTopics(next)
    save({ topics: next })
  }

  return (
    <>
      {/* Same fixed top-center slot as the create-project toast. */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          open={saveFailed}
          onOpenChange={setSaveFailed}
          variant="danger"
          direction="top"
        >
          Couldn&apos;t save your changes
        </Toast>
      </div>

      <InstructionsCard
        title="My voice"
        description="Tell Presto how to think, write, and behave when creating your posts."
        className={className}
      >
        <div className="flex flex-col gap-dist-md">
          <div
            ref={toggleRowRef}
            style={toggleRowStyle}
            className="flex items-center gap-dist-lg rounded-rad-lg border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 py-pad-xs pr-pad-xs pl-pad-md"
          >
            <label
              htmlFor={switchId}
              className="flex-1 cursor-pointer text-body-lg text-text-bold"
            >
              Use single prompt
            </label>
            <Switch
              id={switchId}
              checked={singlePrompt}
              onCheckedChange={handleToggle}
            />
          </div>
          <div className="flex items-center gap-dist-md text-text-subtle">
            <Info className="size-5 shrink-0" />
            <p className="text-body-md">Write everything in one single field</p>
          </div>
        </div>

        <DottedDivider />

        {/* key'd so flipping the toggle re-mounts the content with the same
            small starting: entrance the rest of the app uses for swapped-in
            content (mount-in only, no exit — the codebase convention).
            react-hook-form re-applies each field's value on remount. */}
        <div
          key={singlePrompt ? "single-prompt" : "fields"}
          // motion-reduce keeps the fade but drops the lift — reduced motion
          // means gentler, not zero, per the standards' accessibility section.
          className="flex flex-col gap-dist-lg transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          {singlePrompt ? (
            <PillTextarea
              placeholder="Write everything Presto should know — tone, content rules, post structure, topics, and what to avoid."
              className="h-56"
              {...register("singlePromptText", { onBlur: saveOnBlur })}
            />
          ) : (
            <>
              <div className="flex flex-col gap-dist-md">
                <h3 className="text-body-lg-bold text-text-bold">
                  Topic covered
                </h3>
                <TopicPicker
                  topics={topics}
                  onAdd={addTopic}
                  onRemove={removeTopic}
                />
              </div>

              {VOICE_FIELDS.map((field) => (
                <React.Fragment key={field.key}>
                  <DottedDivider />
                  <VoiceField
                    label={field.label}
                    placeholder={field.placeholder}
                    defaultVisible={field.defaultVisible}
                    registration={register(field.key, { onBlur: saveOnBlur })}
                  />
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </InstructionsCard>
    </>
  )
}

// One collapsible instruction field: bold label row with an eye toggle that
// reveals/hides its textarea (open eye = hidden field, closed eye = shown,
// matching the Figma frame where expanded Tone carries the closed eye).
// Collapsing can't lose text: clicking the eye blurs the textarea first
// (which saves), and the value itself lives in the form store.
function VoiceField({
  label,
  placeholder,
  defaultVisible,
  registration,
}: {
  label: string
  placeholder: string
  defaultVisible: boolean
  registration: UseFormRegisterReturn
}) {
  const [visible, setVisible] = React.useState(defaultVisible)

  return (
    <div className="flex flex-col">
      {/* The whole row toggles, not just the eye — one button spanning label
          and icon (valid inside h3: buttons are phrasing content), so it's a
          bigger target and a single tab stop. Only the icon shifts color on
          hover; recoloring the label read as a state change, not a hint. */}
      <h3>
        <button
          type="button"
          aria-expanded={visible}
          onClick={() => setVisible((v) => !v)}
          className="group/field-toggle flex w-full cursor-pointer items-center gap-dist-md rounded-rad-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex-1 text-body-lg-bold text-text-bold">
            {label}
          </span>
          {/* Hover color change → `ease` per the standards' easing table. */}
          <span className="text-icon-subtle transition-colors duration-150 ease group-hover/field-toggle:text-icon-bold">
            {visible ? (
              <EyeClosed className="size-5" weight="bold" />
            ) : (
              <Eye className="size-5" weight="bold" />
            )}
          </span>
        </button>
      </h3>
      {/* The field now stays mounted either way (react-hook-form's value
          persists trivially since nothing ever unmounts) and animates both
          open and closed via the CSS grid-rows 0fr/1fr trick: a grid track
          sized in `fr` can be transitioned, and paired with overflow-hidden
          on the child it collapses that child's rendered height smoothly —
          the one common way to animate to/from a height nothing has to
          measure. The old version only animated the open direction (a
          plain mount-in fade+lift); closing just unmounted instantly. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          visible ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div
          inert={!visible}
          className={cn(
            "overflow-hidden pt-dist-md transition-[opacity,translate] duration-200 ease-out",
            visible
              ? "translate-y-0 opacity-100"
              : "-translate-y-1 opacity-0 motion-reduce:translate-y-0"
          )}
        >
          <PillTextarea placeholder={placeholder} {...registration} />
        </div>
      </div>
    </div>
  )
}

export { MyVoiceCard }
