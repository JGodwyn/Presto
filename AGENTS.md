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
- /signup restyled to match Figma (UI only, not wired to Supabase yet — old signup-form.tsx/actions.ts preserved unused in app/(auth)/signup/ for a follow-up task). New reusable primitives: components/ui/segmented-control.tsx, components/ui/pill-input.tsx, Button's new "brand" variant/"xl" size. Signup fields follow Figma (email/name/password) which conflicts with the UX doc's email/password/confirm-password spec — needs reconciling.
<!-- END:presto-agent-rules -->
