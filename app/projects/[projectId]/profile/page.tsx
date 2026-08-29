import { ProfileContent } from "@/components/profile/profile-content"

// Profile, from the Figma "ProfileScreen" export — see profile-screen.tsx for
// the layout and profile-content.tsx for the data. Profile and Settings are
// one screen: /projects/<id>/settings redirects in here, and the navbar's name
// chip is what opens it. The same screen renders without this project chrome
// at /profile.
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  return <ProfileContent projectId={projectId} />
}
