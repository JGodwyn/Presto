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
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { HIDE_NATIVE_SCROLLBAR_CLASSNAME } from "@/lib/scrollbar"
import { formatOrdinal } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

const FEATURE_PREVIEW_MASK =
  "linear-gradient(to bottom, black 57%, transparent 100%)"

// The previews show the app mid-use, with real-looking topics, rules and
// posts, rather than its empty states. They're one designer-consultant's
// account, so the three features read as the same person's week.
const DEMO_TOPICS = ["Product design", "Design systems", "Freelancing", "UX research"]
const DEMO_ACTIVE_TOPICS = new Set(DEMO_TOPICS)

function demoPost(index: number, content: string, topics: string[]): Post {
  return {
    id: `landing-feature-post-${index}`,
    projectId: "landing-feature-preview",
    platform: "linkedin",
    status: "draft",
    content,
    topics,
    scheduledFor: null,
    createdAt: "2026-07-08T09:00:00.000Z",
    isTryout: false,
    publishedAt: null,
    providerPostId: null,
    publishError: null,
  }
}

// Posts that have just come back from a batch, on the Generate preview.
const GENERATED_POSTS = [
  demoPost(
    0,
    "I used to rewrite every client proposal from scratch. Then I started keeping a swipe file of the ones that closed.",
    ["Freelancing"]
  ),
  demoPost(
    1,
    "Design systems don't fail because of tokens. They fail because nobody owns the boring parts.",
    ["Design systems"]
  ),
  demoPost(
    8,
    "A client asked why the redesign took six weeks. The honest answer: four of them were deciding what not to build.",
    ["Product design"]
  ),
]

// Two days of the calendar, side by side: today and tomorrow, so the preview
// always reads as this week's queue.
const CALENDAR_DAYS = [
  {
    offset: 0,
    posts: [
      demoPost(
        2,
        "Three questions I ask before any redesign: what's broken, for whom, and how will we know it's fixed?",
        ["Product design", "UX research"]
      ),
      demoPost(
        3,
        "Pricing by the hour taught me to work slower. Pricing by the project taught me to scope better.",
        ["Freelancing"]
      ),
      demoPost(
        4,
        "The best portfolio case study is the one where you admit what didn't work, and what you'd do differently.",
        ["Product design"]
      ),
      demoPost(
        9,
        "Stop sending Figma links without context. One paragraph on what you want feedback on saves a meeting.",
        ["Product design"]
      ),
    ],
  },
  {
    offset: 1,
    posts: [
      demoPost(
        5,
        "Shipped a client onboarding flow last week that cut support tickets by a third. Here's the one change that did it.",
        ["UX research", "Product design"]
      ),
      demoPost(
        6,
        "Every component in your library should answer one question: who fixes it when it breaks?",
        ["Design systems"]
      ),
      demoPost(
        7,
        "Five interviews beat fifty survey responses. Here's how I run them in an afternoon.",
        ["UX research"]
      ),
      demoPost(
        10,
        "Retainers changed my business more than any design skill did. Predictable income buys better work.",
        ["Freelancing"]
      ),
    ],
  },
]

// Today's date as a stable key, read through useSyncExternalStore so the
// server renders its own date and the visitor's browser then swaps in theirs
// after hydration, with no mismatch. The day never changes mid-visit in any
// way worth subscribing to.
function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}
const subscribeToNothing = () => () => {}

