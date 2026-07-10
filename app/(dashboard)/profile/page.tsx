import { logout } from "@/app/(auth)/logout/actions"
import { LogoutButton } from "./logout-button"

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-muted-foreground">
        Your account details will live here.
      </p>
      <form action={logout} className="mt-6">
        <LogoutButton />
      </form>
    </div>
  )
}
