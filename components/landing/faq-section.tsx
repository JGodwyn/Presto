"use client"

import * as React from "react"
import { CaretDown, ChatTeardrop } from "@phosphor-icons/react"

import { Chip } from "@/components/ui/chip"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

const FAQS = [
  {
    question: "Do I need my own API key?",
    answer:
      "No. The models are included. If you'd rather use your own key later, we'll add that option — but you can start with nothing but an email address.",
  },
  {
    question: "Which platforms does it support?",
    answer:
      "Presto supports LinkedIn today, with more platforms planned as the product grows.",
  },
  {
    question: "Does it post for me automatically?",
    answer:
      "Yes, it does. You can queue a post for later or immediately publish one. Nothing goes out without your attention",
  },
  {
    question: "Will it actually sound like me, or like AI?",
    answer:
      "That depends entirely on how much you give it. With an empty voice setup, it sounds like every other AI tool. With three of your real posts pasted into the writing style section, it gets close enough that editing takes two minutes instead of twenty. That section exists for exactly this reason.",
  },
  {
    question: "Can I edit what it writes?",
    answer:
      "All of it. Every post is fully editable, and nothing is ever published without you approving it first.",
  },
  {
    question: "Is my writing used to train anything?",
    answer:
      "No. Your posts, instructions, and reference material are yours. They're used to generate your content and nothing else.",
  },
  {
    question: "What happens to my drafts if I don’t use them",
    answer:
      "They stay in your calendar. Nothing expires, nothing gets deleted automatically.",
  },
] as const

function FaqItem({
  question,
  answer,
  open,
  onOpenChange,
}: {
  question: string
  answer: string
  open: boolean
  onOpenChange: () => void
}) {
  const answerId = React.useId()
  const { ref: triggerRef, style: triggerStyle } =
    useSquircleClipPath<HTMLButtonElement>({ cornerRadius: 12 })
  const { ref: answerRef, style: answerStyle } =
    useSquircleClipPath<HTMLDivElement>({ cornerRadius: 16 })

  return (
    <div>
      <button
        ref={triggerRef}
        style={triggerStyle}
        type="button"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={onOpenChange}
        className={cn(
          "flex min-h-pad-3xl w-full cursor-pointer items-center gap-dist-md rounded-rad-xmd px-pad-lg py-pad-sm text-left transition-[background-color,color] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          open
            ? "bg-purple-500 text-text-inverse"
            : "bg-purple-0 text-purple-900"
        )}
      >
        <ChatTeardrop className="size-5 shrink-0" />
        <span className={cn("min-w-0 flex-1 text-body-lg", open && "font-bold")}>
          {question}
        </span>
        <CaretDown
          weight="bold"
          className={cn(
            "size-5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        id={answerId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          open
            ? "grid-rows-[1fr] duration-200"
            : "grid-rows-[0fr] duration-150"
        )}
      >
        <div className="overflow-hidden">
          <div
            ref={answerRef}
            style={answerStyle}
            className={cn(
              "mt-dist-md rounded-rad-lg border-[length:var(--stroke-lg)] border-purple-400 bg-purple-0 px-pad-lg py-pad-sm text-body-lg text-text-bold transition-[opacity,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:translate-y-0 motion-reduce:transition-opacity",
              open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            )}
          >
            {answer}
          </div>
        </div>
      </div>
    </div>
  )
}

function FaqSection() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="bg-surface-4 px-[var(--mgn-mobile)] py-[calc(var(--pad-7xl)-var(--pad-sm))] md:px-pad-6xl"
    >
      <div className="mx-auto grid w-full max-w-[848px] gap-dist-5xl lg:grid-cols-[minmax(0,calc(var(--pad-9xl)+var(--pad-lg)))_minmax(0,calc(var(--pad-9xl)*2+var(--pad-sm)))]">
        <div className="flex flex-col gap-dist-xl">
          <h2
            id="faq-heading"
            className="max-w-68 font-display text-heading-md font-normal text-text-bold"
          >
            You might want to know . . .
          </h2>
          <Chip
            size="md"
            selected={false}
            className="w-fit border-border-bold bg-surface-4 px-pad-md text-body-lg text-text-subtle"
          >
            Frequently asked questions
          </Chip>
        </div>

        <div className="flex min-w-0 flex-col gap-dist-lg">
          {FAQS.map((faq, index) => (
            <FaqItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              open={openIndex === index}
              onOpenChange={() =>
                setOpenIndex((current) => (current === index ? null : index))
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export { FaqSection }
