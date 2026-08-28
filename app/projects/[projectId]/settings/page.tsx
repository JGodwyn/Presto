import { redirect } from "next/navigation"

// Settings merged into Profile — see profile/page.tsx. This stays as a
// redirect rather than being deleted so bookmarks, and anything still pointing
// at the old path, land on the screen that now holds its content.
export default async function SettingsRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  redirect(`/projects/${projectId}/profile`)
}
