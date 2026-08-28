import * as React from "react"

import { cn } from "@/lib/utils"

// The Figma gradient avatar (public/images/create-project/avatar.svg) inlined
// so its three blurred blobs can take colours as props — that is the whole
// reason this isn't still an <Image>. The shape, filters and transforms are
// the export's own, untouched; only the fills are parameterised.
//
// On the literal hexes below: the first six are art rather than design tokens
// — an exception, and a partial one, since only palette 0 is actually the
// export's. The last six are the project's own colour ramps, read straight out
// of app/globals.css, so they need no exception at all. Palette 0 is the
// export's colours exactly, so a user who hashes to it sees precisely the
// avatar this app has always shown.
const BASE_FILL = "#F8F8F8"

// Each gradient carries a **stable id, and the stored pick is that id, never
// an array index** — an index would silently reassign everyone's avatar the
// moment this list is reordered or something is inserted mid-way.
export interface AvatarGradient {
  id: string
  colors: readonly [string, string, string]
}

export const AVATAR_GRADIENTS: readonly AvatarGradient[] = [
  // --- From the Figma exports. `sunset` is the original avatar.svg; the rest
  // come from design-sync/profilescreenpickprofile, whose 24 swatches contain
  // only these 6 distinct gradients (the other 18 are `sunset` repeated).
  { id: "sunset", colors: ["#FFAE73", "#FF00E5", "#FF0000"] },
  { id: "ember", colors: ["#FFE073", "#FFC700", "#FF5C00"] },
  { id: "sunbeam", colors: ["#FFBE73", "#FFFBA6", "#FFDA16"] },
  { id: "meadow", colors: ["#67CAE9", "#FCFF5C", "#8CD317"] },
  { id: "jade", colors: ["#39A880", "#89FFC6", "#28E19F"] },
  { id: "lagoon", colors: ["#5076FF", "#77FFCE", "#35B7E0"] },

  // --- Hand-picked. Invented for this feature rather than designed, and kept
  // by request ("the more the merrier") when the token set below was added.
  { id: "azure", colors: ["#73C2FF", "#00A3FF", "#0047FF"] },
  { id: "mint", colors: ["#7DFFA8", "#00E5B0", "#00A67D"] },
  { id: "amber", colors: ["#FFD873", "#FF9500", "#FF4D00"] },
  { id: "violet", colors: ["#C9A3FF", "#8B5CFF", "#4B00E5"] },
  { id: "blossom", colors: ["#FF9EC4", "#FF4D8D", "#D6006E"] },

  // --- Built from the token ramps in app/globals.css — every value is a real
  // --<family>-{200,400,600}, mirroring the export's light → saturated → deep
  // structure, so these need no colour exception at all.
  //
  // The hexes are written literally rather than through var(): these are SVG
  // `fill` attributes on filtered shapes, and the list is also read in plain
  // JS. Keep them in step with globals.css by hand — same arrangement as
  // EDGE_FADE_PX and the other paired literals in this codebase.
  { id: "flame", colors: ["#ffaa93", "#ff4901", "#a92e01"] },
  { id: "honey", colors: ["#ffe273", "#ffbf00", "#c29100"] },
  { id: "grove", colors: ["#6af26a", "#00db00", "#00a600"] },
  { id: "lime", colors: ["#08eb07", "#08ae07", "#007500"] },
  { id: "orchid", colors: ["#dcabff", "#c04ffe", "#8b01c2"] },
  { id: "poppy", colors: ["#ff8d8d", "#ff2929", "#dc0000"] },
]

export function gradientById(id: string | null | undefined) {
  if (!id) return undefined
  return AVATAR_GRADIENTS.find((gradient) => gradient.id === id)
}

// **Deterministic, never random.** A Math.random() pick would change on every
// render — the avatar would differ between the server render and hydration (a
// mismatch), and again on every navigation. Hashing a stable value instead
// means one user has one gradient, on every device, forever, with nothing
// stored and no schema involved.
//
// FNV-1a: small, dependency-free, and well spread for short strings like a
// uuid. The `>>> 0` keeps it an unsigned 32-bit int — JS bitwise ops are
// signed, so without it a hash with the top bit set goes negative and `%`
// returns a negative index.
export function avatarGradientFor(seed: string): AvatarGradient {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return AVATAR_GRADIENTS[(hash >>> 0) % AVATAR_GRADIENTS.length]
}

