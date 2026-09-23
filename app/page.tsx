import { redirect } from "next/navigation"
import Link from "next/link"

import { AnimatedHeroCopy } from "@/components/landing/animated-hero-copy"
import { FaqSection } from "@/components/landing/faq-section"
import { FeatureSections } from "@/components/landing/feature-sections"
import { HeroGradient } from "@/components/landing/hero-gradient"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingScrollArea } from "@/components/landing/landing-scroll-area"
import { PrestoLogo } from "@/components/landing/presto-logo"
import { ProblemSequence } from "@/components/landing/problem-sequence"
import { SeeItInAction } from "@/components/landing/see-it-in-action"
import { WhoItsFor } from "@/components/landing/who-its-for"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { hasProjects } from "@/lib/supabase/queries"

function LandingPage() {
  return (
    <LandingScrollArea>
      <section className="relative flex min-h-dvh snap-start overflow-clip">
        <HeroGradient />

        <nav
        aria-label="Landing page"
        className="absolute top-[var(--dist-3xl)] left-1/2 z-10 flex w-[calc(100%-var(--pad-2xl))] max-w-[848px] -translate-x-1/2 items-center justify-between gap-[var(--dist-lg)] md:w-[calc(100%-var(--pad-6xl))]"
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

        <div className="relative z-0 flex w-full flex-1 -translate-y-[calc(var(--dist-4xl)+var(--dist-7xl))] flex-col items-center justify-center px-[var(--pad-lg)] pb-[var(--dist-8xl)] pt-[var(--dist-9xl)] text-center">
          <AnimatedHeroCopy />
        </div>

        {/* The CTA enters at 1.5s over 450ms; this note begins only once it settles. */}
        <p className="absolute bottom-[var(--dist-3xl)] left-1/2 z-10 w-full -translate-x-1/2 px-[var(--pad-lg)] text-center text-body-lg text-text-inverse transition-[opacity,filter] delay-[1950ms] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px] motion-reduce:delay-0 motion-reduce:duration-200 motion-reduce:starting:blur-none">
          Free while in beta. No credit card. No API key needed.
        </p>
      </section>
      <ProblemSequence />
      <WhoItsFor />
      <FeatureSections />
      <SeeItInAction videoUrl={process.env.LANDING_DEMO_VIDEO_URL} />
      <FaqSection />
      <LandingFooter />
    </LandingScrollArea>
  )
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <LandingPage />
  redirect((await hasProjects(supabase)) ? "/projects" : "/create-project")
}
