import { SpinnerGap } from "@phosphor-icons/react/dist/ssr"

// Shared instant-loading state for every in-project section (dashboard,
// instructions, generate, …): the chrome (navbar + sidebar) stays put while
// the incoming page streams in behind a centered spinner. This boundary also
// lets the router commit section navigations immediately, so the URL — and
// with it the sidebar's real active state — updates without waiting for the
// page's server work. Spin is linear per the animation standards (constant
// motion → linear); no entrance animation — a loading state should appear
// the instant it's needed.
export default function ProjectSectionLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <SpinnerGap
        weight="bold"
        className="size-8 animate-spin text-text-subtle"
      />
    </div>
  )
}