function useToday() {
  const key = React.useSyncExternalStore(subscribeToNothing, todayKey, todayKey)
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function dayLabel(date: Date) {
  return `${formatOrdinal(date.getDate())} ${date.toLocaleDateString("en-GB", { month: "long" })}`
}

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

// How a feature's copy changes in the pinned copy column (lg and up): the
// outgoing copy fades, and the incoming eyebrow, heading and label blur in
// one after another, each rising into place. The outgoing copy's blur and
// offset are reset only after it's invisible, so nothing blurs on the way out.
const FEATURE_ENTER_MS = 500
const FEATURE_EXIT_MS = 200
// The incoming copy starts once the outgoing one is mostly gone.
const FEATURE_ENTER_DELAY_MS = 120
const FEATURE_STAGGER_MS = 70
const FEATURE_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"

function stagedEntrance(active: boolean, order: number) {
  const delay = FEATURE_ENTER_DELAY_MS + order * FEATURE_STAGGER_MS
  return {
    className: cn(
      !active && "lg:translate-y-[var(--pad-md)] lg:opacity-0 lg:blur-[6px]",
      "lg:motion-reduce:translate-y-0 lg:motion-reduce:blur-none"
    ),
    style: {
      transition: active
        ? ["opacity", "filter", "translate"]
            .map((property) => `${property} ${FEATURE_ENTER_MS}ms ${FEATURE_EASE} ${delay}ms`)
            .join(", ")
        : `opacity ${FEATURE_EXIT_MS}ms ${FEATURE_EASE}, filter 0s ${FEATURE_EXIT_MS}ms, translate 0s ${FEATURE_EXIT_MS}ms`,
    },
  }
}

function FeatureCopy({
  eyebrow,
  heading,
  note,
  headingId,
  active = true,
}: {
  eyebrow: string
  heading: string
  note: string
  headingId?: string
  active?: boolean
}) {
  return (
    <div
      aria-hidden={!active || undefined}
      className="flex w-full flex-col gap-dist-xl lg:w-[calc(var(--pad-9xl)+var(--pad-8xl)+var(--pad-sm)-var(--dist-2xs))]"
    >
      <p
        style={stagedEntrance(active, 0).style}
        className={cn(
          "text-feature-eyebrow font-display font-normal text-text-bold",
          stagedEntrance(active, 0).className
        )}
      >
        {eyebrow}
      </p>
      <h2
        id={headingId}
        style={stagedEntrance(active, 1).style}
        className={cn(
          "text-heading-md font-sans font-semibold text-text-bold",
          stagedEntrance(active, 1).className
        )}
      >
        {heading}
      </h2>
      <div
        style={stagedEntrance(active, 2).style}
        className={stagedEntrance(active, 2).className}
      >
        <FeatureBadge>{note}</FeatureBadge>
      </div>
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
      className="h-[calc(var(--pad-9xl)+var(--pad-8xl)-var(--pad-sm))] w-full max-w-[calc(var(--pad-9xl)*2-var(--pad-md))] overflow-hidden lg:h-(--feature-shot) lg:max-w-none"
    >
      {children}
    </div>
  )
}

function VoiceFieldPreview({
  label,
  value,
}: {
  label: string
  // Filled fields are shown expanded, like a set-up account; the rest stay
  // collapsed.
  value?: string
}) {
  const expanded = value !== undefined
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
        <PillTextarea readOnly aria-label={label} defaultValue={value} />
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
        <div className="flex flex-wrap gap-dist-sm">
          {DEMO_TOPICS.map((topic) => (
            <Chip key={topic} title={topic} onRemove={() => {}}>
              {topic}
            </Chip>
          ))}
        </div>
      </div>

      <DottedDivider />
      <VoiceFieldPreview
        label="Tone"
        value="Direct and first-person. Confident, never smug. Short sentences, plain words, no buzzwords."
      />
      <DottedDivider />
      <VoiceFieldPreview
        label="Content rules"
        value="Lead with something I learned on a real project. One idea per post. End on a question only if I'd actually want the answers."
      />
      <DottedDivider />
      <VoiceFieldPreview label="Post structure" />
      <DottedDivider />
      <VoiceFieldPreview label="What to avoid" />
    </InstructionsCard>
  )
}

