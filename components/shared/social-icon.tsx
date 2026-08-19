import type * as React from "react"

import type { PostPlatform } from "@/types/post"

// The Figma "Social Icons" component at Color=Original — full-colour brand
// marks, so these can't be Phosphor's monochrome LinkedinLogo/XLogo. Inlined
// as SVG rather than dropped in public/images/ for the same reason as
// google-icon.tsx: a 20px mark shouldn't cost a request, and inlining is what
// lets one copy serve every size (both exports draw the identical mark, just
// at different viewBoxes).
//
// components/generate/social-platform-options.tsx still renders its own 16px
// LinkedIn image and a Phosphor XLogo. Pointing it at this component would
// make one source of truth, but it also changes how the X mark reads on the
// Generate and Content pages, so it's left alone until that's wanted.
const PATHS: Record<PostPlatform, React.ReactNode> = {
  linkedin: (
    <path
      d="M18.5236 0H1.47639C1.08483 0 0.709301 0.155548 0.432425 0.432425C0.155548 0.709301 0 1.08483 0 1.47639V18.5236C0 18.9152 0.155548 19.2907 0.432425 19.5676C0.709301 19.8445 1.08483 20 1.47639 20H18.5236C18.9152 20 19.2907 19.8445 19.5676 19.5676C19.8445 19.2907 20 18.9152 20 18.5236V1.47639C20 1.08483 19.8445 0.709301 19.5676 0.432425C19.2907 0.155548 18.9152 0 18.5236 0ZM5.96111 17.0375H2.95417V7.48611H5.96111V17.0375ZM4.45556 6.1625C4.11447 6.16058 3.7816 6.05766 3.49895 5.86674C3.21629 5.67582 2.99653 5.40544 2.8674 5.08974C2.73826 4.77404 2.70554 4.42716 2.77336 4.09288C2.84118 3.7586 3.0065 3.4519 3.24846 3.21148C3.49042 2.97107 3.79818 2.80772 4.13289 2.74205C4.4676 2.67638 4.81426 2.71133 5.12913 2.84249C5.44399 2.97365 5.71295 3.19514 5.90205 3.47901C6.09116 3.76288 6.19194 4.09641 6.19167 4.4375C6.19488 4.66586 6.15209 4.89253 6.06584 5.104C5.97959 5.31547 5.85165 5.50742 5.68964 5.66839C5.52763 5.82936 5.33487 5.95607 5.12285 6.04096C4.91083 6.12585 4.68389 6.16718 4.45556 6.1625ZM17.0444 17.0458H14.0389V11.8278C14.0389 10.2889 13.3847 9.81389 12.5403 9.81389C11.6486 9.81389 10.7736 10.4861 10.7736 11.8667V17.0458H7.76667V7.49306H10.6583V8.81667H10.6972C10.9875 8.22917 12.0042 7.225 13.5556 7.225C15.2333 7.225 17.0458 8.22083 17.0458 11.1375L17.0444 17.0458Z"
      fill="#0A66C2"
    />
  ),
  x: (
    <path
      d="M15.2718 1.58691H18.0831L11.9413 8.60649L19.1666 18.1586H13.5093L9.07828 12.3653L4.00821 18.1586H1.19528L7.76445 10.6503L0.833252 1.58691H6.63418L10.6394 6.88219L15.2718 1.58691ZM14.2852 16.4759H15.8429L5.78775 3.18119H4.11614L14.2852 16.4759Z"
      fill="black"
    />
  ),
}

function SocialIcon({
  platform,
  ...props
}: { platform: PostPlatform } & React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      {PATHS[platform]}
    </svg>
  )
}

export { SocialIcon }
