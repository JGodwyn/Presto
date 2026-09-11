import { redirect } from "next/navigation"
import { z } from "zod"

import { FlickerProbe } from "@/components/shared/flicker-probe"
import { ProjectSidebar } from "@/components/shared/project-sidebar"
import { MobileProjectNavigation } from "@/components/shared/mobile-project-navigation"
import { SectionContent } from "@/components/shared/section-content"
import { SectionScrollArea } from "@/components/shared/section-scroll-area"
import { ProjectTopbar } from "@/components/shared/project-topbar"
import { OnboardingProvider } from "@/components/onboarding/onboarding-context"
import { OnboardingCover } from "@/components/onboarding/onboarding-cover"
import { OnboardingCallout } from "@/components/onboarding/onboarding-callout"
import { ExpiredConnectionProvider } from "@/components/connections/expired-connection-provider"
import { createClient } from "@/lib/supabase/server"
import {
  getAvatarGradientId,
  getAvatarUrl,
  getDisplayName,
} from "@/lib/user-profile-metadata"
import { isNetworkError } from "@/lib/network-error"
import { hasDeadLinkedInConnection } from "@/lib/connection-health"
import { fetchProject, fetchSocialAccounts } from "@/lib/supabase/queries"

// Everything inside a project (dashboard, generate, calendar, …) renders
// under this layout, so the ownership check lives here once. RLS already
// hides other users' rows, meaning "no row" covers both a bad id and someone
// else's project — both land back on the picker rather than a 404.
const projectIdSchema = z.string().uuid()

// Chrome from the Figma "Dashboard" frame: the same full-bleed navbar as
// /projects (name chip re-pointed at this project's profile) beside a floating
// sidebar card, on the shared surface-3 canvas. OnboardingProvider wraps all
// of it so the cover, the navbar swap, and the sidebar's forced-active state
// share one source of truth for tour progress.
export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}>) {
  const { projectId } = await params
  if (!projectIdSchema.safeParse(projectId).success) redirect("/projects")

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  // Same reasoning as lib/supabase/middleware.ts: "couldn't reach the auth
  // server" and "signed out" are indistinguishable from the return value
  // alone, and only one of them should send someone to /login. On a network
  // failure, fall through instead — fetchProject below throws rather than
  // returning null when it can't reach the database, so this can't quietly
  // render a project page for someone who isn't signed in.
  if (!user && !(userError && isNetworkError(userError))) redirect("/login")

  const [project, socialAccounts] = await Promise.all([
    fetchProject(supabase, projectId),
    fetchSocialAccounts(supabase, projectId),
  ])
  if (!project) redirect("/projects")

  const now = new Date()
  const hasExpiredLinkedIn = hasDeadLinkedInConnection(socialAccounts, now)

  const firstName =
    getDisplayName(user?.user_metadata)?.trim().split(/\s+/)[0] ??
    "there"

  return (
    <ExpiredConnectionProvider
      projectId={projectId}
      hasExpiredLinkedIn={hasExpiredLinkedIn}
    >
      <OnboardingProvider>
        {/* h-screen (not min-h-screen) pins the chrome to the viewport: tall
            page content scrolls inside <main> instead of stretching the
            sidebar. The -mb/pb pair on <main> makes its scroll area bleed
            through the page's bottom padding to the real screen edge, so
            overflowing content visibly runs past the sidebar's foot rather
            than clipping at the padding line; the inner pb restores the same
            breathing room at the end of the scroll. */}
        {/* The desktop gutter grows continuously, rather than jumping at a
            viewport breakpoint: it reaches the Figma frame's 256px cap on a
            16-inch MacBook Pro's full-width viewport, then gives space back
            as the sidebar's section rail approaches its comfortable measure.
            The curve reserves the original 256px only at 1728px and above,
            freeing meaningful page width at 1440px–1512px. Clamp still keeps
            scaled-down desktops at or above the 48px token minimum. */}
        <div className="flex h-dvh w-full flex-col gap-dist-lg bg-surface-3 px-pad-xl py-pad-xl md:h-screen md:gap-dist-2xl md:py-pad-4xl md:px-[clamp(var(--pad-4xl),calc(37.037vw-var(--pad-9xl)-var(--pad-7xl)),var(--pad-9xl))]">
          {/* The top bar shares the entire content rail below: sidebar plus
              section, bounded by the same responsive outer gutters. */}
          <div className="w-full">
            <ProjectTopbar
              userName={firstName}
              userId={user?.id}
              avatarUrl={
                getAvatarUrl(user?.user_metadata)
              }
              gradientId={
                getAvatarGradientId(user?.user_metadata)
              }
              profileHref={`/projects/${projectId}/profile`}
            />
          </div>

          <div className="flex min-h-0 w-full flex-1 items-stretch gap-dist-xl">
            <div className="hidden md:flex">
              <ProjectSidebar projectName={project.name} />
            </div>
            {/* <main> and its top fade — see section-scroll-area.tsx for why
                that fade is an overlay strip rather than the CSS mask every
                other scroller in this app uses. */}
            <SectionScrollArea overlay={<OnboardingCallout />}>
              <SectionContent>{children}</SectionContent>
            </SectionScrollArea>
          </div>

          <div className="w-full md:hidden">
            <MobileProjectNavigation />
          </div>
        </div>

        <OnboardingCover />
        {/* TEMPORARY: dev-only flicker diagnostics — remove with
            components/shared/flicker-probe.tsx once the section-switch flicker
            is solved. */}
        <FlickerProbe />
      </OnboardingProvider>
    </ExpiredConnectionProvider>
  )
}
