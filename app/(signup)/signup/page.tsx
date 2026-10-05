import { Suspense } from "react"

import { AuthShell } from "@/components/shared/auth-shell"
import { AuthFlow } from "./signup-flow"

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="w-full max-w-sm" />}>
        <AuthFlow />
      </Suspense>
    </AuthShell>
  )
}
