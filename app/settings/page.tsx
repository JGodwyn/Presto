import { redirect } from "next/navigation"

// Settings merged into Profile, and Profile now has a real user-level route —
// so this old stub is a plain forward, with no project lookup left to do. The
// in-project /projects/<id>/settings keeps its own redirect to that project's
// profile.
export default function SettingsRedirectPage() {
  redirect("/profile")
}
