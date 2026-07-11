"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Folder } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const createProjectSchema = z.object({
  name: z.string().min(1, "This is required"),
})

type CreateProjectValues = z.infer<typeof createProjectSchema>

function CreateProjectModal() {
  const [open, setOpen] = React.useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
  })

  // No `projects` table yet — flow isn't wired to Supabase until that
  // schema is decided, so submitting just closes the modal for now.
  const onSubmit = async (values: CreateProjectValues) => {
    console.log("create project", values)
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button variant="brand" size="xl" className="w-full" />}>
        <Folder weight="bold" />
        Create project
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Create project</DialogTitle>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="contents"
        >
          <PillInput
            placeholder="Project name"
            aria-invalid={!!errors.name}
            helperText={errors.name?.message}
            {...register("name")}
          />

          <p className="text-body-md text-text-subtle">
            Eg. Product design content
          </p>

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
  )
}

export { CreateProjectModal }