// `seed` should be the user's id — stable, unique, and already to hand
// wherever an avatar renders. Falls back to the export's own palette when
// there's no user (e.g. a signed-out shell).
export function GradientAvatar({
  seed,
  gradientId,
  size = 40,
  className,
}: {
  seed?: string | null
  // An explicit pick always wins; the hashed default is the fallback for
  // someone who has never chosen one.
  gradientId?: string | null
  size?: number
  className?: string
}) {
  // The export's filter and clip ids are fixed strings, so two of these on one
  // page (the navbar chip and the profile header) would define the same ids
  // twice and the browser would resolve both references to whichever won.
  // useId namespaces them per instance.
  const uid = React.useId().replace(/:/g, "")
  const gradient =
    gradientById(gradientId) ??
    (seed ? avatarGradientFor(seed) : AVATAR_GRADIENTS[0])
  const palette = gradient.colors

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <g clipPath={`url(#${uid}_clip0_55_3962)`}>
      <g filter={`url(#${uid}_filter0_dd_55_3962)`}>
      <circle cx="16" cy="16" r="16" fill={BASE_FILL}/>
      </g>
      <g opacity="0.8" filter={`url(#${uid}_filter1_f_55_3962)`}>
      <ellipse cx="15.8131" cy="15.6167" rx="15.8131" ry="15.6167" transform="matrix(-0.288205 -0.957569 0.936518 -0.35062 5.539 27.0961)" fill={palette[0]}/>
      </g>
      <g opacity="0.8" filter={`url(#${uid}_filter2_f_55_3962)`}>
      <ellipse cx="13.4181" cy="12.9975" rx="13.4181" ry="12.9975" transform="matrix(-0.482888 -0.875682 0.798496 -0.602 3.78387 29.6135)" fill={palette[1]}/>
      </g>
      <g opacity="0.8" filter={`url(#${uid}_filter3_f_55_3962)`}>
      <path d="M31.5297 -6.67447C38.6418 -0.857869 33.2253 28.4296 30.4749 26.5049C28.7972 25.3308 26.8136 15.399 21.5466 11.1427C18.1796 8.4219 12.1516 10.4073 8.31222 10.688C-1.53304 11.4081 24.3582 -12.5396 31.5297 -6.67447Z" fill={palette[2]}/>
      </g>
      </g>
      <defs>
      <filter id={`${uid}_filter0_dd_55_3962`} x="-12" y="-10" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="2"/>
      <feGaussianBlur stdDeviation="6"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.6875 0 0 0 0 0.744318 0 0 0 0 1 0 0 0 0.06 0"/>
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_55_3962"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="1"/>
      <feGaussianBlur stdDeviation="1"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.549757 0 0 0 0 0.610463 0 0 0 0 0.929167 0 0 0 0.05 0"/>
      <feBlend mode="normal" in2="effect1_dropShadow_55_3962" result="effect2_dropShadow_55_3962"/>
      <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_55_3962" result="shape"/>
      </filter>
      <filter id={`${uid}_filter1_f_55_3962`} x="-11.7161" y="-21.6277" width="54.6461" height="56.2122" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix"/>
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
      <feGaussianBlur stdDeviation="6" result="effect1_foregroundBlur_55_3962"/>
      </filter>
      <filter id={`${uid}_filter2_f_55_3962`} x="-16.5538" y="-16.0793" width="48.4734" height="52.2367" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix"/>
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
      <feGaussianBlur stdDeviation="6" result="effect1_foregroundBlur_55_3962"/>
      </filter>
      <filter id={`${uid}_filter3_f_55_3962`} x="-5.89307" y="-19.6003" width="52.942" height="58.1959" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix"/>
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
      <feGaussianBlur stdDeviation="6" result="effect1_foregroundBlur_55_3962"/>
      </filter>
      <clipPath id={`${uid}_clip0_55_3962`}>
      <rect width="32" height="32" rx="16" fill="white"/>
      </clipPath>
      </defs>
    </svg>
  )
}
