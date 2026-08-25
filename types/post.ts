// Placeholder shape pending Presto_PRD_v1_1.docx / Presto_UX_Reference_v1_0.docx.
// This is the single definition of what a post looks like — every page reads
// and writes through this type. Refine once the real spec is available.

export type PostPlatform = "linkedin" | "x"

export type PostStatus = "draft" | "scheduled" | "published"

export interface Post {
  id: string
  projectId: string
  platform: PostPlatform
  status: PostStatus
  content: string
  topics: string[]
  scheduledFor: string | null
  createdAt: string
  // Generated against the Generate page's "Try out" stand-in account rather
  // than a real connected one. `platform` still carries a real value (a post
  // has to be written *for* somewhere), so this is the only thing that tells
  // the two apart — and it has to, now that a post card shows the account's
  // own name instead of the platform's.
  isTryout: boolean
}
