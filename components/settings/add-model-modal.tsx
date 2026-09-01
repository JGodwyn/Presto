"use client"

import * as React from "react"
import { ArrowLeft, Key, Plus } from "@phosphor-icons/react"

import {
  addUserAiModel,
  listGatewayModels,
  listGatewayProviders,
  type GatewayModelOption,
  type GatewayProviderOption,
} from "@/app/projects/[projectId]/settings/model-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PillInput } from "@/components/ui/pill-input"
import { withNetworkStatus } from "@/lib/network-status"
import { FieldError } from "@/components/instructions/field-error"
import { ModelCombobox } from "@/components/settings/model-combobox"
import { ProviderCombobox } from "@/components/settings/provider-combobox"
import type { UserAiModel } from "@/types/ai-model"

// Two stages in one dialog. Splitting them isn't cosmetic: the model list
// can't be shown until the key has been checked, because checking the key is
// what proves it can reach the provider at all — and there's no point letting
// someone pick a model against a key that will fail on the first generation.
type Stage = "key" | "model"

// Google first if it's there — it's the provider the built-in model uses, so
// it's the one someone is most likely to already have a key for. Otherwise
// just the first alphabetically.
function preferredSlug(providers: GatewayProviderOption[]): string {
  return (
    providers.find((provider) => provider.slug === "google")?.slug ??
    providers[0]?.slug ??
    ""
  )
}

