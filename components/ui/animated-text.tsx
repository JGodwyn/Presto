"use client"

import { FC, useEffect, useRef } from "react"
import { HTMLMotionProps, motion, useAnimation, useInView } from "motion/react"

// From nyxui.com/components/animated-text (registry: animated-text) — text
// styling stripped from the vendor version (it shipped hardcoded
// text-3xl/font-bold/color classes) so every call site supplies its own via
// className, per the design-tokens rule.
// How long a looped reset ("hidden") phase holds before the next entrance —
// deliberately short and fixed, not tunable: it's a blip, not part of the
// animation's actual feel (that's offset/stagger/duration/bounce).
const RESET_MS = 300

type AnimationType =
  | "blink"
  | "rise"
  | "expand"
  | "glide"
  | "cascade"
  | "flicker"
  | "elastic"
  | "float"

interface AnimateTextProps extends HTMLMotionProps<"div"> {
  text: string
  type?: AnimationType
  delay?: number
  // Vendor-declared but previously dead (never read in the function body).
  // Elastic now wires it to the spring's own visualDuration — STANDARDS.md's
  // recommended spring shape (`{ type: "spring", duration, bounce }`,
  // "easier to reason about" than raw stiffness/damping) — which also lets
  // the loop below know how long the entrance actually takes. Ignored for
  // every other type, same as before.
  duration?: number
  custom?: number
  // "elastic"-only overrides — the vendor variant tables below hardcode one
  // fixed feel per type, so these let a caller (e.g. a DialKit panel) drive
  // the actual spring instead. Ignored for every other type.
  offset?: number
  stagger?: number
  bounce?: number
  // Replays the entrance indefinitely (hold → reset → re-enter) instead of
  // firing once. Only wired for the ctrls-driven branch below (every type
  // except cascade/flicker, which animate straight off `isInView`) — not
  // needed yet for those, so left unimplemented there.
  loop?: boolean
  loopDelay?: number
}

const animationVariants = {
  blink: {
    container: {
      hidden: { opacity: 0 },
      visible: (i: number = 1) => ({
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: i * 0.3 },
      }),
    },
    child: {
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          type: "spring",
          damping: 12,
          stiffness: 100,
          y: {
            type: "keyframes",
            times: [0, 0.5, 1],
            values: [0, -10, 0],
          },
        },
      },
      hidden: { opacity: 0, y: 10 },
    },
  },
  rise: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
      },
    },
    child: {
      visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
      hidden: { opacity: 0, y: 20 },
    },
  },
  expand: {
    container: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.2 },
      },
    },
    child: {
      visible: {
        opacity: 1,
        scale: 1,
        transition: {
          type: "spring",
          damping: 15,
          stiffness: 400,
          scale: {
            type: "keyframes",
            times: [0, 0.6, 1],
            values: [0, 1.1, 1],
          },
        },
      },
      hidden: { opacity: 0, scale: 0 },
    },
  },
  float: {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: 0.03, delayChildren: 0.2 * i },
      }),
    },
    child: {
      hidden: { y: 50, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.5, ease: "easeOut" },
      },
    },
  },
  glide: {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: 0.03, delayChildren: 0.2 * i },
      }),
    },
    child: {
      hidden: { y: 20, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      },
    },
  },
  elastic: {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: 0.03, delayChildren: 0.2 * i },
      }),
    },
    child: {
      hidden: { y: 50, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 400, damping: 10 },
      },
    },
  },
  cascade: {
    container: { hidden: {}, visible: {} },
    child: {
      hidden: { opacity: 0, y: "0.25em" },
      visible: {
        opacity: 1,
        y: "0em",
        transition: { duration: 0.65, ease: [0.65, 0, 0.75, 1] },
      },
    },
  },
  flicker: {
    container: { hidden: {}, visible: {} },
    child: {
      hidden: { opacity: 0, y: "0.35em" },
      visible: {
        opacity: 1,
        y: "0em",
        transition: { duration: 0.45, ease: [0.85, 0.1, 0.9, 1.2] },
      },
    },
  },
} as const

const ELASTIC_DEFAULTS = { offset: 50, stagger: 0.03, duration: 0.5, bounce: 0.2 }

