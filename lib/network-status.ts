"use client"

import { isNetworkError } from "@/lib/network-error"

// A tiny module-level store rather than React context: the things that report
// a network problem are mostly event handlers and action call sites, not
// components. components/shared/network-status.tsx subscribes and renders the
// toast.
//
// Reporting is explicit at every call site — see withNetworkStatus below,
// which is the standard way to call a server action from a client component.

let offline = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToNetworkStatus(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getNetworkOffline() {
  return offline
}

// useSyncExternalStore needs a server snapshot that never changes; the server
// has no opinion about the browser's connectivity, so it's always "online".
export function getNetworkOfflineServerSnapshot() {
  return false
}

export function reportNetworkIssue() {
  if (offline) return
  offline = true
  emit()
}

export function reportNetworkReachable() {
  if (!offline) return
  offline = false
  emit()
}

/**
 * The standard way to call a server action (or any request-performing promise)
 * from a client component.
 *
 * A dropped connection rejects the underlying fetch, which without this would
 * either crash the component or — worse — be caught by a generic handler and
 * reported as though the *server* had rejected the request ("couldn't save
 * your changes", "incorrect password"). This raises the global disconnected
 * toast instead and hands back `null`, which callers should treat as "stop
 * here, the user has already been told why". Any other rejection is rethrown
 * untouched, so real bugs still surface.
 *
 *     const result = await withNetworkStatus(saveInstructions(payload))
 *     if (result === null) return
 *
 * Note this only covers failures the *browser* saw. When the request reaches
 * the server and the server is what couldn't connect, the action returns
 * `{ network: true }` (lib/network-error.ts) and the call site calls
 * reportNetworkIssue() directly — both paths end at the same toast.
 */
export async function withNetworkStatus<T>(request: Promise<T>): Promise<T | null> {
  try {
    const value = await request
    // Not cleared outright: reaching *our* server isn't proof the connection
    // is back (in development localhost answers with the wifi off), and if the
    // action's own result then reports a server-side network failure the toast
    // would visibly flicker off and straight back on. probeNetwork is the only
    // thing allowed to clear the flag, and this only asks when it's actually
    // set, so the common path costs nothing.
    if (offline) void probeNetwork()
    return value
  } catch (error) {
    if (isNetworkError(error)) {
      reportNetworkIssue()
      return null
    }
    // Server actions signal redirects by throwing; those must keep bubbling.
    throw error
  }
}

// Probing the app's own origin proves almost nothing: in development that's
// localhost, which answers perfectly happily with the wifi switched off — so
// the toast used to clear itself a few seconds after appearing. This probes
// the backend the app actually depends on instead, which is the thing the
// user's connection has to reach for anything here to work.
//
// `mode: "no-cors"` is deliberate. It makes the result binary in exactly the
// way this needs: a reachable server resolves (as an opaque response we never
// read), and only a genuine connectivity failure rejects. Without it a CORS
// or 4xx quirk could masquerade as being offline.
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL

// Cheap round-trip used to notice reconnection, and to decide whether the
// error boundary should keep retrying. Caching is off so it can never be
// answered from disk.
export async function probeNetwork(): Promise<boolean> {
  try {
    await fetch(
      BACKEND_ORIGIN ? `${BACKEND_ORIGIN}/auth/v1/health` : "/favicon.ico",
      { mode: "no-cors", cache: "no-store" }
    )
    reportNetworkReachable()
    return true
  } catch (error) {
    if (isNetworkError(error)) reportNetworkIssue()
    return false
  }
}
