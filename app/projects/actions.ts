"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { z } from "zod"

import {
  isNetworkError,
  networkActionError,
  type ActionError,
} from "@/lib/network-error"
import {
  REVOCABLE_SOCIAL_ACCOUNT_COLUMNS,
  revokeSocialAccount,
  type RevocableSocialAccount,
} from "@/lib/social-revoke"
import { createClient } from "@/lib/supabase/server"
import type { Project } from "@/types/project"

// 80 mirrors the check constraint on public.projects.name.
const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export async function createProject(
  input: CreateProjectInput
): Promise<{ error: string } | { project: Project }> {
  const parsed = createProjectSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a project name of at most 80 characters." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You need to be signed in to create a project." }
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: parsed.data.name })
    .select("id, name, created_at")
    .single()

  if (error) {
    return { error: "Couldn't create the project. Please try again." }
  }

  // No revalidatePath here, deliberately. Both callers push to /projects
  // straight after, and that page is dynamic — the router fetches it fresh
  // on every visit (staleTimes.dynamic is 0), so there's no cached copy to
  // invalidate. Revalidating in a Server Function also re-renders the page
  // the user is on as part of the action's response; on /create-project that
  // was a whole second render (which now redirects, having a project)
  // streaming alongside the /projects render the user is actually waiting on.
  return {
    project: { id: data.id, name: data.name, createdAt: data.created_at },
  }
}

const renameProjectSchema = createProjectSchema.extend({
  projectId: z.string().uuid(),
})

// Renaming a project. The name shows in the sidebar (project layout) and on
// the /projects folder grid, so both are revalidated; revalidating the layout
// also refreshes whichever in-project page the rename was made from.
export async function renameProject(
  input: z.infer<typeof renameProjectSchema>
): Promise<ActionError | { name: string }> {
  const parsed = renameProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Enter a project name of at most 80 characters." }
  }
  const { projectId, name } = parsed.data

  const supabase = await createClient()
  // `.select` so a project RLS hides reads as zero rows, not a silent success.
  const { data, error } = await supabase
    .from("projects")
    .update({ name })
    .eq("id", projectId)
    .select("name")
  if (error) {
    if (isNetworkError(error)) return networkActionError()
    return { error: "Couldn't rename the project. Please try again." }
  }
  if (!data || data.length === 0) {
    return { error: "That project no longer exists." }
  }

  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`, "layout")

  return { name: data[0].name }
}

// Every bucket whose objects are keyed `${userId}/${projectId}/…` — the
// project's Instructions uploads. Rows in Postgres cascade off the project;
// Storage objects don't, so these are swept by prefix instead.
const PROJECT_FILE_BUCKETS = ["writing-style-files", "content-reference-files"]

// Storage's own page ceiling for a single list call.
const STORAGE_LIST_LIMIT = 1000

const deleteProjectSchema = z.object({ projectId: z.string().uuid() })

// Deleting a project. The row goes first and everything else follows, the
// same order Disconnect uses: what the user asked for is that the project be
// gone, so nothing best-effort may stand in front of it.
//
// - Postgres: every project-scoped table (posts, instructions, writing styles,
//   references, social accounts, batch context) has `on delete cascade`, so
//   the one delete takes them all — including queued posts, which therefore
//   can never be picked up by the publish scheduler afterwards.
// - Social connections: their tokens are read *before* the delete (the rows
//   are the only copy) and revoked after, so the grant ends at the provider
//   too rather than lingering until it expires.
// - Storage: swept by prefix rather than by the rows' file_path, which also
//   catches an orphan left behind by an earlier failed cleanup.
//
// Succeeds by redirecting to /projects (which forwards on to /create-project
// when this was the last one); the error return only covers the row delete.
export async function deleteProject(
  input: z.infer<typeof deleteProjectSchema>
): Promise<ActionError> {
  const parsed = deleteProjectSchema.safeParse(input)
  if (!parsed.success) return { error: "Couldn't delete that project." }
  const { projectId } = parsed.data

  const supabase = await createClient()
  // Independent reads, so one round trip rather than two. The tokens are
  // read before the delete — the rows are the only copy. RLS scopes them to
  // the signed-in user's own projects.
  const [
    {
      data: { user },
      error: userError,
    },
    { data: accounts, error: accountsError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("social_accounts")
      .select(REVOCABLE_SOCIAL_ACCOUNT_COLUMNS)
      .eq("project_id", projectId),
  ])
  if (userError && isNetworkError(userError)) return networkActionError()
  if (!user) return { error: "You need to be signed in." }
  if (accountsError) {
    if (isNetworkError(accountsError)) return networkActionError()
    return { error: "Couldn't delete the project. Please try again." }
  }

  // `.select("id")` so a project that isn't this user's (RLS hides it) reads
  // as zero rows deleted rather than a silent success.
  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id")
  if (error) {
    if (isNetworkError(error)) return networkActionError()
    return { error: "Couldn't delete the project. Please try again." }
  }
  if (!deleted || deleted.length === 0) {
    return { error: "That project no longer exists." }
  }

  // After the response: both are best-effort and the user is already done
  // with this project, so neither should hold up the redirect (measured at
  // ~0.9s against the EU region). `after` still runs when the action ends in
  // redirect().
  after(() =>
    Promise.all([
      ...(accounts as RevocableSocialAccount[]).map(revokeSocialAccount),
      ...PROJECT_FILE_BUCKETS.map((bucket) =>
        removeProjectFiles(supabase, bucket, `${user.id}/${projectId}`)
      ),
    ])
  )

  revalidatePath("/projects")
  redirect("/projects")
}

// Best-effort: an object left behind is invisible to the user and costs only
// storage, so a failure here is swallowed rather than undoing a delete the
// user has already seen succeed. Re-lists from offset 0 each round because the
// previous page has just been removed.
async function removeProjectFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  prefix: string
): Promise<void> {
  try {
    for (;;) {
      const { data: objects, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: STORAGE_LIST_LIMIT })
      if (error || !objects || objects.length === 0) return

      const { data: removed, error: removeError } = await supabase.storage
        .from(bucket)
        .remove(objects.map((object) => `${prefix}/${object.name}`))
      // A remove that policies quietly refuse returns no error and no rows —
      // stop rather than re-list the same full page forever.
      if (removeError || !removed?.length) return
      if (objects.length < STORAGE_LIST_LIMIT) return
    }
  } catch {
    // See above — never fails the delete.
  }
}