function GeneratePreview() {
  const [count, setCount] = React.useState(5)
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
      className="mx-auto flex w-[calc(100%-var(--pad-xl))] flex-col items-center gap-dist-lg rounded-rad-lg bg-surface-4 px-pad-lg py-pad-xl"
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

// The Generate card with the first posts of the batch arriving under it.
function GenerateBatchPreview() {
  return (
    <div className="flex flex-col gap-dist-md">
      <GeneratePreview />
      <div className="mx-auto flex w-[calc(100%-var(--pad-xl))] flex-col gap-dist-md">
        {GENERATED_POSTS.map((post) => (
          <KanbanPostCard
            key={post.id}
            post={post}
            accounts={[]}
            activeTopics={DEMO_ACTIVE_TOPICS}
          />
        ))}
      </div>
    </div>
  )
}

function CalendarDay({
  label,
  posts,
  className,
}: {
  label: string
  posts: Post[]
  className?: string
}) {
  const { ref: trayRef, style: trayStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })

  return (
    <div
      ref={trayRef}
      style={trayStyle}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-dist-md rounded-rad-lg border-[length:var(--stroke-lg)] border-border-subtle bg-surface-3 p-pad-lg",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-dist-sm text-body-lg-bold text-text-bold">
          <CalendarDots className="size-5 text-icon-minimal" weight="bold" />
          {label}
        </span>
        <span className="text-body-lg-bold text-text-subtle">{posts.length}</span>
      </div>

      {posts.map((post) => (
        <KanbanPostCard
          key={post.id}
          post={post}
          accounts={[]}
          activeTopics={DEMO_ACTIVE_TOPICS}
        />
      ))}
    </div>
  )
}

// The day columns are wider than the shot, so the row scrolls sideways (wheel,
// trackpad or drag, like the Content page's month rows) and fades at the
// right edge where the next day runs off.
function CalendarPreview() {
  const today = useToday()
  const dragScroll = useDragScroll()
  const { ref: fadeRef, onScroll } = useScrollFade({ axis: "x", start: 24, end: 48 })

  return (
    <div
      ref={fadeRef}
      onScroll={onScroll}
      onPointerDown={dragScroll.onPointerDown}
      onPointerMove={dragScroll.onPointerMove}
      onPointerUp={dragScroll.onPointerUp}
      onPointerCancel={dragScroll.onPointerCancel}
      className={cn(
        "w-full overflow-x-auto",
        dragScroll.isDragging && "cursor-grabbing select-none",
        HIDE_NATIVE_SCROLLBAR_CLASSNAME
      )}
    >
      <div
        style={{
          transform: `translateX(${dragScroll.elasticOffset}px)`,
          transition: dragScroll.isDragging
            ? "none"
            : "transform 200ms cubic-bezier(0.77, 0, 0.175, 1)",
        }}
        className="flex w-max gap-dist-md"
      >
        {CALENDAR_DAYS.map((day) => (
          <CalendarDay
            key={day.offset}
            label={dayLabel(
              new Date(today.getFullYear(), today.getMonth(), today.getDate() + day.offset)
            )}
            posts={day.posts}
            className="w-[calc(var(--pad-9xl)+var(--pad-3xl)+var(--pad-xs))] flex-none"
          />
        ))}
      </div>
    </div>
  )
}

const FEATURES = [
  {
    eyebrow: "Set instructions",
    heading:
      "Paste in a few posts you've already written. Set your tone, your rules, the things you never say.",
    note: "More instructions available",
    preview: <VoicePreview />,
  },
  {
    eyebrow: "Generate a batch",
    heading:
      "Choose how many posts you want, and how far apart to spread them. Posts come in one by one.",
    note: "Also choose based on date",
    preview: <GenerateBatchPreview />,
  },
  {
    eyebrow: "Review & schedule",
    heading:
      "Everything lands in your calendar. Edit, mark as ready, and move on with your day.",
    note: "More options in calendar",
    preview: <CalendarPreview />,
  },
] as const

// Below lg: each feature's copy, then its app shot, one after another in
// normal flow.
function StackedFeatures() {
  return (
    <div className="lg:hidden">
      {FEATURES.map((feature) => (
        <section
          key={feature.eyebrow}
          aria-label={feature.eyebrow}
          className="flex flex-col gap-dist-3xl px-[var(--mgn-mobile)] py-pad-6xl md:px-pad-6xl md:py-pad-5xl"
        >
          <FeatureCopy eyebrow={feature.eyebrow} heading={feature.heading} note={feature.note} />
          <FeaturePreviewViewport>{feature.preview}</FeaturePreviewViewport>
        </section>
      ))}
    </div>
  )
}

