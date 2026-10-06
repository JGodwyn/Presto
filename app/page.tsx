import Link from "next/link"

import { AnimatedHeroCopy } from "@/components/landing/animated-hero-copy"
import { FaqSection } from "@/components/landing/faq-section"
import { FeatureSections } from "@/components/landing/feature-sections"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingScrollArea } from "@/components/landing/landing-scroll-area"
import { PrestoLogo } from "@/components/landing/presto-logo"
import { ProblemSequence } from "@/components/landing/problem-sequence"
import { SeeItInAction } from "@/components/landing/see-it-in-action"
import { WhoItsFor } from "@/components/landing/who-its-for"
import { TexturedGradient } from "@/components/shared/textured-gradient"
import { Button } from "@/components/ui/button"

function LandingPage() {
  return (
    <LandingScrollArea>
      <section className="relative flex min-h-(--landing-screen) snap-start flex-col overflow-clip md:flex-row">
        <TexturedGradient />

        <nav
        aria-label="Landing page"
        className="absolute top-[var(--dist-2xl)] left-1/2 z-10 flex w-[calc(100%-var(--pad-2xl))] max-w-(--landing-rail) -translate-x-1/2 items-center justify-between gap-[var(--dist-lg)] md:top-[var(--dist-3xl)] md:w-[calc(100%-var(--pad-6xl))]"
        >
        <PrestoLogo />
        <div className="hidden items-center gap-[var(--dist-md)] md:flex">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            cornerRadius={100000}
            className="bg-surface-3 px-[var(--pad-md)] text-text-bold hover:bg-surface-2"
            render={<a href="#features" />}
          >
            Features
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            cornerRadius={100000}
            className="bg-surface-3 px-[var(--pad-md)] text-text-bold hover:bg-surface-2"
            render={<a href="#how-it-works" />}
          >
            How it works
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            cornerRadius={100000}
            className="bg-surface-3 px-[var(--pad-md)] text-text-bold hover:bg-surface-2"
            render={<a href="#faq" />}
          >
            FAQ
          </Button>
        </div>
        <Button
          variant="brand-secondary"
          size="xl"
          nativeButton={false}
          className="h-[var(--pad-3xl)] px-[var(--pad-lg)]"
          render={<Link href="/signup" />}
        >
          Create account
        </Button>
        </nav>

        <div className="relative z-0 flex w-full flex-1 translate-y-[var(--dist-lg)] flex-col items-center justify-center px-[var(--pad-lg)] pb-[var(--pad-3xl)] pt-[var(--pad-7xl)] text-center min-[24rem]:-translate-y-[var(--dist-2xl)] min-[24rem]:pt-[var(--pad-6xl)] md:-translate-y-[calc(var(--dist-4xl)+var(--dist-7xl))] md:pb-[var(--dist-8xl)] md:pt-[var(--dist-9xl)]">
          <AnimatedHeroCopy />
        </div>

        {/* The CTA enters at 1.5s over 450ms; this note begins only once it settles. */}
        <p className="relative z-10 w-full px-[var(--pad-lg)] pb-[var(--dist-3xl)] text-center text-body-lg text-text-inverse transition-[opacity,filter] delay-[1950ms] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px] md:absolute md:bottom-[var(--dist-3xl)] md:left-1/2 md:-translate-x-1/2 md:pb-0 motion-reduce:delay-0 motion-reduce:duration-200 motion-reduce:starting:blur-none">
          Free while in beta. No credit card. No API key needed.
        </p>
      </section>
      <ProblemSequence />
      <WhoItsFor />
      {/* The features (when stacked), and the FAQ and footer, are each one
          snap area. Being taller than the viewport, mandatory snapping lets
          any position inside them rest (the area still covers the screen) and
          only snaps once an edge is on screen. Without them, mandatory snap
          would pull every scroll past Who's-it-for back to the nearest stop. */}
      <FeatureSections />
      {/* The walkthrough scrolls as ordinary content: it sits in the same
          free-scrolling snap area as the FAQ and footer rather than being a
          stop of its own. */}
      <div data-landing-free-scroll className="snap-start">
        {/* MP4 first: it's the smaller encode, and a browser plays the first source it can. */}
        <SeeItInAction
          videoUrl="/videos/landing-walkthrough.mp4"
          fallbackVideoUrl="/videos/landing-walkthrough.webm"
        />
        <FaqSection />
        <LandingFooter />
      </div>
      {/* The page's bottom edge as its own snap point. Chrome resolves a jump
          to the end (End key, scrolling past the bottom) by snapping, and it
          doesn't count the tall area above as reaching the end, so without
          this it snaps all the way back to the first feature. */}
      <div aria-hidden className="snap-end" />
    </LandingScrollArea>
  )
}

// Signed-in visitors never reach this: proxy.ts sends them to /projects
// first. So the page needs no Supabase call of its own.
export default function Home() {
  return <LandingPage />
}
