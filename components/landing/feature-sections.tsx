"use client"

import * as React from "react"
import {
  CalendarDots,
  CaretDown,
  Eye,
  EyeClosed,
  Info,
  MagicWand,
  MagnifyingGlass,
  PlugCharging,
} from "@phosphor-icons/react"

import { KanbanPostCard } from "@/components/content/kanban-post-card"
import { NumberStepper } from "@/components/generate/number-stepper"
import { SelectPill } from "@/components/generate/select-pill"
import { DottedDivider } from "@/components/instructions/dotted-divider"
import { InstructionsCard } from "@/components/instructions/instructions-card"
import { SocialIcon } from "@/components/shared/social-icon"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { PillInput } from "@/components/ui/pill-input"
import { PillTextarea } from "@/components/ui/pill-textarea"
import { Switch } from "@/components/ui/switch"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import type { Post } from "@/types/post"

const FEATURE_PREVIEW_MASK =
  "linear-gradient(to bottom, black 57%, transparent 100%)"

const DEMO_TOPICS = new Set(["Product design", "UI design", "UX design"])
const DEMO_POST_CONTENT =
  "What a book it was. Very practical with lots of steps you can take for your current or next project."
const DEMO_POSTS: Post[] = Array.from({ length: 4 }, (_, index) => ({
  id: `landing-feature-post-${index}`,
  projectId: "landing-feature-preview",
  platform: "linkedin",
  status: "draft",
  content: DEMO_POST_CONTENT,
  topics: [...DEMO_TOPICS],
  scheduledFor: null,
  createdAt: "2026-07-08T09:00:00.000Z",
  isTryout: false,
  publishedAt: null,
  providerPostId: null,
  publishError: null,
}))

function FeatureBadge({ children }: { children: React.ReactNode }) {
  return (
    <Chip
      size="md"
      selected={false}
      className="w-fit border-border-bold px-pad-md text-body-lg text-text-subtle"
    >
      {children}
    </Chip>
  )
}

function FeatureCopy({
  eyebrow,
  heading,
  note,
  headingId,
}: {
  eyebrow: string
  heading: string
  note: string
  headingId: string
}) {
  return (
    <div className="flex w-full flex-col gap-dist-xl lg:w-[calc(var(--pad-9xl)+var(--pad-8xl)+var(--pad-sm)-var(--dist-2xs))]">
      <p className="text-feature-eyebrow font-display font-normal text-text-bold">
        {eyebrow}
      </p>
      <h2
        id={headingId}
        className="text-heading-md font-sans font-semibold text-text-bold"
      >
        {heading}
      </h2>
      <FeatureBadge>{note}</FeatureBadge>
    </div>
  )
}

function FeaturePreviewViewport({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maskImage: FEATURE_PREVIEW_MASK,
        WebkitMaskImage: FEATURE_PREVIEW_MASK,
      }}
      className="h-[calc(var(--pad-9xl)+var(--pad-8xl)-var(--pad-sm))] w-full max-w-[calc(var(--pad-9xl)+var(--pad-8xl)-var(--pad-sm))] overflow-hidden"
    >
      {children}
    </div>
  )
}

function VoiceFieldPreview({
  label,
  expanded = false,
}: {
  label: string
  expanded?: boolean
}) {
  return (
    <div className="flex flex-col gap-dist-md">
      <div className="flex items-center gap-dist-md">
        <span className="flex-1 text-body-lg-bold text-text-bold">{label}</span>
        <span className="text-icon-subtle">
          {expanded ? (
            <EyeClosed className="size-5" weight="bold" />
          ) : (
            <Eye className="size-5" weight="bold" />
          )}
        </span>
      </div>
      {expanded ? (
        <PillTextarea
          readOnly
          aria-label="Example tone"
          placeholder={'How your posts should sound\nE.g. "Direct, first-person, confident but not arrogant."'}
        />
      ) : null}
    </div>
  )
}

function VoicePreview() {
  const [singlePrompt, setSinglePrompt] = React.useState(false)
  const switchId = React.useId()
  const { ref: toggleRowRef, style: toggleRowStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })

  return (
    <InstructionsCard
      title="My voice"
      description="Tell Presto how to think, write, and behave when creating your posts."
      className="mx-auto mt-pad-xs w-[calc(100%-var(--pad-sm)-var(--dist-2xs))] [&>p]:text-body-md [&_h2]:text-title-lg"
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
            onCheckedChange={setSinglePrompt}
          />
        </div>
        <div className="flex items-start gap-dist-md text-text-subtle">
          <Info className="size-5 shrink-0" />
          <p className="text-body-md">Write everything in one single field</p>
        </div>
      </div>

      <DottedDivider />

      <div className="flex flex-col gap-dist-md">
        <h3 className="text-body-lg-bold text-text-bold">Topic covered</h3>
        <PillInput
          readOnly
          fieldSize="sm"
          icon={<MagnifyingGlass weight="bold" />}
          placeholder="Search topics to add"
          aria-label="Search topics to add"
        />
        <p className="text-body-md text-text-minimal">No topics added</p>
      </div>

      <DottedDivider />
      <VoiceFieldPreview label="Tone" expanded />
      <DottedDivider />
      <VoiceFieldPreview label="Content rules" />
      <DottedDivider />
      <VoiceFieldPreview label="Post structure" />
      <DottedDivider />
      <VoiceFieldPreview label="What to avoid" />
    </InstructionsCard>
  )
}

