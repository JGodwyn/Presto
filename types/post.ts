// Placeholder shape pending Presto_PRD_v1_1.docx / Presto_UX_Reference_v1_0.docx.
// This is the single definition of what a post looks like — every page reads
// and writes through this type. Refine once the real spec is available.

export type PostPlatform = "linkedin" | "x"

// Vestigial. It predates `publishedAt` and has never once been written as
// "published" by anything with a caller — `publishedAt` is the truth now (see
// lib/content-grouping.ts). Kept because rows carry it and updatePost still
// accepts it; see FOLLOWUPS for dropping it.
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
  // When the provider confirmed this post went out, or null if it never did.
  // **This is what "published" means** — not the scheduled date having passed,
  // which is all the Content page used to check and which cannot tell a post
  // that published from one whose date arrived while nothing happened.
  //
  // A post has exactly one `platform`, so there is no fan-out to reconcile:
  // publishing is one attempt at one place, and this records whether it landed.
  publishedAt: string | null
  // The provider's own id for the published post — a LinkedIn post URN, an X
  // tweet id. Set together with `publishedAt` (a DB constraint enforces the
  // pair), so a published post can always be linked back to the real thing.
  providerPostId: string | null
  // Why the last publish attempt failed, or null if it has not failed since.
  // What keeps a post that did not go out from sitting silently in the queue.
  publishError: string | null
}
