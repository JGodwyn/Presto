import { redirect } from "next/navigation"

import { FORGOT_PASSWORD_URL } from "@/lib/auth-routes"

// The real forgot-password flow now lives in the persisted /signup flow
// (reachable via the login screen's "Reset it here" link) — this keeps
// /forgot-password as a working, bookmarkable entry point into that flow.
export default function ForgotPasswordPage() {
  redirect(FORGOT_PASSWORD_URL)
}
