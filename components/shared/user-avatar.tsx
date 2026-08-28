"use client"

import { GradientAvatar } from "@/components/shared/gradient-avatar"
import { useAvatarDisplay } from "@/hooks/use-avatar-url"
import { cn } from "@/lib/utils"

// The signed-in user's picture wherever it's shown read-only — the navbar
// chip, the create-project greeting. Profile's own avatar is the interactive
// one (components/profile/avatar-picker.tsx); this is the same result without
// the click target.
//
// No picture means the deterministic gradient for that user, not a shared
// default: see gradient-avatar.tsx for why the palette is hashed from the id
// rather than picked at random.
//
// A client component purely so it can subscribe to lib/avatar-store.ts: its
// callers are server components that would otherwise keep rendering the old
// picture until a full reload (see that file). `avatarUrl` stays the server's
// value and remains authoritative on every fresh load.
export function UserAvatar({
  userId,
  avatarUrl,
  gradientId,
  size = 32,
  className,
}: {
  userId?: string | null
  avatarUrl?: string | null
  gradientId?: string | null
  size?: number
  className?: string
}) {
  const display = useAvatarDisplay(avatarUrl, gradientId)

  if (!display.url) {
    return (
      <GradientAvatar
        seed={userId}
        gradientId={display.gradientId}
        size={size}
        className={className}
      />
    )
  }

  return (
    // object-cover on a square box is what centres any aspect ratio in the
    // circle — the image fills the frame and is cropped evenly, not squashed.
    // A plain <img>, not next/image: the host is the Supabase project's own
    // Storage domain, which would otherwise need whitelisting in next.config,
    // and these are already small, user-sized files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={display.url}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-full object-cover object-center", className)}
    />
  )
}
