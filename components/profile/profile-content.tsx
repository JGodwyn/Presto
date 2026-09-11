import { logoutForClient } from "@/app/(auth)/logout/actions"
import { ProfileScreen } from "@/components/profile/profile-screen"
import { fetchUserAiModels, fetchUserHasPassword } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"
import {
  getAvatarGradientId,
  getAvatarUrl,
  getDisplayName,
} from "@/lib/user-profile-metadata"

// The account screen's data, in one place because it renders in two: inside a
// project (app/projects/[projectId]/profile) and on its own at /profile, for
// the name chip on the projects picker, which has no project in scope.
// Nothing here is project-scoped — every field is the user's — which is why
// the standalone route exists rather than forwarding into someone's first
// project.
//
// `projectId` is only ever used to revalidate the right path after a write,
// and to decide whether the in-project-only rows belong on screen (see
// ProfileScreen).
export async function ProfileContent({ projectId }: { projectId?: string }) {
  const supabase = await createClient()
  const [{ data: userData }, aiModels, hasPassword] = await Promise.all([
    supabase.auth.getUser(),
    fetchUserAiModels(supabase),
    fetchUserHasPassword(supabase),
  ])
  const user = userData.user

  const name = getDisplayName(user?.user_metadata)?.trim() || "—"
  const email = user?.email ?? "—"
  const avatarUrl = getAvatarUrl(user?.user_metadata)
  const avatarGradientId = getAvatarGradientId(user?.user_metadata)
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
      hasPassword={hasPassword}
      aiModels={aiModels}
      logout={logoutForClient}
    />
  )
}
