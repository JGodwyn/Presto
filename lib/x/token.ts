import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptApiKey, encryptApiKey } from "@/lib/ai/key-crypto"
import { getXCredentials, refreshAccessToken } from "@/lib/x/oauth"

// Getting a usable X access token, which on X is a job rather than a lookup.
//
// LinkedIn hands out a 60-day token and this layer wouldn't exist: read the
// column, decrypt, use it. X's access tokens last two hours, so almost every
// call needs a refresh first — and its refresh tokens are **rotating and
// single-use**, which turns an ordinary "renew if stale" into something with
// two ways to permanently break a connection:
//
//   1. Spending a refresh token and losing the replacement. X invalidates the
//      old one the moment it issues the new one, so a crash between the call
//      and the write leaves the row holding a token that no longer works. The
//      fix is ordering: persist the replacement *before* the access token
//      beside it is handed to anyone.
//   2. Two requests spending the same refresh token concurrently. One wins;
//      the other gets a rejection that looks exactly like revocation. The fix
//      is the refresh_started_at claim below, so only one request ever rotates.
//
// Neither is theoretical — a Connections page render and a background call
// landing together is enough for the second.
//
// Server-only: it decrypts stored tokens and reads the client secret.

// How long before expiry a token is treated as already stale. Long enough that
// a token fetched here can't lapse midway through the call it was fetched for.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000

// How long a refresh claim is honoured before another request may take it. A
// refresh is one HTTP round trip, so this is generous; its real job is making
// sure a request that died mid-refresh cannot wedge the connection forever.
const CLAIM_TIMEOUT_MS = 30 * 1000

// How long to wait for the request that holds the claim before giving up. It
// polls rather than blocking on a lock because the winner writes its result to
// the row, so the answer arrives by re-reading — no coordination needed beyond
// the claim itself.
const CLAIM_WAIT_TOTAL_MS = 10 * 1000
const CLAIM_POLL_INTERVAL_MS = 250

export type XTokenFailure =
  // No such row, or not this user's — RLS makes those identical, which is the
  // point.
  | "not_connected"
  // The connection is dead and only reconnecting fixes it. The row has been
  // marked, so the UI can say so.
  | "revoked"
  // X_CLIENT_ID / X_CLIENT_SECRET aren't set.
  | "config"
  // Couldn't tell — X was unreachable, rate-limited, or having a bad moment.
  // Explicitly *not* "revoked": the connection is probably fine and the next
  // attempt gets another go.
  | "unavailable"

export type XTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; failure: XTokenFailure }

interface TokenRow {
  encrypted_access_token: string
  encrypted_refresh_token: string | null
  expires_at: string
  status: string
  refresh_started_at: string | null
}

const TOKEN_COLUMNS =
  "encrypted_access_token, encrypted_refresh_token, expires_at, status, refresh_started_at"

async function readRow(
  supabase: SupabaseClient,
  accountId: string
): Promise<TokenRow | null> {
  const { data } = await supabase
    .from("social_accounts")
    .select(TOKEN_COLUMNS)
    .eq("id", accountId)
    .eq("platform", "x")
    .maybeSingle()

  return (data as TokenRow | null) ?? null
}

function isFresh(row: Pick<TokenRow, "expires_at">, now: number): boolean {
  const expiresAt = new Date(row.expires_at).getTime()
  // An unparseable timestamp reads as "stale", which costs a refresh rather
  // than handing out a token that may already be dead.
  if (Number.isNaN(expiresAt)) return false

  return expiresAt - now > EXPIRY_MARGIN_MS
}

