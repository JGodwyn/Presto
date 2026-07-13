import { redirect } from "next/navigation"

// A bare /projects/<id> has no screen of its own — the dashboard is the
// project's landing page.
export default async function ProjectIndexPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params
  redirect(`/projects/${projectId}/dashboard`)
}
