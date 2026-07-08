import { redirect } from "next/navigation"

// The real forgot-password flow now lives in the persisted /signup flow
// (reachable via the login screen's "Reset it here" link) — this keeps
// /forgot-password as a working, bookmarkable entry point into that flow.
export default function ForgotPasswordPage() {
  redirect("/signup?view=forgot-password")
}
