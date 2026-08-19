// The single definition of a connected social account — every page reads and
// writes through this type (see AGENTS.md "Shared data shapes").
//
// Nothing persists it yet: the Connections page builds this shape in local
// state so both row states can be seen. When the OAuth flow lands it maps to a
// social_accounts table, and the fields below are exactly what LinkedIn hands
// back — `accountName` from the OIDC `name` claim, `expiresAt` derived from the
// token response's `expires_in` (~60 days, and not silently refreshable for a
// standard app, which is why the expiry is surfaced in the UI at all).
//
// Deliberately absent, same as types/ai-model.ts: the access token itself. It
// never leaves the server.

import type { PostPlatform } from "@/types/post"

export interface ConnectedSocialAccount {
  platform: PostPlatform
  // LinkedIn's `name` claim — "Godwin John".
  accountName: string
  connectedAt: string
  expiresAt: string
}
