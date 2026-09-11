import { redirect } from "next/navigation"

import { ProfileContent } from "@/components/profile/profile-content"
import { ProjectsNavbar } from "@/components/projects/projects-navbar"
import { SectionScrollArea } from "@/components/shared/section-scroll-area"
import { createClient } from "@/lib/supabase/server"

// The account screen on its own, for the name chip on the projects picker.
// It used to forward into the user's first project, which was wrong on its
// face: nothing on this screen is project-scoped, so opening it shouldn't
// decide which project you're in. Same page, same components — just the
// picker's chrome (navbar, no sidebar) instead of a project's, since there is
// no project here to put in a sidebar.
//
// Deliberately not a modal: this screen is expected to grow, and a dialog that
// has to hold more than this would be unusable on a phone.
export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const firstName =
    (user.user_metadata?.name as string | undefined)?.trim().split(/\s+/)[0] ??
    "there"

  return (
    // Same shell as the in-project layout — h-screen so the page scrolls
    // inside <main> rather than stretching the chrome, and the same padding
    // scale so the navbar sits exactly where it does everywhere else.
    <div className="flex h-screen w-full flex-col gap-dist-2xl bg-surface-3 px-pad-xl py-pad-4xl md:px-[clamp(var(--pad-4xl),calc(37.037vw-var(--pad-9xl)-var(--pad-7xl)),var(--pad-9xl))]">
      <ProjectsNavbar
        userName={firstName}
        userId={user.id}
        avatarUrl={
          (user.user_metadata?.avatar_url as string | undefined) ?? null
        }
        gradientId={
          (user.user_metadata?.avatar_gradient as string | undefined) ?? null
        }
        // The chip opens this page, so it has nowhere left to go — but with
        // no sidebar and no project, Back is the only way out.
        backHref="/projects"
      />

      {/* The same scroll container every in-project section gets, and for the
          same reason its fade is an overlay rather than a mask: this screen
          renders a fixed-position Toast inside it (see section-scroll-area). */}
      <SectionScrollArea>
        <ProfileContent />
      </SectionScrollArea>
    </div>
  )
}
