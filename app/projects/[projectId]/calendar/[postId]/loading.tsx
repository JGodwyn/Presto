import { GlowPanel } from "@/components/shared/glow-panel"
import { SectionSpinner } from "@/components/shared/section-spinner"

// Why this exists as its own boundary rather than leaning on the section-level
// one: a loading.tsx only applies to the segment it sits in and below, and
// without it a tap on a Kanban card sat on the Content page — doing nothing
// visible — until the post's server fetch came back. With it, the router
// commits the navigation immediately and this stands in while that runs, so
// the page opens on the tap.
//
// It renders the panel itself, not a bare spinner, so the frame the post
// arrives into is already there and only the content changes.
export default function PostDetailsLoading() {
  return (
    <div className="relative flex-1">
      <div className="absolute inset-0 flex flex-col">
        <GlowPanel showInfoMarker={false}>
          <div className="flex flex-1 items-center justify-center">
            <SectionSpinner />
          </div>
        </GlowPanel>
      </div>
    </div>
  )
}
