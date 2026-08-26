import Image from "next/image"
import { XLogo } from "@phosphor-icons/react"

// GeneratedPostCard's per-card social pill (tap-to-cycle, and the initial
// value each card is seeded with).
//
// The Generate page's *account* pill used to reuse this list too, but no
// longer does: its rows are driven by what this project has actually
// connected, and carry the export's own 20px brand marks —
// components/generate/account-options.tsx owns that shape now.
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
