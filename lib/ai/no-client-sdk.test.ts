import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

// Guards the bundle boundary that lib/ai/model-constants.ts exists to protect.
//
// lib/ai/providers.ts builds its provider objects at module scope, so importing
// anything from a module that reaches it pulls the Anthropic, OpenAI, Groq and
// Google SDKs in whole — nothing tree-shakes. Five client components importing
// one string from lib/ai/generate.ts took `.next/static/chunks` from 3.7 MB to
// 6.9 MB, with a 1.07 MB chunk on four routes.
//
// The reason this is a test and not a comment: tsc, eslint, vitest and
// `next build` were **all green** while it was happening. Nothing in the normal
// gate set can see it; only diffing built bundles could. So the invariant is
// asserted directly on the source instead.

const ROOTS = ["app", "components", "hooks", "lib"]
const REPO = path.resolve(__dirname, "../..")

// Modules that reach a provider SDK, directly or transitively, and therefore
// must never be imported by a client component.
// Not only the AI SDKs any more. `lib/linkedin/publish` and `oauth` read the
// client secret and make the share call; `lib/supabase/service` builds a
// service-role client that bypasses RLS entirely. None may be reachable from a
// client component — and `lib/linkedin/scopes` is deliberately dependency-free
// precisely so the Connections page can import *it* instead.
const SERVER_ONLY = [
  "@/lib/ai/generate",
  "@/lib/ai/providers",
  "@/lib/ai/extract-file-text",
  "@/lib/linkedin/publish",
  "@/lib/linkedin/oauth",
  "@/lib/supabase/service",
  "@/lib/publish-runner",
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe("client components never reach a provider SDK", () => {
  it("no \"use client\" module imports a runtime value from a server-only AI module", () => {
    const offenders: string[] = []

    for (const root of ROOTS) {
      const dir = path.join(REPO, root)
      if (!fs.existsSync(dir)) continue

      for (const file of sourceFiles(dir)) {
        const src = fs.readFileSync(file, "utf8")
        if (!/^\s*["']use client["']/.test(src)) continue

        for (const mod of SERVER_ONLY) {
          // `import type { … }` is erased by the compiler and costs nothing.
          const runtimeImport = new RegExp(
            `import\\s+(?!type\\s)[^;]*?from\\s*["']${mod.replace("/", "\\/")}["']`,
            "s"
          )
          if (runtimeImport.test(src)) {
            offenders.push(`${path.relative(REPO, file)} → ${mod}`)
          }
        }
      }
    }

    expect(
      offenders,
      `These client components pull a provider SDK into the browser bundle. ` +
        `Import the value from "@/lib/ai/model-constants" instead:\n  ${offenders.join("\n  ")}`
    ).toEqual([])
  })

  it("model-constants.ts imports nothing, so it cannot become unsafe", () => {
    const src = fs.readFileSync(path.join(REPO, "lib/ai/model-constants.ts"), "utf8")
    expect(src).not.toMatch(/^\s*import\s/m)
  })
})
