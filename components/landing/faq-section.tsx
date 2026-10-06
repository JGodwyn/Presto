"use client"

import * as React from "react"
import { CaretDown, ChatTeardrop } from "@phosphor-icons/react"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { Chip } from "@/components/ui/chip"
import { useLandingArrival } from "@/hooks/use-landing-arrival"
import { useSquircleClipPath } from "@/hooks/use-squircle-clip-path"
import { cn } from "@/lib/utils"

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

// The heading and chip come in first, then the questions one after another,
// each sharpening up from a small blur as it rises into place.
const ENTRANCE = {
  heading: { offset: 16, blurFrom: 8, transition: { duration: 0.8, ease: EASE_OUT } },
  chip: { offset: 12, blurFrom: 6, transition: { duration: 0.6, ease: EASE_OUT, delay: 0.08 } },
  question: { offset: 12, blurFrom: 4, transition: { duration: 0.5, ease: EASE_OUT } },
  questionsDelay: 0.15,
  questionsStagger: 0.06,
} satisfies {
  heading: { offset: number; blurFrom: number; transition: Transition }
  chip: { offset: number; blurFrom: number; transition: Transition }
  question: { offset: number; blurFrom: number; transition: Transition }
  questionsDelay: number
  questionsStagger: number
}

const FAQS = [
  {
    question: "Do I need my own API key?",
    answer:
      "No. The models are included, so you can start with nothing but an email address. If you'd rather use your own key, you can add one from your profile.",
  },
  {
    question: "Which platforms does it support?",
    answer:
      "Presto supports LinkedIn today, with more platforms planned as the product grows.",
  },
  {
    question: "Does it post for me automatically?",
    answer:
      "Yes, it does. You can queue a post for later or immediately publish one. Nothing goes out without your attention.",
  },
  {
    question: "Will it actually sound like me, or like AI?",
    answer:
      "That depends entirely on how much you give it. With an empty voice setup, it sounds like every other AI tool. With three of your real posts pasted into the writing style section, it gets close enough that editing takes two minutes instead of twenty. That section exists for exactly this reason.",
  },
  {
    question: "Can I edit what it writes?",
    answer:
      "All of it. Every post is fully editable, and nothing goes out unless you schedule or publish it yourself.",
  },
  {
    question: "Is my writing used to train anything?",
    answer:
      "No. Your posts, instructions, and reference material are yours. They're used to generate your content and nothing else.",
  },
  {
    question: "What happens to my drafts if I don’t use them?",
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
          "flex min-h-pad-3xl w-full cursor-pointer items-start gap-dist-md rounded-rad-xmd px-pad-lg py-pad-sm text-left transition-[background-color,color] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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

// A centred heading over a single centred column of questions. This replaced
// the exported two-column layout (heading left, questions right).
function FaqSection() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)
  // Plays on the first arrival only.
  const { ref: sectionRef, isInView } = useLandingArrival<HTMLElement>({ once: true })
  const prefersReducedMotion = useReducedMotion()

  const entrance = (
    item: { offset: number; blurFrom: number; transition: Transition },
    delay = 0
  ) => {
    const hidden = {
      opacity: 0,
      filter: prefersReducedMotion ? "blur(0px)" : `blur(${item.blurFrom}px)`,
      transform: prefersReducedMotion ? "translateY(0px)" : `translateY(${item.offset}px)`,
    }
    return {
      initial: hidden,
      animate: isInView ? { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" } : hidden,
      transition: prefersReducedMotion
        ? { duration: 0.2, ease: EASE_OUT }
        : { ...item.transition, delay: (item.transition.delay ?? 0) + delay },
    }
  }

  return (
    <section
      ref={sectionRef}
      id="faq"
      aria-labelledby="faq-heading"
      className="bg-surface-4 px-[var(--mgn-mobile)] py-[calc(var(--pad-6xl)+var(--pad-2xl)+var(--pad-3xl))] md:px-pad-6xl md:py-[calc(var(--pad-7xl)+var(--pad-2xl)+var(--pad-3xl))]"
    >
      <div className="mx-auto grid w-full max-w-[calc(var(--pad-9xl)*2+var(--pad-sm))] gap-dist-3xl md:gap-dist-5xl">
        <div className="flex flex-col items-center gap-dist-xl text-center">
          <motion.h2
            {...entrance(ENTRANCE.heading)}
            id="faq-heading"
            className="font-display text-heading-md font-normal text-text-bold"
          >
            You might want <br className="md:hidden" />
            to know . . .
          </motion.h2>
          <motion.div {...entrance(ENTRANCE.chip)} className="w-fit">
            <Chip
              size="md"
              selected={false}
              className="w-fit border-border-bold bg-surface-4 px-pad-md text-body-lg text-text-subtle"
            >
              Frequently asked questions
            </Chip>
          </motion.div>
        </div>

        <div className="flex min-w-0 flex-col gap-dist-lg">
          {FAQS.map((faq, index) => (
            <motion.div
              key={faq.question}
              {...entrance(
                ENTRANCE.question,
                ENTRANCE.questionsDelay + index * ENTRANCE.questionsStagger
              )}
            >
              <FaqItem
                question={faq.question}
                answer={faq.answer}
                open={openIndex === index}
                onOpenChange={() =>
                  setOpenIndex((current) => (current === index ? null : index))
                }
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { FaqSection }
