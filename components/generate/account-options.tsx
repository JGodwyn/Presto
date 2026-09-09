import { Eyes } from "@phosphor-icons/react"

import type { SelectPillOption } from "@/components/generate/select-pill"
import { SocialIcon } from "@/components/shared/social-icon"
import type { PostPlatform } from "@/types/post"

// What the Generate page's account pill offers, from design-sync/
// generate-page-modal: a "Try out" row, then one row per social platform,
// greyed out unless this project actually has that platform connected.
//
// The value of a real account is its **platform**, not its social_accounts
// row id, and that's sound rather than lazy: public.social_accounts has a
// unique constraint on (project_id, platform), so within one project a
// platform identifies exactly one account. It also keeps the value that
// rides in localStorage and the /generating URL the same shape it has always
// been — the generating page reads it straight back as a PostPlatform.
export const TRY_OUT_ACCOUNT_ID = "tryout"

export type AccountValue = typeof TRY_OUT_ACCOUNT_ID | PostPlatform

// "X (Twitter)" rather than the export's bare "Twitter", matching what the
// Connections page (the screen you'd go to actually connect it) calls the
// same platform — same brand-casing correction as "Linkedin" → "LinkedIn"
// there.
const PLATFORM_LABELS: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X (Twitter)",
}

// The export's own order, and Connections' too.
const PLATFORM_ORDER: PostPlatform[] = ["linkedin", "x"]

export interface AccountOption extends SelectPillOption {
  value: AccountValue
  // The menu draws its icon at 20px and the pill trigger at 16px (both from
  // the export), so each option carries both rather than one being scaled to
  // stand in for the other.
  triggerIcon: React.ReactNode
}

// `connectedPlatforms` is the caller's health-filtered set of usable account
// rows. Expired and revoked connections remain visible on Connections so they
// can be repaired, but stay disabled here because generated scheduled posts
// must eventually publish through them.
export function buildAccountOptions(
  healthyPlatforms: PostPlatform[]
): AccountOption[] {
  const connected = new Set(healthyPlatforms)

  return [
    {
      // The one option that never depends on anything being connected, which
      // is why it leads the list and is what the pill falls back to. Its
      // Eyes icon rests at icon-minimal per the export — it's a stand-in, not
      // a brand.
      value: TRY_OUT_ACCOUNT_ID,
      label: "Try out",
      icon: <Eyes weight="bold" className="size-5 text-icon-minimal" />,
      triggerIcon: <Eyes weight="bold" className="size-4 text-icon-subtle" />,
    },
    ...PLATFORM_ORDER.map((platform) => ({
      value: platform,
      label: PLATFORM_LABELS[platform],
      // The full-colour brand marks (components/shared/social-icon.tsx) the
      // export's "Social Icons / Color=Original" instance draws — not
      // social-platform-options.tsx's 16px pair, whose X is Phosphor's
      // monochrome XLogo.
      icon: <SocialIcon platform={platform} className="size-5" />,
      triggerIcon: <SocialIcon platform={platform} className="size-4" />,
      disabled: !connected.has(platform),
    })),
  ]
}
