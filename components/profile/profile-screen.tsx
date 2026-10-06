"use client"

import * as React from "react"
import {
  ArrowArcLeft,
  Password,
  PencilSimple,
  Power,
  Robot,
  Trash,
} from "@phosphor-icons/react"

import { deleteProject } from "@/app/projects/actions"
import { ToastSlot } from "@/components/shared/toast-slot"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { PillInput } from "@/components/ui/pill-input"
import { Toast } from "@/components/ui/toast"
import { AvatarPicker } from "@/components/profile/avatar-picker"
import { useOnboarding } from "@/components/onboarding/onboarding-context"
import { ChangePasswordPanel } from "@/components/profile/change-password-panel"
import { EditableName } from "@/components/profile/editable-name"
import { ProfileDisclosure } from "@/components/profile/profile-disclosure"
import { ProfileRow } from "@/components/profile/profile-row"
import { RenameProjectModal } from "@/components/profile/rename-project-modal"
import { AiModelsPanel } from "@/components/settings/ai-models-panel"
import { withNetworkStatus } from "@/lib/network-status"
import { LOGIN_URL } from "@/lib/auth-routes"
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
        "flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface-danger text-text-inverse transition-[background-color,scale] duration-150 ease-out active:scale-[0.95] max-md:size-14",
        POWER_GLOW,
        className
      )}
    >
      <Power weight="bold" className="size-5 max-md:size-7" />
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
  projectName,
  queuedCount = 0,
  userId,
  avatarUrl,
  avatarGradientId,
  hasPassword,
  aiModels,
  logout,
}: {
  name: string
  email: string
  memberSince: string
  // Absent on the standalone /profile route — nothing on this screen is
  // project-scoped, so it only decides which path a write revalidates and
  // whether the tour row below belongs here.
  projectId?: string
  // In-project only, for Delete project's confirmation copy.
  projectName?: string
  queuedCount?: number
  userId: string
  avatarUrl: string | null
  avatarGradientId: string | null
  hasPassword: boolean
  aiModels: UserAiModel[]
  logout: () => Promise<void>
}) {
  const { restart } = useOnboarding()
  const [passwordOpen, setPasswordOpen] = React.useState(false)
  // The server-provided identity describes the first render. Once an OAuth
  // user adds a password, switch the disclosure immediately instead of making
  // them refresh before its label and fields catch up.
  const [passwordAdded, setPasswordAdded] = React.useState(false)
  const hasPasswordIdentity = hasPassword || passwordAdded
  const [modelsOpen, setModelsOpen] = React.useState(false)
  const [logoutOpen, setLogoutOpen] = React.useState(false)
  // A successful sign-out immediately replaces the document with the login
  // screen, so this only needs to be cleared when the request never lands.
  // It prevents a second confirmation while the current one is in flight.
  const [loggingOut, setLoggingOut] = React.useState(false)
  const handleLogout = async () => {
    setLoggingOut(true)

    const result = await withNetworkStatus(logout())

    // null means the request never landed and the global disconnected toast
    // already says why. A completed sign-out deliberately reloads the auth
    // surface, clearing the old app tree and its modal in one step.
    if (result === null) {
      setLoggingOut(false)
      return
    }
    window.location.assign(LOGIN_URL)
  }

  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  // Success redirects (the action throws Next's redirect), so like logging
  // out this only needs clearing when the delete didn't happen.
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  // Type-the-name confirmation. Trimmed so a stray space from copy-pasting
  // the name doesn't block it; otherwise exact, case included — the point is
  // to make the user look at which project this is.
  const [confirmName, setConfirmName] = React.useState("")
  const nameConfirmed =
    !!projectName && confirmName.trim() === projectName.trim()
  const handleDelete = async () => {
    if (!projectId || !nameConfirmed) return
    setDeleting(true)

    const result = await withNetworkStatus(deleteProject({ projectId }))

    // A successful delete redirects, which can settle this with no value at
    // all — the navigation is already underway, so leave the pending state up.
    if (result === undefined) return
    setDeleting(false)
    // null: the disconnected toast already explains it.
    if (result === null || result.network) return
    setDeleteOpen(false)
    setDeleteError(result.error)
  }

  return (
    <>
      <ToastSlot>
        <Toast
          open={deleteError !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteError(null)
          }}
          variant="danger"
          direction="top"
        >
          {deleteError}
        </Toast>
      </ToastSlot>
      {/* Same unified blur+opacity mount-in as every other section (see
          /create-project for the @starting-style rationale). */}
      <div className="flex flex-1 flex-col items-center justify-center gap-dist-lg py-pad-2xl transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:blur-[8px] md:p-pad-2xl">
        <div className="flex w-68 flex-col items-center gap-dist-md">
          <AvatarPicker
            userId={userId}
            initialUrl={avatarUrl}
            initialGradientId={avatarGradientId}
            size={56}
            mobileSize={72}
          />
          <div className="flex w-full flex-col gap-dist-sm text-center">
            <EditableName projectId={projectId} name={name} />
            {/* The email sits where "Member since" used to. It is deliberately
                not editable — changing the address on the account is a verified
                flow of its own, not an inline edit. */}
            <p className="truncate text-body-md text-text-subtle">{email}</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-dist-md md:w-78">
          <ProfileDisclosure
            icon={Password}
            label={hasPasswordIdentity ? "Change password" : "Set password"}
            open={passwordOpen}
            onOpenChange={setPasswordOpen}
          >
            <ChangePasswordPanel
              projectId={projectId}
              hasPassword={hasPasswordIdentity}
              onSuccess={() => {
                setPasswordAdded(true)
                setPasswordOpen(false)
              }}
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

          {/* In-project only: the tour narrates the sidebar step by step, and
              there is no sidebar out here for it to point at. `restart` would
              still "work" — the step is global, in localStorage — but nothing
              on this screen renders it, so the row would sit there doing
              nothing visible. */}
          {projectId && (
            <ProfileRow
              icon={ArrowArcLeft}
              label="Replay onboarding"
              onClick={restart}
            />
          )}

          {projectId && (
            <ProfileRow
              icon={PencilSimple}
              label="Rename project"
              onClick={() => setRenameOpen(true)}
            />
          )}

          {/* Last in the menu and the only red row: everything above it is
              reversible, this isn't. */}
          {projectId && (
            <ProfileRow
              icon={Trash}
              label="Delete project"
              tone="danger"
              onClick={() => setDeleteOpen(true)}
            />
          )}

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
            void handleLogout()
          }}
        />

        {projectId && (
          <RenameProjectModal
            open={renameOpen}
            onOpenChange={setRenameOpen}
            projectId={projectId}
            currentName={projectName ?? ""}
          />
        )}

        <ConfirmationModal
          open={deleteOpen}
          onOpenChange={(open) => {
            // Same as log out: the redirect ends this screen, so closing
            // mid-delete would only show a page that's about to vanish.
            if (deleting) return
            setDeleteOpen(open)
            // Every opening starts blank: a name left typed in from a
            // cancelled attempt would pre-arm the next one.
            if (!open) setConfirmName("")
          }}
          icon={<Trash weight="bold" className="size-12 text-icon-minimal" />}
          title="Delete project"
          description={deleteDescription(projectName, queuedCount)}
          actionLabel="Delete project"
          isPending={deleting}
          actionDisabled={!nameConfirmed}
          onConfirm={() => {
            void handleDelete()
          }}
        >
          <PillInput
            label="Type the project name to confirm"
            placeholder={projectName}
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && nameConfirmed && !deleting) {
                void handleDelete()
              }
            }}
            disabled={deleting}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </ConfirmationModal>
      </div>
    </>
  )
}

// Says what goes, and — the part worth stopping for — that anything queued
// won't go out. Published posts are already on LinkedIn and stay there; this
// only removes Presto's copy.
function deleteDescription(projectName: string | undefined, queued: number) {
  return (
    <>
      {projectName ? (
        <span className="text-body-lg-bold">{projectName}</span>
      ) : (
        "This project"
      )}{" "}
      will be deleted with its instructions, posts and connected accounts. This
      can&apos;t be undone.
      {queued > 0 &&
        ` ${queued} queued ${queued === 1 ? "post" : "posts"} will not go out.`}
    </>
  )
}
