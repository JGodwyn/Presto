"use client"

import * as React from "react"
import { ArrowArcLeft, Password, Power, Robot } from "@phosphor-icons/react"

import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { AvatarPicker } from "@/components/profile/avatar-picker"
import { useOnboarding } from "@/components/onboarding/onboarding-context"
import { ChangePasswordPanel } from "@/components/profile/change-password-panel"
import { EditableName } from "@/components/profile/editable-name"
import { ProfileDisclosure } from "@/components/profile/profile-disclosure"
import { ProfileRow } from "@/components/profile/profile-row"
import { AiModelsPanel } from "@/components/settings/ai-models-panel"
import { cn } from "@/lib/utils"
import type { UserAiModel } from "@/types/ai-model"

// The export's power button carries a red glow: a drop shadow dilated 4px,
// offset 4px down, blurred (stdDeviation 8 → a 16px CSS blur), in #a20000 at
// 20%. Not a token — same exception as the app's other literal shadows.
const POWER_GLOW = "shadow-[0px_4px_16px_4px_rgba(162,0,0,0.2)]"

// The red circular log-out button. It asks before signing anyone out rather
// than doing it on the click: a 40px unlabelled circle is easy to hit by
// accident, and being signed out is a slow thing to undo.
function PowerButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Log out"
      className={cn(
        "flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface-danger text-text-inverse transition-[background-color,scale] duration-150 ease-out active:scale-[0.95]",
        POWER_GLOW,
        className
      )}
    >
      <Power weight="bold" className="size-5" />
    </button>
  )
}

// Profile, from the Figma "ProfileScreen" export: one centred column —
// avatar, name, member-since, three menu rows, and the log-out button — on the
// plain surface-3 canvas (no GlowPanel; the export puts the content straight
// on the page background, same as Connections).
//
// The export's "n connections active" pill sat under the member-since line;
// it was removed by request. `ConnectionCountBadge` (components/shared/) is
// still the Connections screen's own, so it stays shared rather than inlined
// back there — that's where it's earned.
//
// The export shows no email and no editable name, so neither is here. It also
// gives "Replay onboarding" a real home, which is what the understated dev
// button on the dashboard was standing in for.
//
// Change password and AI models expand in place (see the "expanded" export)
// rather than leading anywhere. The two open independently — the export shows
// both open at once, so this isn't a one-at-a-time accordion.
export function ProfileScreen({
  name,
  email,
  memberSince,
  projectId,
  userId,
  avatarUrl,
  avatarGradientId,
  aiModels,
  logout,
}: {
  name: string
  email: string
  memberSince: string
  projectId: string
  userId: string
  avatarUrl: string | null
  avatarGradientId: string | null
  aiModels: UserAiModel[]
  logout: () => Promise<void>
}) {
  const { restart } = useOnboarding()
  const [passwordOpen, setPasswordOpen] = React.useState(false)
  const [modelsOpen, setModelsOpen] = React.useState(false)
  const [logoutOpen, setLogoutOpen] = React.useState(false)
  // `logout` redirects, so this pending flag is never cleared on the success
  // path — the page is gone before it could be. It exists to keep the button
  // from being pressed twice while the sign-out is in flight.
  const [loggingOut, setLoggingOut] = React.useState(false)

  return (
    // Same unified blur+opacity mount-in as every other section (see
    // /create-project for the @starting-style rationale).
    <div className="flex flex-1 flex-col items-center justify-center gap-dist-lg p-pad-2xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px]">
      <div className="flex w-68 flex-col items-center gap-dist-md">
        <AvatarPicker
          userId={userId}
          initialUrl={avatarUrl}
          initialGradientId={avatarGradientId}
          size={56}
        />
        <div className="flex w-full flex-col gap-dist-sm text-center">
          <EditableName projectId={projectId} name={name} />
          {/* The email sits where "Member since" used to. It is deliberately
              not editable — changing the address on the account is a verified
              flow of its own, not an inline edit. */}
          <p className="truncate text-body-md text-text-subtle">{email}</p>
        </div>
      </div>

      <div className="flex w-78 flex-col gap-dist-md">
        <ProfileDisclosure
          icon={Password}
          label="Change password"
          open={passwordOpen}
          onOpenChange={setPasswordOpen}
        >
          <ChangePasswordPanel
            projectId={projectId}
            onSuccess={() => setPasswordOpen(false)}
          />
        </ProfileDisclosure>

        <ProfileDisclosure
          icon={Robot}
          label="AI models"
          open={modelsOpen}
          onOpenChange={setModelsOpen}
          // The export spaces this panel from its header by dist-lg, where
          // Change password uses dist-md.
          contentGapClassName="pt-dist-lg"
        >
          <AiModelsPanel projectId={projectId} initial={aiModels} />
        </ProfileDisclosure>

        <ProfileRow
          icon={ArrowArcLeft}
          label="Replay onboarding"
          onClick={restart}
        />

        {/* Moved down from under the name, by request. It reads as a footnote
            to the account rather than a caption on the person, so it sits
            below the menu instead of competing with the email.

            mt-dist-md on top of the column's own dist-md gives it 16px of
            clearance, so it separates from the menu instead of looking like a
            fourth row that lost its card. */}
        <p className="mt-dist-md text-center text-body-md text-text-subtle">
          {memberSince}
        </p>
      </div>

      {/* mt-dist-lg on top of the column's own dist-lg puts 32px between the
          menu and the log-out button, against the export's 16px — by request.
          It reads as the separation it now is: everything above manages the
          account, this ends the session. */}
      <PowerButton
        className="mt-dist-lg"
        onClick={() => setLogoutOpen(true)}
      />

      {/* The app's standard confirmation layout (components/ui/confirmation-
          modal.tsx, design-sync/defaultconfirmationmodal) — one full-width
          danger action, no separate Cancel; the dialog's own top-right X is
          the dismiss. */}
      <ConfirmationModal
        open={logoutOpen}
        onOpenChange={(open) => {
          // Not dismissable while the sign-out is running: the redirect is
          // what ends this screen, and closing early would just show a dead
          // page for a moment.
          if (loggingOut) return
          setLogoutOpen(open)
        }}
        // Per the disconnect modal's own note: the icon shows the state the
        // button leads to, so it's the same Power glyph that opened this.
        icon={<Power weight="bold" className="size-12 text-icon-minimal" />}
        title="Log out"
        description="You'll need to sign in again to get back to your projects. Nothing you've made is affected."
        actionLabel="Log out"
        isPending={loggingOut}
        onConfirm={() => {
          setLoggingOut(true)
          void logout()
        }}
      />
    </div>
  )
}