// lg and up, the Granola layout: the copy column is pinned while the app
// shots scroll past beside it like ordinary content, stacked close enough
// that the neighbours above and below stay in view. They scroll freely (no
// snapping), and the pinned copy follows whichever shot is nearest the middle.
function PinnedFeatures() {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    const scrollContainer = wrapper?.closest<HTMLElement>("[data-landing-scroll]")
    if (!wrapper || !scrollContainer) return

    const shots = Array.from(wrapper.querySelectorAll<HTMLElement>("[data-feature-shot]"))

    // The shot whose centre is nearest the middle of the screen. Before the
    // section that's the first one, after it the last one stays.
    const update = () => {
      const container = scrollContainer.getBoundingClientRect()
      const middle = container.top + container.height / 2
      let nearest = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      shots.forEach((shot, index) => {
        const rect = shot.getBoundingClientRect()
        const distance = Math.abs(rect.top + rect.height / 2 - middle)
        if (distance < nearestDistance) {
          nearest = index
          nearestDistance = distance
        }
      })
      setActiveIndex(nearest)
    }

    update()
    scrollContainer.addEventListener("scroll", update, { passive: true })
    scrollContainer.addEventListener("scrollend", update)
    window.addEventListener("resize", update)
    return () => {
      scrollContainer.removeEventListener("scroll", update)
      scrollContainer.removeEventListener("scrollend", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <div className="hidden px-pad-6xl lg:block">
    <div
      ref={wrapperRef}
      // On the shared landing rail (--landing-rail), copy left and shots right.
      // --feature-shot: each shot's height, up to 752px but never taller than
      // the screen allows. --feature-shot-width: up to 520px, never wider than
      // what's left beside the copy.
      className="mx-auto grid w-full max-w-(--landing-rail) justify-between [--feature-copy:calc(var(--pad-9xl)+var(--pad-8xl)+var(--pad-sm)-var(--dist-2xs))] [--feature-shot:min(calc(var(--pad-9xl)*3-var(--pad-lg)),calc(var(--landing-screen)-var(--pad-6xl)*2))] [--feature-shot-width:min(calc(var(--pad-9xl)*2+var(--pad-sm)),calc(100vw-var(--pad-6xl)*3-var(--feature-copy)))] grid-cols-[var(--feature-copy)_var(--feature-shot-width)] gap-dist-6xl"
    >
      {/* Every copy shares one grid cell, so they sit on top of each other,
          vertically centred in the pinned column. */}
      <div className="sticky top-0 grid h-(--landing-screen) items-center self-start">
        {FEATURES.map((feature, index) => (
          <div key={feature.eyebrow} className="[grid-area:1/1]">
            <FeatureCopy
              eyebrow={feature.eyebrow}
              heading={feature.heading}
              note={feature.note}
              active={index === activeIndex}
            />
          </div>
        ))}
      </div>

      {/* Padded by half the leftover screen height so the first shot starts
          in the middle and the last one can reach it. */}
      <div className="flex flex-col gap-dist-6xl py-[calc((var(--landing-screen)-var(--feature-shot))/2)]">
        {FEATURES.map((feature) => (
          <div key={feature.eyebrow} data-feature-shot>
            <FeaturePreviewViewport>{feature.preview}</FeaturePreviewViewport>
          </div>
        ))}
      </div>
    </div>
    </div>
  )
}

// Stacked below lg, pinned copy beside scrolling app shots from lg up. Both
// are rendered and CSS shows one: the two layouts need the copy and the
// shots in different places in the DOM.
function FeatureSections() {
  return (
    // The start of the page's free-scrolling zone (see LandingScrollArea):
    // from here down, snapping is off and the shots scroll like ordinary
    // content. snap-start only matters for arriving from Who's-it-for.
    <section
      id="features"
      aria-label="Features"
      data-landing-free-scroll
      className="relative snap-start bg-surface-3"
    >
      <StackedFeatures />
      <PinnedFeatures />
    </section>
  )
}

export { FeatureSections }
