import { logout } from "@/app/(auth)/logout/actions"
import { LogoutButton } from "@/app/projects/[projectId]/profile/logout-button"

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Account and model preferences will live here.
      </p>
      <form action={logout} className="mt-6">
        <LogoutButton />
      </form>
    </div>
  )
}
