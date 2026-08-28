import { logout } from "@/app/(auth)/logout/actions"
import { ProfileScreen } from "@/components/profile/profile-screen"
import { fetchUserAiModels } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

// Profile, from the Figma "ProfileScreen" export — see profile-screen.tsx for
// the layout. Profile and Settings are one screen: /projects/<id>/settings and
// the top-level /settings stub both redirect in here, and the navbar's name
// chip is what opens it.
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const [{ data: userData }, aiModels] = await Promise.all([
    supabase.auth.getUser(),
    fetchUserAiModels(supabase),
  ])
  const user = userData.user

  const name = (user?.user_metadata?.name as string | undefined)?.trim() || "—"
  const email = user?.email ?? "—"
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ?? null
  const avatarGradientId =
    (user?.user_metadata?.avatar_gradient as string | undefined) ?? null
  // Long form rather than lib/format-date.ts's ordinal helpers: those exist
  // for scheduled dates, where the day is the thing being picked. A join date
  // is a fact about the account, and the export shows month and year only.
  const memberSince = user?.created_at
    ? `Member since ${new Date(user.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })}`
    : "Member since —"

  return (
    <ProfileScreen
      name={name}
      email={email}
      memberSince={memberSince}
      projectId={projectId}
      userId={user?.id ?? ""}
      avatarUrl={avatarUrl}
      avatarGradientId={avatarGradientId}
      aiModels={aiModels}
      logout={logout}
    />
  )
}
