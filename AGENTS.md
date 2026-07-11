<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:presto-agent-rules -->
# Presto — Agent Rules

This file is read automatically by Claude Code, Antigravity, and other AI coding tools that support this format. Keep it short — it loads on every message.

## What this is

Presto is a personal tool that generates, organizes, and schedules social media posts (LinkedIn first, then X). Being built solo, vibe-coded, for personal use first. Public release comes after it's tested.

## Stack — fixed, do not change without asking

- Next.js 14+, App Router
- TypeScript (always — no plain .js files)
- Tailwind CSS
- Supabase — auth, database, file storage
- Vercel — hosting, cron jobs
- Vercel AI SDK + Zod — post generation, streaming, structured output
- shadcn/ui — base components, restyled to match tokens
- React Hook Form — all forms

If a task seems to need a different tool or library, stop and ask instead of adding one.

## Design tokens — strict rule

Exported from Figma as JSON, two files:
- `/design-tokens/foundations.json` — colors, spacing/padding, corner radius, stroke width
- `/design-tokens/typography.json` — font family, size, weight, line height

`tailwind.config.ts` reads its values from these files only.

- Never invent a color, spacing value, corner radius, stroke width, or font size.
- No hardcoded hex codes, px values, or font names in any component.
- If a value you need isn't in the token files, ask — don't guess a close one.
- Any element with a corner radius must use corner smoothing (Figma's "squircle" curve), never plain CSS `border-radius`. Use the `figma-squircle` package via the `useSquircleClipPath` hook (`hooks/use-squircle-clip-path.ts`) — see `components/ui/segmented-control.tsx` for the reference implementation. Keep the matching `rounded-rad-*` class alongside it as the fallback shape before the clip-path is measured on mount.

## Navigation

**Sidebar:** Dashboard, Instructions, Generate, Content Calendar, Connections
**Navbar:** Profile, Settings

Instructions covers both instructions and resources — one combined section, not two.

## Where the full specs live

- `Presto_PRD_v1_1.docx` — what the product does, feature by feature
- `Presto_UX_Reference_v1_0.docx` — how each screen behaves, states, edge cases

Read the relevant section before building a page for the first time. Don't ask the user to repeat something that's already written down in these.

## Folder structure

```
/app
  /(auth)          → login, forgot-password
  /(signup)        → signup — own route group for its full-bleed branded layout
  /(dashboard)     → dashboard, instructions, generate, calendar, connections, settings
/components
  /ui              → shadcn base components, restyled to tokens
  /shared          → used across more than one page
  /generate, /calendar, /instructions  → feature-specific components
/lib
  /supabase        → client setup, queries
  /ai              → generation wrapper, prompt building
/types
  post.ts
  instructions.ts
/design-tokens
  foundations.json
  typography.json
```

## Shared data shapes

`types/post.ts` and `types/instructions.ts` are the single definition of what a post and an instructions set look like. Every page reads and writes through these two files. Never create a slightly different version of either shape somewhere else — edit the shared one.

## Conventions

- Components: PascalCase, one per file
- Other files: kebab-case
- Writes go through Supabase server actions, not one-off API routes, unless there's a real reason
- Comments explain *why*, not *what* — the code itself should be readable
- Match existing patterns already in the codebase before introducing a new one
- All animation/motion work must be reviewed against Emil Kowalski's course (animations.dev) — see `.agents/skills/review-animations/STANDARDS.md` for the distilled conventions (easing, duration, physicality, `@starting-style`, etc.) and cite them instead of improvising values.

## Ask before doing these

- Adding a new npm package
- Changing the database schema
- Swapping out any part of the stack listed above
- Deleting or fully rewriting a file instead of editing it
- Introducing a new UI pattern that doesn't already exist elsewhere in the app

## Current status

*(Update this section by hand as the build progresses — keep it to a few lines, not a changelog.)*

- IA finalized: Instructions covers instructions + resources; Connections moved from Settings into the sidebar
- Generate page: two-panel layout, settings left / streaming preview right, model choice lives only in Settings
- Calendar: Kanban + List views; drag-and-drop between columns is Phase 2, not MVP
- Open before high-fidelity design: draft carryover behavior across month boundaries, URL fetch timing on Resources
- Design tokens wired: foundations.json + typography.json fully resolved into app/globals.css (@theme, Tailwind v4 CSS-first, no tailwind.config.ts). Light mode only — foundations.json has no dark-mode values yet. No chart-1..5 colors (not defined in tokens). Open Runde self-hosted in app/fonts/; Phudu via next/font/google.
- Figma → code workflow: REST API and Figma MCP are rate-limited on the Starter plan — don't use them. Instead: run `npm run figma:bridge`, user exports frames via the "Presto Export" plugin, then read `design-sync/<frame-slug>/` (frame.json with token bindings, screenshot.webp, assets/ — PNGs auto-converted to WebP q80 ≤2880px). See figma-bridge/README.md and the figma-bridge skill.
- /create-project built from Figma export (first screen after login/signup — no-project empty state, full-bleed, outside (dashboard) chrome). Auth actions redirect there unconditionally until projects exist in the DB. "Create project" CTA now opens a centered modal (components/create-project/create-project-modal.tsx, built on new components/ui/dialog.tsx — @base-ui/react/dialog, follows sheet.tsx's pattern) with a project-name field (RHF + Zod). Submit is a UI-only stub (console.log + close) — no `projects` table or types/project.ts yet; that schema/flow is still undecided.
- `cn()` (lib/utils.ts) now uses `extendTailwindMerge` with this project's custom font-size tokens registered — fixes tailwind-merge silently evicting classes like `text-heading-lg` when combined with a `text-text-*` color class in the same `cn()` call (both used to fall into tailwind-merge's default text-color bucket). The bracket-syntax workarounds already in pill-input.tsx/button.tsx/segmented-control.tsx still work (harmless/redundant) but new code can go back to bare utility classes.
- /signup restyled to match Figma (UI only, not wired to Supabase yet — old signup-form.tsx/actions.ts preserved unused in app/(auth)/signup/ for a follow-up task). New reusable primitives: components/ui/segmented-control.tsx, components/ui/pill-input.tsx, Button's new "brand" variant/"xl" size. Signup fields follow Figma (email/name/password) which conflicts with the UX doc's email/password/confirm-password spec — needs reconciling.
- `hooks/use-squircle-clip-path.ts` fixed at the root: switched from `useRef`+`useEffect` to a callback ref. The bug: any element that mounts conditionally after first render (e.g. inside Base UI's `DialogPortal`, which renders `null` until the dialog opens) got its `ResizeObserver` attached to a `null` ref on that first pass, and since the effect's dependency array never changed, it never got a second chance once the real node appeared — clip-path silently never applied. Callback refs fire on every actual attach/detach, whenever that happens.
- Squircle corner smoothing is now retrofitted everywhere per the design-tokens rule above: `Button` applies it automatically per size (no more opt-in prop — `default`/`lg`/`icon`/`icon-lg`→8px, `sm`/`icon-sm`→12px, `xl`/`icon-md`→16px, `xs`/`icon-xs`→4px, mapped from each size's actual rendered radius), plus `pill-input.tsx` (16px), `input-otp.tsx` (16px), `toast.tsx` (12px). All existing Button/pill-input/OTP/toast usages across the app inherit this with no call-site changes.
- /create-project's empty-state content (avatar, greeting, heading, create-project button, subtext) now has a blur+opacity mount-in transition via Tailwind's `starting:` variant (`@starting-style` — no client JS, stays a Server Component), applied once to the whole group as a single unified appearance (no stagger — tried per-element staggering first, felt off), per `.agents/skills/review-animations/STANDARDS.md` (Emil Kowalski / animations.dev conventions: strong ease-out curve, duration-300).
<!-- END:presto-agent-rules -->
