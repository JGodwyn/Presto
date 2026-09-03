import type { Post, PostPlatform } from "@/types/post"
import type { ConnectedSocialAccount } from "@/types/social-account"

// What a post card's pill says. Before this, the pill named the *platform*
// ("LinkedIn") — which is a category, not the thing the post is actually going
// out as. It now names the connected account ("Godwin John"), falling back to
// the platform label only when there's nothing real to name.
//
// There is no `social_account_id` on posts and there doesn't need to be:
// public.social_accounts is unique on (project_id, platform), so within one
// project a platform already identifies exactly one account. `is_tryout` is
// the single thing that can't be derived that way — see types/post.ts.

export const PLATFORM_LABELS: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X",
}

// The order the Generate page's account menu lists platforms in
// (components/generate/account-options.tsx), reused so the pill cycles
// through accounts in the same sequence that menu offers them.
const PLATFORM_ORDER: PostPlatform[] = ["linkedin", "x"]

// The stand-in the Generate page's account pill offers
// (components/generate/account-options.tsx's TRY_OUT_ACCOUNT_ID). A post made
// against it belongs to no account at all, so it names itself.
export const TRY_OUT_LABEL = "Try out"

export interface PostAccount {
  platform: PostPlatform
  // The account's own name, "Try out", or the platform label — in that order
  // of preference.
  label: string
  isTryout: boolean
  // A real connected account backs this label. False for a try-out post and
  // for a post whose platform this project has never connected (or has since
  // disconnected), both of which fall back to the platform label.
  connected: boolean
  avatarUrl: string | null
}

export function resolvePostAccount(
  post: Pick<Post, "platform" | "isTryout">,
  accounts: ConnectedSocialAccount[]
): PostAccount {
  if (post.isTryout) {
    return {
      platform: post.platform,
      label: TRY_OUT_LABEL,
      isTryout: true,
      connected: false,
      avatarUrl: null,
    }
  }

  const account = accounts.find((entry) => entry.platform === post.platform)

  return {
    platform: post.platform,
    // On X the handle is the identity — it is what the account is actually
    // called, it is unique, and it is what distinguishes two people sharing a
    // display name. LinkedIn has no handle, so it keeps the name. Falling
    // through name → platform label means an account row with a blank name
    // still renders something rather than an empty pill.
    label:
      account?.accountHandle?.trim().replace(/^@/, "")
        ? `@${account.accountHandle.trim().replace(/^@/, "")}`
        : account?.accountName?.trim() || PLATFORM_LABELS[post.platform],
    isTryout: false,
    connected: Boolean(account),
    avatarUrl: account?.avatarUrl ?? null,
  }
}

// The platforms this project can actually put a post out as.
export function connectedPlatforms(
  accounts: ConnectedSocialAccount[]
): PostPlatform[] {
  const seen = new Set<PostPlatform>()
  for (const account of accounts) seen.add(account.platform)
  return [...seen]
}

// What a post's account can be switched to. `isTryout` rides along because
// "Try out" is not a platform — a try-out post still carries a real platform
// (it has to be written for somewhere), so the two together are the state.
export interface PostAccountTarget {
  platform: PostPlatform
  isTryout: boolean
}

// Every account this post could be switched to, in the Generate page's own
// menu order: "Try out" first, then each connected platform.
//
// **Try out is a cycle position, not an exception** (per direct request).
// It was excluded at first, on the reasoning that a stand-in isn't an account
// — but that left the pill static for anyone with a single connected account,
// which is the common case and the whole reason the pill exists. Including it
// means there are always at least two positions to move between the moment
// one real account is connected.
export function postAccountCycle(
  accounts: ConnectedSocialAccount[],
  // The post's own platform, kept as the platform a "Try out" position writes
  // for, so switching to Try out and back is lossless.
  platform: PostPlatform
): PostAccountTarget[] {
  return [
    { platform, isTryout: true },
    ...PLATFORM_ORDER.filter((entry) =>
      connectedPlatforms(accounts).includes(entry)
    ).map((entry) => ({ platform: entry, isTryout: false })),
  ]
}

// The next account to cycle to, or null when there is only one position — no
// connected accounts at all, so "Try out" is the only thing this post could
// be. A pill with nowhere to go renders as a plain span rather than a button
// that visibly invites a tap and does nothing.
export function nextPostAccount(
  post: Pick<Post, "platform" | "isTryout">,
  accounts: ConnectedSocialAccount[],
  // Positions this post cannot move to — currently "too long for that
  // platform". **A refused position is stepped over, not stopped at**, because
  // the pill is a cycle: with [Try out, LinkedIn, X], the only route from
  // LinkedIn to Try out runs through X, so refusing X without skipping it
  // would strand an over-length post on LinkedIn with a control that does
  // nothing. Skipping keeps every reachable position reachable.
  isRefused?: (target: PostAccountTarget) => boolean
): PostAccountTarget | null {
  const cycle = postAccountCycle(accounts, post.platform)
  if (cycle.length < 2) return null

  const index = cycle.findIndex((entry) =>
    post.isTryout ? entry.isTryout : !entry.isTryout && entry.platform === post.platform
  )
  // A post on a platform that has since been disconnected isn't a position in
  // the cycle at all; the first one is where it enters.
  if (index === -1) return cycle[0]

  // Walks the whole cycle rather than looking at the next entry alone, so more
  // than one refused position in a row is stepped over too.
  let firstRefused: PostAccountTarget | null = null
  for (let step = 1; step < cycle.length; step += 1) {
    const candidate = cycle[(index + step) % cycle.length]
    if (!isRefused?.(candidate)) return candidate
    firstRefused ??= candidate
  }

  // Every other position is refused. Returned rather than null so the pill
  // stays live and the caller can explain why — a control that silently does
  // nothing reads as broken, and this is the one case where the user has to be
  // told the post is too long.
  //
  // **So this can hand back a refused target, and a caller that needs a target
  // the post may actually move to must not use it.** Use nextAllowedPostAccount
  // for that; the distinction is the whole reason it exists.
  return firstRefused
}

/**
 * The next position this post can actually be moved to, or null when there is
 * none.
 *
 * The difference from nextPostAccount is the all-refused case, and it matters:
 * that one deliberately hands back a *refused* target so the pill stays live
 * and can explain itself, while this one returns null so a caller offering to
 * perform the move has nothing to offer. Conflating them means a "Skip to …"
 * button that performs the very switch its dialog opened to refuse.
 */
export function nextAllowedPostAccount(
  post: Pick<Post, "platform" | "isTryout">,
  accounts: ConnectedSocialAccount[],
  isRefused: (target: PostAccountTarget) => boolean
): PostAccountTarget | null {
  const next = nextPostAccount(post, accounts, isRefused)
  return next && !isRefused(next) ? next : null
}
