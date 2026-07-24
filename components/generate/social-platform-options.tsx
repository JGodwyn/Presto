import Image from "next/image"
import { XLogo } from "@phosphor-icons/react"

// Shared between GenerateCard's account SelectPill (choosing which social
// the whole batch posts to) and GeneratedPostCard's own per-card social
// pill (tap-to-cycle, and the initial value each card is seeded with) — one
// canonical list rather than two, so a platform added here shows up
// correctly in both places automatically.
export type SocialPlatform = "linkedin" | "x"

export interface SocialPlatformOption {
  value: SocialPlatform
  label: string
  icon: React.ReactNode
}

export const SOCIAL_PLATFORM_OPTIONS: SocialPlatformOption[] = [
  {
    value: "linkedin",
    label: "LinkedIn",
    icon: (
      <Image src="/images/generate/linkedin.svg" alt="" width={16} height={16} />
    ),
  },
  { value: "x", label: "X", icon: <XLogo className="size-4" /> },
]
