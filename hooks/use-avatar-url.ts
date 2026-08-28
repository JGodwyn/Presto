"use client"

import * as React from "react"

import {
  getAvatarGradientOverride,
  getAvatarGradientOverrideServerSnapshot,
  getAvatarOverride,
  getAvatarOverrideServerSnapshot,
  getAvatarPhotoCleared,
  getAvatarPhotoClearedServerSnapshot,
  subscribeToAvatar,
} from "@/lib/avatar-store"

// What to render: whatever this tab last set, else what the server rendered.
// See lib/avatar-store.ts for why the overrides exist at all.
//
// `photoCleared` is the one that isn't obvious: picking a gradient removes the
// photo, and a `null` override can't otherwise be told apart from "this tab
// never touched it", which would let the server's stale photo win and make the
// pick look ignored.
export function useAvatarDisplay(
  serverUrl?: string | null,
  serverGradientId?: string | null
): { url: string | null; gradientId: string | null } {
  const override = React.useSyncExternalStore(
    subscribeToAvatar,
    getAvatarOverride,
    getAvatarOverrideServerSnapshot
  )
  const cleared = React.useSyncExternalStore(
    subscribeToAvatar,
    getAvatarPhotoCleared,
    getAvatarPhotoClearedServerSnapshot
  )
  const gradientOverride = React.useSyncExternalStore(
    subscribeToAvatar,
    getAvatarGradientOverride,
    getAvatarGradientOverrideServerSnapshot
  )

  return {
    url: override ?? (cleared ? null : (serverUrl ?? null)),
    gradientId: gradientOverride ?? serverGradientId ?? null,
  }
}
