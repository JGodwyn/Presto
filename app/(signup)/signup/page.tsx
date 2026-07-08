import { Suspense } from "react"

import { AuthShell } from "@/components/shared/auth-shell"
import { AuthFlow } from "./signup-flow"

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell><div className="w-full max-w-sm" /></AuthShell>}>
      <AuthFlow />
    </Suspense>
  )
}
