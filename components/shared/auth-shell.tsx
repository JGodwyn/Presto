import Image from "next/image"

// Shared full-bleed branded chrome for every screen in the auth/signup
// flow (create account, verify email, login) — they're all the same Figma
// shell with different content in the middle.
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface-4">
      <div className="absolute inset-x-0 bottom-0 h-[56vw] max-h-[810px] min-h-[420px] w-full">
        <Image
          src="/images/auth/signup-background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-6">
        {children}
      </div>

      <p className="absolute bottom-[7vw] left-1/2 -translate-x-1/2 text-heading-lg font-display text-text-inverse">
        Presto
      </p>
    </div>
  )
}

export { AuthShell }
