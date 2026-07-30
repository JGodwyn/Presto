import { Eyes } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { ReplayOnboardingButton } from "@/components/onboarding/replay-onboarding-button"

// No-posts empty state, now on the app's shared EmptyState layout (the Figma
// "Empty state" export) with the default Eyes icon. The old version had the
// same three pieces in the opposite hierarchy — a small heading over a longer
// body paragraph — so the copy was resplit to match: the short phrase names
// the state, the big Phudu line carries the message. The stats/dashboard
// content replaces all of this once posts exist; "Get started" isn't wired to
// anything yet. Same unified blur+opacity mount-in as /projects (see that
// page for the @starting-style rationale).
export default function DashboardPage() {
  return (
    <div className="relative flex flex-1 flex-col transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="absolute top-0 right-0">
        <ReplayOnboardingButton />
      </div>

      <EmptyState
        icon={Eyes}
        caption="Nothing here"
        title="Create some posts & your dashboard will come alive."
        action={
          <Button variant="brand" size="xl">
            Get started
          </Button>
        }
      />
    </div>
  )
}
