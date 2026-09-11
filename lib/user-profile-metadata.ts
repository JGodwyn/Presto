// OAuth providers refresh their standard profile claims (such as `name` and
// `avatar_url`) whenever the person signs in. Keep edits under Presto-owned
// keys instead: provider refreshes leave unrelated metadata intact, while the
// legacy fallbacks keep existing accounts looking the same until their first
// edit after this change.
type UserMetadata = Record<string, unknown> | undefined

const DISPLAY_NAME_KEY = "presto_display_name"
const AVATAR_URL_KEY = "presto_avatar_url"
const AVATAR_GRADIENT_KEY = "presto_avatar_gradient"
const AVATAR_PHOTO_CLEARED_KEY = "presto_avatar_photo_cleared"

function stringValue(metadata: UserMetadata, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" ? value : null
}

export function getDisplayName(metadata: UserMetadata) {
  return stringValue(metadata, DISPLAY_NAME_KEY) ?? stringValue(metadata, "name")
}

export function getAvatarUrl(metadata: UserMetadata) {
  const saved = stringValue(metadata, AVATAR_URL_KEY)
  if (saved) return saved
  if (metadata?.[AVATAR_PHOTO_CLEARED_KEY] === true) return null
  return stringValue(metadata, "avatar_url")
}

export function getAvatarGradientId(metadata: UserMetadata) {
  return (
    stringValue(metadata, AVATAR_GRADIENT_KEY) ??
    stringValue(metadata, "avatar_gradient")
  )
}

export const profileMetadataKeys = {
  displayName: DISPLAY_NAME_KEY,
  avatarUrl: AVATAR_URL_KEY,
  avatarGradient: AVATAR_GRADIENT_KEY,
  avatarPhotoCleared: AVATAR_PHOTO_CLEARED_KEY,
} as const
