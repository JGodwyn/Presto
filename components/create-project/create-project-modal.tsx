"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Folder, SpinnerGap } from "@phosphor-icons/react"

import { createProject } from "@/app/projects/actions"
import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { Toast } from "@/components/ui/toast"
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

    const result = await createProject(values)

    if ("error" in result) {
      // Bring the dialog back with the error in the field's helper slot.
      setShowCreatingToast(false)
      setError("name", { message: result.error })
      setOpen(true)
      return
    }

    reset()
    startNavigation(() => router.push("/projects"))
  }

  // Slide the toast back out once the navigation commits. (When creating
  // from /create-project the whole page — this component included — unmounts
  // at that same moment, so the toast leaves with it; the exit transition
  // only gets to play for creations made from /projects itself.)
  React.useEffect(() => {
    if (!isNavigating) setShowCreatingToast(false)
  }, [isNavigating])

  return (
    <>
      {/* Same top-center placement as the signup flow's toast, but `fixed`
          (there's no positioned shell to anchor to from inside a modal). */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          open={showCreatingToast}
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
