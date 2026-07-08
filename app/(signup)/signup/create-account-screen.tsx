"use client"

import * as React from "react"
import Image from "next/image"
import { Envelope, Eye, EyeClosedIcon, EyeSlash, Lock, User } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { GoogleIcon } from "@/components/shared/google-icon"

function CreateAccountScreen() {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface-4">
      <div className="absolute inset-x-0 bottom-0 h-[56vw] max-h-[810px] min-h-[420px] w-full">
        <Image
          src="/images/auth/signup-background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-start gap-dist-xl">
          <SegmentedControl
            value="create-account"
            onValueChange={() => { }}
            items={[
              { label: "Create account", value: "create-account" },
              { label: "Login", value: "login", disabled: true },
            ]}
          />

          <h1 className="text-heading-md font-display text-text-bold">
            Create Account
          </h1>

          <div className="flex w-full flex-col gap-dist-lg">
            <PillInput
              type="email"
              placeholder="Email address"
              autoComplete="email"
              icon={<Envelope weight="bold" />}
            />
            <PillInput
              type="text"
              placeholder="Your name"
              autoComplete="name"
              icon={<User weight="bold" />}
            />
            <PillInput
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="new-password"
              icon={<Lock weight="bold" />}
              endAdornment={
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeClosedIcon weight="bold" />
                  ) : (
                    <Eye weight="bold" />
                  )}
                </button>
              }
            />
          </div>

          <div className="flex w-full gap-dist-md">
            <Button type="submit" variant="brand" size="xl" className="flex-1">
              Create Account
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="w-pad-5xl px-0"
              aria-label="Continue with Google"
            >
              <GoogleIcon className="size-6" />
            </Button>
          </div>
        </div>
      </div>

      <p className="absolute bottom-[7vw] left-1/2 -translate-x-1/2 text-heading-lg font-display text-text-inverse">
        Presto
      </p>
    </div>
  )
}

export { CreateAccountScreen }
