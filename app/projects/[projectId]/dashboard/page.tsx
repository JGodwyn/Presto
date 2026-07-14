import { Button } from "@/components/ui/button"
import { ReplayOnboardingButton } from "@/components/onboarding/replay-onboarding-button"

// No-posts empty state from the Figma "Dashboard" frame. The stats/dashboard
// content replaces this once posts exist — UI only for now, so "Get started"
// isn't wired to anything yet. Same unified blur+opacity mount-in as
// /projects (see that page for the @starting-style rationale).
export default function DashboardPage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="absolute top-0 right-0">
        <ReplayOnboardingButton />
      </div>

      <div className="flex w-68 flex-col items-center gap-dist-xl text-center">
        <h1 className="text-heading-sm font-display text-text-bold">
          Nothing here
        </h1>
        <p className="text-body-lg text-text-subtle">
          Create some posts first. Your dashboard will come alive as you make
          more posts. Start below.
        </p>
        <Button variant="brand" size="xl" className="w-full">
          Get started
        </Button>
      </div>
    </div>
  )
}
