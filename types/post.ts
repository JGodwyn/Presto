// Placeholder shape pending Presto_PRD_v1_1.docx / Presto_UX_Reference_v1_0.docx.
// This is the single definition of what a post looks like — every page reads
// and writes through this type. Refine once the real spec is available.

export type PostPlatform = "linkedin" | "x"

export type PostStatus = "draft" | "scheduled" | "published"

export interface Post {
  id: string
  platform: PostPlatform
  status: PostStatus
  content: string
  scheduledFor: string | null
  createdAt: string
  updatedAt: string
}
