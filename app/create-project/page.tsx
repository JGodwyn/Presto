import Image from "next/image"
import { redirect } from "next/navigation"

import { CreateProjectModal } from "@/components/create-project/create-project-modal"
import { createClient } from "@/lib/supabase/server"
import { hasProjects } from "@/lib/supabase/queries"
import { logout } from "@/app/(auth)/logout/actions"
import { cn } from "@/lib/utils"
import { LogoutButton } from "./logout-button"

// Blur+opacity mount-in via @starting-style (Tailwind's `starting:` variant)
// needs no client-side JS, so this stays a Server Component. Strong ease-out
// curve per .agents/skills/review-animations/STANDARDS.md (Emil Kowalski's
// animations.dev conventions). Applied once to the whole group below (not
// per-element) so it reads as one unified appearance, not a stagger.
const ENTRANCE_TRANSITION =
  "transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]"

// First screen after signup/login while the user has no project yet
// (Figma "Create project"). Full-bleed like the auth shell, so it lives
// outside the (dashboard) group's sidebar/navbar chrome.
export default async function CreateProjectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // This screen is strictly the no-project empty state.
  if (await hasProjects(supabase)) redirect("/projects")

  const firstName =
    (user.user_metadata?.name as string | undefined)?.trim().split(/\s+/)[0] ??
    "there"

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface-3">
      <Image
        src="/images/create-project/background.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <p className="absolute top-[7vh] left-1/2 -translate-x-1/2 text-heading-lg font-display text-purple-100">
        Presto
      </p>

      <div
        className={cn(
          "relative flex min-h-screen flex-col items-center justify-center gap-dist-3xl p-pad-sm",
          ENTRANCE_TRANSITION
        )}
      >
        <div className="flex w-68 flex-col items-center gap-dist-xl">
          <div className="flex flex-col items-center gap-dist-md">
            <Image
              src="/images/create-project/avatar.svg"
              alt=""
              width={32}
              height={32}
            />
            <p className="text-title-lg font-display text-text-bold">
              Hi, {firstName}
            </p>
          </div>

          <h1 className="text-center text-heading-sm font-display text-text-bold">
            You don&rsquo;t have any projects here. Let&rsquo;s create one.
          </h1>

          <CreateProjectModal />
        </div>

        <p className="w-68 text-center text-body-md text-text-subtle">
          Each project can be customized with specific settings, making it
          perfect for distinct content types.
        </p>
      </div>

      <form
        action={logout}
        className="absolute bottom-dist-xl left-1/2 -translate-x-1/2"
      >
        <LogoutButton />
      </form>
    </div>
  )
}