// Decrypting can throw — GCM fails loudly on a row written under a different
// MODEL_KEY_ENCRYPTION_KEY, which is the point of using it. That is not a
// revocation, so it is reported as "couldn't tell" rather than killing the row.
function decryptOrNull(value: string): string | null {
  try {
    return decryptApiKey(value)
  } catch {
    return null
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// Take the refresh claim, or report that someone else holds it.
//
// The conditional update is the whole mechanism: Postgres applies the WHERE to
// one row at a time, so of two concurrent claims exactly one matches an
// unclaimed row and updates it, and the other matches nothing. `select` after
// `update` returns the rows actually written, so an empty result *is* the
// answer "someone else got there first".
async function claimRefresh(
  supabase: SupabaseClient,
  accountId: string,
  now: number
): Promise<boolean> {
  const staleBefore = new Date(now - CLAIM_TIMEOUT_MS).toISOString()

  const { data } = await supabase
    .from("social_accounts")
    .update({ refresh_started_at: new Date(now).toISOString() })
    .eq("id", accountId)
    .or(`refresh_started_at.is.null,refresh_started_at.lt.${staleBefore}`)
    .select("id")

  return (data?.length ?? 0) > 0
}

// Wait out the request that holds the claim, then use what it stored.
//
// It cannot simply fail: a Connections page render and a background call
// arriving together would otherwise make one of them report a broken
// connection over a token that was refreshed successfully a moment later.
async function waitForOtherRefresh(
  supabase: SupabaseClient,
  accountId: string
): Promise<XTokenResult> {
  const deadline = Date.now() + CLAIM_WAIT_TOTAL_MS

  while (Date.now() < deadline) {
    await sleep(CLAIM_POLL_INTERVAL_MS)

    const row = await readRow(supabase, accountId)
    if (!row) return { ok: false, failure: "not_connected" }
    if (row.status === "revoked") return { ok: false, failure: "revoked" }

    // The holder finished if it released the claim, and the token it wrote is
    // the one to use.
    if (!row.refresh_started_at && isFresh(row, Date.now())) {
      const accessToken = decryptOrNull(row.encrypted_access_token)
      if (!accessToken) return { ok: false, failure: "unavailable" }
      return { ok: true, accessToken }
    }
  }

  // The holder is slow or died. Its claim goes stale on its own after
  // CLAIM_TIMEOUT_MS, so the next attempt can take over — nothing is wedged.
  return { ok: false, failure: "unavailable" }
}

/**
 * A live X access token for one connected account, refreshing it first if the
 * stored one is at or near expiry.
 *
 * Callers get a token or a reason, never a stale token. A "revoked" result has
 * already been written to the row, so the Connections page reflects it without
 * the caller doing anything.
 */
export async function getLiveXAccessToken(
  supabase: SupabaseClient,
  accountId: string,
  now: number = Date.now()
): Promise<XTokenResult> {
  const row = await readRow(supabase, accountId)
  if (!row) return { ok: false, failure: "not_connected" }
  if (row.status === "revoked") return { ok: false, failure: "revoked" }

  if (isFresh(row, now)) {
    const accessToken = decryptOrNull(row.encrypted_access_token)
    if (accessToken) return { ok: true, accessToken }
    // Undecryptable: fall through and try to mint a fresh one, which is the
    // only thing that could recover this row without a reconnect.
  }

  if (!row.encrypted_refresh_token) {
    // Connected before offline.access was granted, or the token was stored by
    // something that didn't keep one. Nothing to renew with.
    return { ok: false, failure: "revoked" }
  }

  const credentials = getXCredentials()
  if (!credentials) return { ok: false, failure: "config" }

  if (!(await claimRefresh(supabase, accountId, now))) {
    return waitForOtherRefresh(supabase, accountId)
  }

  // From here the claim is held and must be released on every path out.
  try {
    const refreshToken = decryptOrNull(row.encrypted_refresh_token)
    if (!refreshToken) return { ok: false, failure: "unavailable" }

    const refreshed = await refreshAccessToken(credentials, refreshToken, now)

    if (!refreshed.ok) {
      if (refreshed.reason === "revoked") {
        // The definitive answer, and the only thing that sets this: the member
        // revoked Presto from X's settings, or the refresh token expired. The
        // stale tokens are cleared out with it — they cannot come back, and a
        // row that keeps them invites something to try them again.
        await supabase
          .from("social_accounts")
          .update({
            status: "revoked",
            encrypted_refresh_token: null,
            refresh_started_at: null,
            last_checked_at: new Date(now).toISOString(),
          })
          .eq("id", accountId)

        return { ok: false, failure: "revoked" }
      }

      // "unavailable" — X had a bad moment. The row is untouched apart from
      // releasing the claim, so the next attempt tries the same token again.
      await releaseClaim(supabase, accountId)
      return { ok: false, failure: "unavailable" }
    }

    const token = refreshed.value

    // **The write lands before the token is returned, and that ordering is the
    // whole point.** The refresh token just spent is already dead at X; if this
    // fails or never runs, the row holds a token that can never be redeemed and
    // the member has to reconnect. Returning the access token first would make
    // that window bigger for no gain.
    const { error } = await supabase
      .from("social_accounts")
      .update({
        encrypted_access_token: encryptApiKey(token.accessToken),
        // X always returns a replacement here. The fallback keeps the old
        // (now-dead) value rather than nulling the column, so a surprising
        // response leaves a row that reads as broken instead of one that reads
        // as never-had-a-refresh-token.
        encrypted_refresh_token: token.refreshToken
          ? encryptApiKey(token.refreshToken)
          : row.encrypted_refresh_token,
        expires_at: token.expiresAt.toISOString(),
        refresh_expires_at: token.refreshExpiresAt?.toISOString() ?? null,
        // A successful refresh is proof the connection is alive — which is why
        // X needs no polled liveness probe of the kind LinkedIn runs hourly,
        // and must not have one: the Free tier's read budget is shared across
        // every user of the app. See fetchXProfile in lib/x/oauth.ts.
        status: "active",
        last_checked_at: new Date(now).toISOString(),
        refresh_started_at: null,
      })
      .eq("id", accountId)

    if (error) {
      // The rotation happened at X but didn't land here. Say so rather than
      // handing back a token whose refresh counterpart is now unrecoverable —
      // the next attempt will find a dead refresh token and mark the row
      // revoked, which is the honest end state. Release the claim so that
      // attempt doesn't also have to wait out the timeout first.
      await releaseClaim(supabase, accountId)
      return { ok: false, failure: "unavailable" }
    }

    return { ok: true, accessToken: token.accessToken }
  } catch (error) {
    await releaseClaim(supabase, accountId)
    throw error
  }
}

async function releaseClaim(supabase: SupabaseClient, accountId: string) {
  await supabase
    .from("social_accounts")
    .update({ refresh_started_at: null })
    .eq("id", accountId)
}