// Rebuilds the "elastic" variant pair from live values instead of reading
// the static table above — same shape, tunable numbers.
function buildElasticVariants({
  offset = ELASTIC_DEFAULTS.offset,
  stagger = ELASTIC_DEFAULTS.stagger,
  duration = ELASTIC_DEFAULTS.duration,
  bounce = ELASTIC_DEFAULTS.bounce,
}: {
  offset?: number
  stagger?: number
  duration?: number
  bounce?: number
}) {
  return {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: stagger, delayChildren: 0.2 * i },
      }),
    },
    child: {
      hidden: { y: offset, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring" as const, duration, bounce },
      },
    },
  }
}

export const AnimateText: FC<AnimateTextProps> = ({
  text,
  type = "elastic",
  custom = 1,
  className = "",
  offset = ELASTIC_DEFAULTS.offset,
  stagger = ELASTIC_DEFAULTS.stagger,
  duration = ELASTIC_DEFAULTS.duration,
  bounce = ELASTIC_DEFAULTS.bounce,
  loop = false,
  loopDelay = 1200,
  ...props
}) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false })
  const ctrls = useAnimation()
  const letters = Array.from(text)

  // How long the entrance actually takes to visually settle: the last
  // letter starts after delayChildren + stagger×(n-1), then takes `duration`
  // (the spring's own visualDuration) to finish. Only meaningful for
  // elastic — every other type is a fixed one-shot, not loopable here.
  const entranceMs =
    type === "elastic"
      ? (0.2 * custom + stagger * Math.max(letters.length - 1, 0) + duration) *
        1000
      : 0

  // Scheduled via setTimeout rather than awaiting ctrls.start()'s own
  // promise: an underdamped spring (a low `bounce` still overshoots) only
  // resolves once its residual oscillation drops below Framer Motion's rest
  // threshold, which can take noticeably longer than it visually looks
  // settled — awaiting it made the hold stall for however long that took,
  // and made it start counting from the wrong moment besides. Scheduling
  // the hold from `entranceMs` (computed above, not observed) keeps "how
  // long the text stays fully visible" exactly what `loopDelay` means,
  // independent of spring-settle detection.
  // `cancelled` covers every way the loop stops — Stop/Close both unmount
  // this component (they navigate away), which runs the cleanup below; a
  // real "generation complete" flag later just needs to flip `loop` to
  // false, no other change required.
  useEffect(() => {
    if (!isInView) {
      ctrls.start("hidden")
      return
    }

    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []
    const schedule = (fn: () => void, ms: number) => {
      timeouts.push(
        setTimeout(() => {
          if (!cancelled) fn()
        }, ms)
      )
    }

    function enter() {
      ctrls.start("visible")
      if (loop) schedule(exit, entranceMs + loopDelay)
    }
    function exit() {
      ctrls.start("hidden")
      schedule(enter, RESET_MS)
    }

    enter()

    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [isInView, ctrls, loop, loopDelay, entranceMs])

  const { container, child } =
    type === "elastic"
      ? buildElasticVariants({ offset, stagger, duration, bounce })
      : animationVariants[type]

  if (type === "cascade" || type === "flicker") {
    return (
      <h2 ref={ref} className={className}>
        {text.split(" ").map((word, index) => (
          <motion.span
            className="mr-[0.25em] inline-block whitespace-nowrap"
            aria-hidden="true"
            key={index}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={container}
            transition={{ delayChildren: index * 0.13, staggerChildren: 0.025 }}
          >
            {word.split("").map((character, index) => (
              <motion.span
                aria-hidden="true"
                key={index}
                variants={child}
                className="-mr-[0.01em] inline-block"
              >
                {character}
              </motion.span>
            ))}
          </motion.span>
        ))}
      </h2>
    )
  }

  return (
    <motion.h2
      ref={ref}
      style={{ display: "flex", overflow: "hidden" }}
      role="heading"
      variants={container}
      initial="hidden"
      animate={ctrls}
      custom={custom}
      className={className}
      {...props}
    >
      {letters.map((letter, index) => (
        <motion.span key={index} variants={child}>
          {letter === " " ? " " : letter}
        </motion.span>
      ))}
    </motion.h2>
  )
}
