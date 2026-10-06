"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Folder, SpinnerGap } from "@phosphor-icons/react"

import { createProject } from "@/app/projects/actions"
import { useCreateProjectLeave } from "@/components/create-project/create-project-backdrop"
import { holdNavigationUntil } from "@/components/create-project/exit-gate"
import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { Toast } from "@/components/ui/toast"
import { withNetworkStatus } from "@/lib/network-status"

// toast.tsx's exit (EXIT.transition, 0.2s). On /create-project the side art
// waits for the toast to be gone before it retreats, so the two read as one
// sequence rather than overlapping.
const TOAST_EXIT_MS = 200
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Max mirrors the server action's schema and the DB check constraint.
const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "This is required")
    .max(80, "Keep it under 80 characters"),
})

type CreateProjectValues = z.infer<typeof createProjectSchema>

function CreateProjectModal({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [showCreatingToast, setShowCreatingToast] = React.useState(false)
  // The toast opens when the insert starts and stays up through the
  // navigation that follows it — this transition tracks the router.push leg
  // so the close effect below knows when everything has actually landed.
  const [isNavigating, startNavigation] = React.useTransition()
  const router = useRouter()
  const backdrop = useCreateProjectLeave()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
  })

  const onSubmit = async (values: CreateProjectValues) => {
    // Close the dialog before awaiting the insert, not after — its backdrop
    // sits above the toast, so waiting would hide "Creating project" behind
    // the modal for the whole server round-trip. Closing via setOpen (not
    // onOpenChange) skips the user-close reset(), so the typed name and any
    // errors survive in the form.
    setShowCreatingToast(true)
    setOpen(false)

    const result = await withNetworkStatus(createProject(values))

    // Never landed — put the dialog back untouched and let the disconnected
    // toast do the explaining rather than blaming the project name.
    if (result === null) {
      setShowCreatingToast(false)
      setOpen(true)
      return
    }

    if ("error" in result) {
      // Bring the dialog back with the error in the field's helper slot.
      setShowCreatingToast(false)
      setError("name", { message: result.error })
      setOpen(true)
      return
    }

    reset()

    // On /create-project the exit is a sequence: the "Creating project" toast
    // closes, then the side art retreats (the page's copy fading out as it
    // nears the end), and the projects page appears only once the art is
    // gone. Elsewhere (the /projects grid) there's no art, so the toast just
    // stays up through the push.
    //
    // The push goes out *now*, the moment the save lands, so /projects'
    // server render (dynamic, never prefetched — measured at 1.2–1.8s on the
    // dev server) overlaps the toast's exit and the retreat instead of
    // following them. The page holds itself back until the whole exit has
    // played (exit-gate.tsx), so starting early can't cut it short.
    if (backdrop) {
      holdNavigationUntil(
        (async () => {
          setShowCreatingToast(false)
          await wait(TOAST_EXIT_MS)
          await backdrop.leave()
        })()
      )
    }
    startNavigation(() => router.push("/projects"))
  }

  return (
    <>
      {/* Same top-center placement as the signup flow's toast, but `fixed`
          (there's no positioned shell to anchor to from inside a modal). */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          // Keep the progress toast only through the server action and its
          // following transition. Deriving this avoids an extra state update
          // when the transition completes.
          open={showCreatingToast && (isSubmitting || isNavigating)}
          onOpenChange={setShowCreatingToast}
          variant="info"
          direction="top"
          icon={<SpinnerGap weight="bold" className="animate-spin" />}
        >
          Creating project
        </Toast>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
      >
        {trigger ?? (
          <DialogTrigger
            render={<Button variant="brand" size="xl" className="w-full" />}
          >
            <Folder weight="bold" />
            Create project
          </DialogTrigger>
        )}

        <DialogContent>
          <DialogTitle>Create project</DialogTitle>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="contents"
          >
            {/* The example lives in the field's own helperText slot (not a
                sibling <p>) so it hugs the input at the field's dist-sm
                helper gap instead of the dialog's dist-lg column gap — per
                design feedback — and swaps with the validation message
                rather than stacking under it. */}
            <PillInput
              autoFocus
              placeholder="Project name"
              aria-invalid={!!errors.name}
              helperText={errors.name?.message ?? "Eg. Product design content"}
              {...register("name")}
            />

            <Button
              type="submit"
              variant="brand"
              size="xl"
              className="w-full"
              disabled={isSubmitting}
            >
              Create project
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { CreateProjectModal }
