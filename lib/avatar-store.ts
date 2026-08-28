"use client"

// The signed-in user's avatar URL, as last set *in this tab*.
//
// The problem this solves: every avatar in the app renders from a server
// component reading auth `user_metadata` — the navbar chip in the project
// layout, the create-project greeting. The picker on Profile writes the new
// URL straight from the browser to Supabase, so those server components have
// no idea anything changed and keep showing the old picture until the next
// full server render. That's the "I need to refresh for it to update" bug.
//
// A module-level store rather than context, for the same reason
// lib/generation-lock.ts and lib/network-status.ts are: the writer (the picker
// on the page) sits *below* the reader (the navbar chip in the layout) in the
// tree, so a provider would have to be threaded through the layout to connect
// them.
//
// `null` means "nothing set in this tab" — fall back to whatever the server
// rendered, which is authoritative on every fresh load and every navigation.

// Two channels, because a photo and a gradient are separate facts: picking a
// gradient clears the photo, and `null` on either means "nothing set in this
// tab — use whatever the server rendered".
let overrideUrl: string | null = null
let overrideGradientId: string | null = null
// A photo override of `null` is ambiguous on its own — it can't be told from
// "never set" — so a cleared photo is recorded explicitly.
let photoCleared = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToAvatar(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAvatarOverride() {
  return overrideUrl
}

// useSyncExternalStore needs a server snapshot that never changes. A server
// render can't know about a picture uploaded in this browser tab, and the
// override is only ever written from a client handler, so it starts empty.
export function getAvatarOverrideServerSnapshot(): string | null {
  return null
}

export function setAvatarOverride(url: string | null) {
  if (overrideUrl === url && (url !== null || photoCleared)) return
  overrideUrl = url
  photoCleared = url === null
  emit()
}

export function getAvatarPhotoCleared() {
  return photoCleared
}

export function getAvatarPhotoClearedServerSnapshot() {
  return false
}

export function getAvatarGradientOverride() {
  return overrideGradientId
}

export function getAvatarGradientOverrideServerSnapshot(): string | null {
  return null
}

export function setAvatarGradientOverride(id: string | null) {
  if (overrideGradientId === id) return
  overrideGradientId = id
  emit()
}
