// The single definition of a connected social account — every page reads and
// writes through this type (see AGENTS.md "Shared data shapes").
//
// Backed by public.social_accounts, one row per (project, platform): a
// connection is project-scoped, so the same LinkedIn identity connected to two
// projects is two rows. The fields are what LinkedIn's OIDC userinfo hands
// back — `accountName` from the `name` claim, `avatarUrl` from `picture`,
// `expiresAt` derived from the token response's `expires_in` (~60 days, and
// not silently refreshable for a standard app, which is why the expiry is
// surfaced in the UI at all).
//
// Deliberately absent, same as types/ai-model.ts: the access token itself. It
// is encrypted at rest and never leaves the server — no query that can reach
// the browser selects that column.

import type { PostPlatform } from "@/types/post"

export interface ConnectedSocialAccount {
  id: string
  platform: PostPlatform
  // LinkedIn's `name` claim — "Godwin John".
  accountName: string
  accountEmail: string | null
  // LinkedIn's `picture` claim. Null when the member has no photo, which the
  // connected row falls back to the app's gradient avatar for.
  avatarUrl: string | null
  connectedAt: string
  expiresAt: string
}