function GeneratePreview() {
  const [count, setCount] = React.useState(1)
  const [account, setAccount] = React.useState("linkedin")
  const [model, setModel] = React.useState("gpt-4o-mini")
  const { ref: cardRef, style: cardStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })
  const { ref: pluggedTagRef, style: pluggedTagStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 8 })
  const accountOptions = [
    { value: "linkedin", label: "LinkedIn" },
    { value: "x", label: "X" },
  ]
  const modelOptions = [
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gemini-flash", label: "Gemini Flash" },
  ]

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className="mx-auto flex min-h-[calc(var(--pad-9xl)+var(--pad-8xl)+var(--pad-2xl))] w-[calc(100%-var(--pad-xl))] flex-col items-center gap-dist-lg rounded-rad-lg bg-surface-4 px-pad-lg py-pad-xl"
    >
      <NumberStepper value={count} onChange={setCount} />

      <div className="flex w-full flex-col gap-dist-sm sm:flex-row sm:items-center sm:justify-center sm:gap-dist-md">
        <SelectPill
          options={accountOptions}
          value={account}
          onChange={setAccount}
          ariaLabel="Social account"
          className="w-full justify-center whitespace-nowrap sm:w-auto"
        >
          <SocialIcon
            platform={account === "x" ? "x" : "linkedin"}
            className="size-4"
          />
          <span className="text-text-bold">
            {account === "x" ? "X" : "LinkedIn"}
          </span>
          <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
        </SelectPill>
        <SelectPill
          options={modelOptions}
          value={model}
          onChange={setModel}
          ariaLabel="AI model"
          className="w-full justify-center whitespace-nowrap sm:w-auto"
        >
          <span className="text-text-subtle">Using</span>
          <span className="text-text-bold">
            {model === "gpt-4o-mini" ? "GPT-4o mini" : "Gemini Flash"}
          </span>
          <CaretDown className="size-4 text-icon-subtle transition-transform duration-150 ease-out group-aria-expanded/select-pill:rotate-180" />
        </SelectPill>
      </div>

      <Button
        variant="brand"
        size="xl"
        className="w-full"
      >
        <MagicWand weight="fill" />
        Generate post
      </Button>

      <div className="flex flex-col items-center">
        <PlugCharging className="size-5 text-icon-subtle" />
        <span
          aria-hidden
          className="-mt-dist-xs h-4 w-[length:var(--stroke-md)] bg-icon-subtle"
        />
        <div
          ref={pluggedTagRef}
          style={pluggedTagStyle}
          className="rounded-rad-md border-[length:var(--stroke-md)] border-gray-500 bg-surface-4 px-pad-md py-pad-2xs text-body-md text-text-subtle"
        >
          Instructions plugged in
        </div>
      </div>
    </div>
  )
}

function CalendarPreview() {
  const { ref: trayRef, style: trayStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })

  return (
    <div
      ref={trayRef}
      style={trayStyle}
      className="flex w-full flex-col gap-dist-md rounded-rad-lg border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 p-pad-xl"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-dist-sm text-body-lg-bold text-text-bold">
          <CalendarDots className="size-5 text-icon-minimal" weight="bold" />
          8th July
        </span>
        <span className="text-body-lg-bold text-text-subtle">6</span>
      </div>

      {DEMO_POSTS.map((post) => (
        <KanbanPostCard
          key={post.id}
          post={post}
          accounts={[]}
          activeTopics={DEMO_TOPICS}
        />
      ))}
    </div>
  )
}

function FeatureSection({
  id,
  eyebrow,
  heading,
  note,
  background = "surface-3",
  children,
}: {
  id?: string
  eyebrow: string
  heading: string
  note: string
  background?: "surface-2" | "surface-3"
  children: React.ReactNode
}) {
  const headingId = React.useId()

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`flex overflow-clip px-[var(--mgn-mobile)] py-pad-6xl md:px-pad-6xl md:py-pad-5xl lg:min-h-[calc(var(--pad-9xl)*2+var(--pad-8xl)-var(--pad-sm))] lg:items-center ${background === "surface-2" ? "bg-surface-2" : "bg-surface-3"}`}
    >
      <div className="mx-auto grid w-full max-w-[848px] gap-dist-3xl lg:grid-cols-[minmax(0,calc(var(--pad-9xl)+var(--pad-8xl)+var(--pad-sm)-var(--dist-2xs)))_minmax(0,calc(var(--pad-9xl)+var(--pad-8xl)-var(--pad-sm)))]">
        <FeatureCopy
          eyebrow={eyebrow}
          heading={heading}
          note={note}
          headingId={headingId}
        />
        <FeaturePreviewViewport>{children}</FeaturePreviewViewport>
      </div>
    </section>
  )
}

function FeatureSections() {
  return (
    <>
      <FeatureSection
        id="features"
        eyebrow="Set instructions"
        heading="Paste in a few posts you've already written. Set your tone, your rules, the things you never say."
        note="More instructions available"
      >
        <VoicePreview />
      </FeatureSection>

      <FeatureSection
        eyebrow="Generate a batch"
        heading="Choose how many posts you want, and how far apart to spread them. Posts come in one by one."
        note="Also choose based on date"
        background="surface-2"
      >
        <GeneratePreview />
      </FeatureSection>

      <FeatureSection
        eyebrow="Review & schedule"
        heading="Everything lands in your calendar. Edit, mark as ready, and move on with your day."
        note="More options in calendar"
      >
        <CalendarPreview />
      </FeatureSection>
    </>
  )
}

export { FeatureSections }
