import { TexturedGradient } from "@/components/shared/textured-gradient"

// Shared full-bleed branded chrome for every screen in the auth/signup
// flow (create account, verify email, login) — they're all the same Figma
// shell with different content in the middle. Rendered once by the page,
// outside the flow's Suspense boundary, so the gradient's entrance plays once
// instead of restarting when the fallback is swapped for the real flow.
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-dvh min-h-0 w-full overflow-clip bg-surface-4">
      {/* Built in code like the landing hero rather than a raster, so it
          stays crisp at any width and animates in. The band keeps the old
          image's box — the auth preset's stops are placed for this aspect. */}
      <div className="absolute inset-x-0 bottom-0 h-[56vw] max-h-[810px] min-h-[420px] w-full">
        <TexturedGradient variant="auth" />
      </div>

      <div className="relative flex h-full min-h-0 items-center justify-center p-6">
        {children}
      </div>

      <p className="absolute bottom-[7vw] left-1/2 -translate-x-1/2 text-heading-lg font-display text-text-inverse">
        Presto
      </p>
    </div>
  )
}

export { AuthShell }
