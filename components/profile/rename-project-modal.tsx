"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SpinnerGap } from "@phosphor-icons/react"

import { renameProject } from "@/app/projects/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PillInput } from "@/components/ui/pill-input"
import { withNetworkStatus } from "@/lib/network-status"

// Same rules as Create project — the server action's schema and the DB check
// constraint both cap the name at 80.
const renameProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "This is required")
    .max(80, "Keep it under 80 characters"),
})

type RenameProjectValues = z.infer<typeof renameProjectSchema>

// Create project's dialog, pointed at an existing project: one field,
// prefilled with the current name, and a single action. Unlike Create it
// stays open while saving — there's no navigation to cover, so the button's
// own spinner is the feedback, and a failure lands in the field's helper slot
// without the dialog having to reappear.
export function RenameProjectModal({
  open,
  onOpenChange,
  projectId,
  currentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  currentName: string
}) {
  // Lifted out of the form so the dialog can refuse to close mid-save.
  const [saving, setSaving] = React.useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogTitle>Rename project</DialogTitle>
        {/* DialogContent only mounts its children while open, so the form
            starts fresh — from the saved name — on every opening. */}
        <RenameProjectForm
          projectId={projectId}
          currentName={currentName}
          onSavingChange={setSaving}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function RenameProjectForm({
  projectId,
  currentName,
  onSavingChange,
  onDone,
}: {
  projectId: string
  currentName: string
  onSavingChange: (saving: boolean) => void
  onDone: () => void
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RenameProjectValues>({
    resolver: zodResolver(renameProjectSchema),
    defaultValues: { name: currentName },
  })

  const onSubmit = async ({ name }: RenameProjectValues) => {
    // Nothing changed: closing is the whole answer, no round trip.
    if (name === currentName.trim()) {
      onDone()
      return
    }

    onSavingChange(true)
    const result = await withNetworkStatus(renameProject({ projectId, name }))
    onSavingChange(false)

    // Never landed — the disconnected toast explains it; keep what was typed.
    if (result === null) return

    if ("error" in result) {
      if (!result.network) setError("name", { message: result.error })
      return
    }

    // The action revalidated the project layout, so the sidebar and the
    // Profile screen's props pick up the new name with the same response.
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <PillInput
        autoFocus
        placeholder="Project name"
        // In the DOM from creation (react-hook-form only writes its default in
        // after mount), so the select-on-focus below has text to select and
        // typing replaces the old name rather than appending to it.
        defaultValue={currentName}
        aria-invalid={!!errors.name}
        helperText={errors.name?.message}
        disabled={isSubmitting}
        onFocus={(event) => event.currentTarget.select()}
        {...register("name")}
      />

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <SpinnerGap weight="bold" className="animate-spin" />
        ) : (
          "Save"
        )}
      </Button>
    </form>
  )
}
