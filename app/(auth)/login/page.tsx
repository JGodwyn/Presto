import { redirect } from "next/navigation"

import { LOGIN_URL } from "@/lib/auth-routes"

// The real login screen now lives in the persisted /signup flow (so the
// segmented control's tab-switch animation has a component to animate
// across instead of a page remount) — this keeps /login as a working,
// bookmarkable entry point into that flow.
export default function LoginPage() {
  redirect(LOGIN_URL)
}
