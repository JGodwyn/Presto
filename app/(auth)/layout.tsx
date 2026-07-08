// Login now owns its own full-bleed AuthShell chrome (matches the Figma
// login screen), so this group layout no longer imposes a shared wrapper —
// forgot-password keeps its own centered-card wrapper directly in its page
// until it gets the same redesign treatment.
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
