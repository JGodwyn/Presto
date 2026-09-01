import type { SupabaseClient } from "@supabase/supabase-js"

import type { ResolvedAttachment } from "@/lib/ai/attachments"
import type { UserAiModel } from "@/types/ai-model"
import type { ContentReference } from "@/types/content-reference"
import type { Instructions } from "@/types/instructions"
import type { Post, PostPlatform, PostStatus } from "@/types/post"
import type { Project } from "@/types/project"
import type { ConnectedSocialAccount } from "@/types/social-account"
import type { WritingStyle } from "@/types/writing-style"

// RLS on public.projects already scopes every query to the signed-in user,
// so these take whatever client the caller has (server or browser) and add
// no user_id filtering of their own. Row → shared-shape mapping happens here
// and nowhere else.

export async function fetchProjects(
  supabase: SupabaseClient
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }))
}

export async function fetchProject(
  supabase: SupabaseClient,
  id: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return { id: data.id, name: data.name, createdAt: data.created_at }
}

export async function fetchInstructions(
  supabase: SupabaseClient,
  projectId: string
): Promise<Instructions | null> {
  const { data, error } = await supabase
    .from("instructions")
    .select(
      "project_id, single_prompt, single_prompt_text, tone, content_rules, post_structure, what_to_avoid, topics, updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    projectId: data.project_id,
    singlePrompt: data.single_prompt,
    singlePromptText: data.single_prompt_text,
    tone: data.tone,
    contentRules: data.content_rules,
    postStructure: data.post_structure,
    whatToAvoid: data.what_to_avoid,
    topics: data.topics,
    updatedAt: data.updated_at,
  }
}

export async function fetchWritingStyles(
  supabase: SupabaseClient,
  projectId: string
): Promise<WritingStyle[]> {
  const { data, error } = await supabase
    .from("writing_styles")
    .select(
      "id, project_id, kind, content, file_name, file_size, file_path, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    content: row.content,
    fileName: row.file_name,
    fileSize: row.file_size,
    filePath: row.file_path,
    createdAt: row.created_at,
  }))
}

export async function fetchContentReferences(
  supabase: SupabaseClient,
  projectId: string
): Promise<ContentReference[]> {
  const { data, error } = await supabase
    .from("content_references")
    .select(
      "id, project_id, kind, content, file_name, file_size, file_path, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    content: row.content,
    fileName: row.file_name,
    fileSize: row.file_size,
    filePath: row.file_path,
    createdAt: row.created_at,
  }))
}

// The only query here with no projectId — user_ai_models is keyed on the user
// alone (see types/ai-model.ts), so RLS is the whole scope. Note that
// encrypted_key is deliberately absent from the select: the key is read only
// inside a server action, never on a path a browser client could take.
export async function fetchUserAiModels(
  supabase: SupabaseClient
): Promise<UserAiModel[]> {
  const { data, error } = await supabase
    .from("user_ai_models")
    .select(
      "id, label, provider_slug, gateway_model_id, key_last_four, status, last_error, created_at"
    )
    .order("created_at", { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    label: row.label,
    providerSlug: row.provider_slug,
    gatewayModelId: row.gateway_model_id,
    keyLastFour: row.key_last_four,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }))
}

// One post, for its own page. RLS scopes this to the signed-in user, so
// someone else's id reads as a post that doesn't exist — the project filter is
// there so a post from another of *your* projects doesn't answer either.
// The one place the posts table's shape is written down. It was duplicated
// across six selects and four row-mappings, which is exactly the kind of
// thing that goes stale one call site at a time the moment a column is added
// — as `is_tryout` just was.
export const POST_COLUMNS =
  "id, project_id, platform, status, content, topics, scheduled_for, created_at, is_tryout"

export type PostRow = {
  id: string
  project_id: string
  platform: PostPlatform
  status: PostStatus
  content: string
  topics: string[]
  scheduled_for: string | null
  created_at: string
  is_tryout: boolean
}

export function mapPostRow(row: PostRow): Post {
  return {
    id: row.id,
    projectId: row.project_id,
    platform: row.platform,
    status: row.status,
    content: row.content,
    topics: row.topics,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    isTryout: row.is_tryout,
  }
}

export async function fetchPost(
  supabase: SupabaseClient,
  projectId: string,
  id: string
): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapPostRow(data as PostRow)
}

export async function fetchPosts(
  supabase: SupabaseClient,
  projectId: string
): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data as PostRow[]).map(mapPostRow)
}

// Cache lookup for generateAndSavePost's shared batch context (see
// post-actions.ts) — writes/deletes for this table stay out of this file,
// per the convention above, and live inline in that server action instead
// (same as posts inserts). The expires_at filter treats a row that's expired
// but not yet swept as a miss too — the lazy sweep only runs when a fresh
// row is being created, not on every lookup, so a request landing in that
// gap must still fall back rather than serve stale data.
export async function fetchBatchContext(
  supabase: SupabaseClient,
  projectId: string,
  id: string
): Promise<{ writingStyles: ResolvedAttachment[]; contentReferences: ResolvedAttachment[] } | null> {
  const { data, error } = await supabase
    .from("generation_batch_context")
    .select("writing_styles, content_references")
    .eq("id", id)
    .eq("project_id", projectId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    writingStyles: data.writing_styles as ResolvedAttachment[],
    contentReferences: data.content_references as ResolvedAttachment[],
  }
}

export async function hasProjects(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })

  if (error) throw error

  return (count ?? 0) > 0
}

// Connected social accounts for one project. The encrypted access token is
// deliberately absent from the select — same contract as fetchUserAiModels'
// encrypted_key: this runs from client components too, and a column that
// never leaves the server can't leak from one.
export async function fetchSocialAccounts(
  supabase: SupabaseClient,
  projectId: string
): Promise<ConnectedSocialAccount[]> {
  const { data, error } = await supabase
    .from("social_accounts")
    .select(
      "id, platform, account_name, account_email, avatar_url, connected_at, expires_at, status, last_checked_at"
    )
    .eq("project_id", projectId)
    .order("connected_at", { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    platform: row.platform,
    accountName: row.account_name,
    accountEmail: row.account_email,
    avatarUrl: row.avatar_url,
    connectedAt: row.connected_at,
    expiresAt: row.expires_at,
    status: row.status,
    lastCheckedAt: row.last_checked_at,
  }))
}
