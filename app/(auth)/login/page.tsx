import { redirect } from "next/navigation"

// The real login screen now lives in the persisted /signup flow (so the
// segmented control's tab-switch animation has a component to animate
// across instead of a page remount) — this keeps /login as a working,
// bookmarkable entry point into that flow.
export default function LoginPage() {
  redirect("/signup?view=login")
}