// The "Add a model" modal. Trigger swaps shape the same way
// WritingStyleModal's does: a labeled button for the card's empty state, an
// icon-only "+" in the header once models exist.
function AddModelModal({
  projectId,
  onAdded,
  compact = false,
  block = false,
}: {
  projectId?: string
  onAdded: (model: UserAiModel) => void
  compact?: boolean
  // Profile's expanded "AI models" panel draws the trigger full-width at the
  // export's 40px button size, rather than the inline `sm` the card uses.
  block?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [stage, setStage] = React.useState<Stage>("key")

  const [providers, setProviders] = React.useState<GatewayProviderOption[]>([])
  const [loadingProviders, setLoadingProviders] = React.useState(false)
  const [providerSlug, setProviderSlug] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")

  const [models, setModels] = React.useState<GatewayModelOption[]>([])
  const [model, setModel] = React.useState<GatewayModelOption | null>(null)
  const [label, setLabel] = React.useState("")

  const [verifying, setVerifying] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reset = () => {
    setStage("key")
    setProviderSlug("")
    setApiKey("")
    setModels([])
    setModel(null)
    setLabel("")
    setError(null)
  }

  // Loaded when the dialog opens rather than on mount — this costs a gateway
  // round trip, and the card renders on every visit to Connections whether or
  // not anyone opens the modal. Driven from the open event rather than an
  // effect on `open`: it's a one-off fetch, not state being kept in sync with
  // anything (see react-hooks/set-state-in-effect).
  const loadProviders = () => {
    // Already fetched on an earlier open. The catalog is worth keeping, but
    // reset() cleared the *selection* on close, so the default has to be
    // reapplied here — early-returning outright left the field reading
    // "Choose provider" with Continue permanently disabled (it's gated on
    // providerSlug), which is exactly what happened on every reopen.
    if (providers.length > 0) {
      if (!providerSlug) setProviderSlug(preferredSlug(providers))
      return
    }
    if (loadingProviders) return

    setLoadingProviders(true)
    void listGatewayProviders().then((result) => {
      setLoadingProviders(false)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setProviders(result.providers)
      setProviderSlug(preferredSlug(result.providers))
    })
  }

  const handleContinue = async () => {
    setError(null)
    setVerifying(true)

    const result = await withNetworkStatus(
      listGatewayModels({ providerSlug, apiKey })
    )

    setVerifying(false)

    // null = never reached the server, so this says nothing about the key.
    if (result === null) return

    if ("error" in result) {
      setError(result.error)
      return
    }

    setModels(result.models)
    setStage("model")
  }

  const handleSave = async () => {
    if (!model) return

    setError(null)
    setSaving(true)

    const result = await withNetworkStatus(
      addUserAiModel({
        projectId,
        providerSlug,
        gatewayModelId: model.id,
        label: label.trim() || model.name,
        apiKey,
      })
    )

    setSaving(false)

    if (result === null) return

    if ("error" in result) {
      setError(result.error)
      return
    }

    onAdded(result.model)
    setOpen(false)
    reset()
  }

  const selectedProvider = providers.find((p) => p.slug === providerSlug)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) loadProviders()
        else reset()
      }}
    >
      <DialogTrigger
        render={
          compact ? (
            <Button variant="brand" size="icon-sm" />
          ) : block ? (
            <Button variant="brand" size="xl" className="w-full" />
          ) : (
            <Button variant="brand" size="sm" className="self-start" />
          )
        }
      >
        <Plus weight="bold" />
        {compact ? <span className="sr-only">Add a model</span> : "Add a model"}
      </DialogTrigger>

      <DialogContent popupClassName="w-90">
        <DialogTitle>Add a model</DialogTitle>
        <DialogDescription className="text-body-lg">
          {stage === "key"
            ? "Bring your own API key. Your posts generate on your account, not Presto's."
            : `Pick which ${selectedProvider?.name ?? ""} model to generate with.`}
        </DialogDescription>

        {/* key'd per stage so each panel gets the codebase's small starting:
            entrance when swapped in (mount-in only, no exit). */}
        <div
          key={stage}
          className="flex flex-col gap-dist-lg transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          {stage === "key" ? (
            <>
              {loadingProviders ? (
                <p className="text-body-lg text-text-subtle">Loading providers…</p>
              ) : providers.length > 0 ? (
                <ProviderCombobox
                  providers={providers}
                  value={providerSlug}
                  onChange={setProviderSlug}
                />
              ) : null}

              <PillInput
                label="API key"
                type="password"
                // A text field followed by a type="password" field is exactly
                // the shape a browser's password manager looks for, so Dia (and
                // any Chromium browser) was autofilling an email into Provider
                // and a saved password into this one. `autoComplete="off"` does
                // not stop it — Chromium ignores that on password fields
                // specifically, because too many sites used it wrongly.
                // "new-password" is the documented signal that this is not a
                // credential to fill, and the data-* opt-outs cover 1Password,
                // LastPass and Bitwarden, which have their own heuristics.
                autoComplete="new-password"
                name="provider-api-key"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                placeholder={selectedProvider?.keyHint ?? "Paste your key"}
                icon={<Key weight="bold" />}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                aria-invalid={!!error}
                helperText="Encrypted. Presto never shows it again."
                helperTextClassName="font-medium"
              />
            </>
          ) : (
            <>
              <ModelCombobox
                models={models}
                value={model}
                // Prefill the name with the model's own — the common case is
                // wanting exactly that, and it's still a plain editable field.
                // Picking a different model overwrites it, which is right: the
                // name it's overwriting was one we chose, not one they typed.
                onChange={(next) => {
                  setModel(next)
                  setLabel(next.name)
                }}
              />
              <PillInput
                label="Name"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                placeholder={model?.name ?? "What to call it"}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                helperText="How it appears in Generate's model picker."
                helperTextClassName="font-medium"
              />
            </>
          )}
        </div>

        {/* -mt to pull it a little closer to the field above than
            DialogContent's own gap-dist-lg leaves by default. */}
        {error ? <FieldError message={error} className="-mt-dist-sm" /> : null}

        {stage === "key" ? (
          <Button
            variant="brand"
            size="xl"
            className="w-full"
            disabled={verifying || !providerSlug || !apiKey.trim()}
            onClick={handleContinue}
          >
            {/* Checking a key means a real round trip to the provider, which
                is slow enough to need saying so — see AGENTS.md's
                immediate-feedback rule. */}
            {verifying ? "Checking your key…" : "Continue"}
          </Button>
        ) : (
          <div className="flex gap-dist-md">
            <Button
              variant="secondary"
              size="xl"
              aria-label="Back"
              onClick={() => {
                setStage("key")
                setError(null)
                // The picked model belongs to the key that listed it. Keeping it
                // across a Back meant changing provider or key and saving a
                // model the new key may not even have.
                setModels([])
                setModel(null)
                setLabel("")
              }}
            >
              <ArrowLeft weight="bold" />
            </Button>
            <Button
              variant="brand"
              size="xl"
              className="flex-1"
              disabled={saving || !model}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { AddModelModal }
