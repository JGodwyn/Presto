import { Eyes } from "@phosphor-icons/react"

import { SOCIAL_PLATFORM_OPTIONS } from "@/components/generate/social-platform-options"
import type { PostAccount } from "@/lib/post-account"

// The 16px mark that leads a post card's account pill. The brand icon in the
// ordinary case — a post still goes out *somewhere*, and the platform is what
// says where, even when the name beside it is the account's.
//
// The exception is a try-out post, which has no platform behind it worth
// branding: it borrows the Generate page's own stand-in icon
// (components/generate/account-options.tsx), at icon-subtle rather than that
// menu's icon-minimal since here it sits on a filled pill rather than a
// dropdown row.
export function PostAccountIcon({ account }: { account: PostAccount }) {
  if (account.isTryout) {
    return <Eyes weight="bold" className="size-4 text-icon-subtle" />
  }

  const option = SOCIAL_PLATFORM_OPTIONS.find(
    (entry) => entry.value === account.platform
  )
  return option ? option.icon : null
}
