// `[&::-webkit-scrollbar]:hidden` covers Chrome/Safari, `[scrollbar-width:none]`
// covers Firefox — pair with a scrollable element wherever the browser's own
// scrollbar shouldn't show (see hooks/use-scroll-thumb.ts for the app-wide
// custom-thumb pattern this is normally paired with).
//
// Deliberately its own plain module, not exported from use-scroll-thumb.ts
// directly: that file is "use client", and a Server Component importing
// *anything* from a "use client" module — even a inert string constant —
// gets routed through React's client-reference substitution and silently
// resolves to nothing rather than the real value. app/projects/[projectId]/
// layout.tsx (a Server Component) needs this constant too, so it has to live
// somewhere with no "use client" directive at all.
export const HIDE_NATIVE_SCROLLBAR_CLASSNAME =
  "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
