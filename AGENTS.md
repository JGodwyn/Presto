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

**Sidebar:** Dashboard, Instructions, Generate, Content, Connections
**Navbar:** user chip, Settings (gear)

Labels follow the Figma designs: "Instructions" (covers both instructions and resources — one combined section, not two) and "Content" (the content-calendar section; route path stays `calendar`).

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
- /create-project built from Figma export (first screen after login/signup — no-project empty state, full-bleed, outside (dashboard) chrome). Auth actions redirect there unconditionally until projects exist in the DB. "Create project" CTA now opens a centered modal (components/create-project/create-project-modal.tsx, built on new components/ui/dialog.tsx — @base-ui/react/dialog, follows sheet.tsx's pattern) with a project-name field (RHF + Zod).
- "Your projects" screen built from the Figma export at /projects (app/projects/page.tsx + components/projects/): own full-bleed navbar (layered mono logo, user chip w/ squircle, gear button → /settings) and folder-shaped SVG cards — purple per project, dashed "new project" card that reopens the create-project modal. Folder grid is a fluid card grid (auto-fill minmax(16rem,1fr)) so rows stay flush with both content edges.
- Project → dashboard flow decided and built: the old (dashboard) route group moved to app/projects/[projectId]/ (dashboard, instructions, generate, calendar, connections, settings, profile — all URLs now /projects/<id>/…). The [projectId] layout does the per-project ownership check once (zod uuid guard + fetchProject; no row → back to /projects). Folder cards on /projects link to /projects/<id>/dashboard. Top-level /settings is a redirect stub (→ first project's settings) so the projects-navbar gear keeps working — placeholder until a user-level settings screen exists. Root / fans out like login: signed out → /login, else by project count.
- In-project chrome + dashboard empty state built from the Figma "Dashboard" export: [projectId]/layout.tsx reuses ProjectsNavbar (new settingsHref prop points the gear at the current project's settings) beside components/shared/project-sidebar.tsx — white squircle card (widened to w-64 from the Figma frame's 192px, by request), pill nav items (Phosphor bold icons, labels per the Navigation section above), and the 384×930 pixel-gradient artwork (public/images/dashboard/sidebar-gradient.webp, natural aspect at card width) with FolderSimple + project name (line-clamp-3) pinned at the foot. Dashboard page is the "Nothing here" empty state (w-68 column, brand/xl "Get started" — not wired to anything yet; real dashboard replaces it once posts exist). button.tsx now declares "use client" (it always used the squircle hook; server pages importing it used to crash). The old shadcn chrome (shared/navbar.tsx, shared/sidebar.tsx, ui/sidebar.tsx) has been deleted.
- Projects are wired to Supabase: `public.projects` table (id/user_id/name≤80/created_at, RLS per-user, migration `create_projects_table`), shared shape in types/project.ts, reads via lib/supabase/queries.ts, writes via the createProject server action (app/projects/actions.ts). /projects ⇄ /create-project redirect on has-projects/none; login lands by project count; signup still lands on /create-project.
- `cn()` (lib/utils.ts) now uses `extendTailwindMerge` with this project's custom font-size tokens registered — fixes tailwind-merge silently evicting classes like `text-heading-lg` when combined with a `text-text-*` color class in the same `cn()` call (both used to fall into tailwind-merge's default text-color bucket). The bracket-syntax workarounds already in pill-input.tsx/button.tsx/segmented-control.tsx still work (harmless/redundant) but new code can go back to bare utility classes.
- /signup restyled to match Figma (UI only, not wired to Supabase yet — old signup-form.tsx/actions.ts preserved unused in app/(auth)/signup/ for a follow-up task). New reusable primitives: components/ui/segmented-control.tsx, components/ui/pill-input.tsx, Button's new "brand" variant/"xl" size. Signup fields follow Figma (email/name/password) which conflicts with the UX doc's email/password/confirm-password spec — needs reconciling.
- `hooks/use-squircle-clip-path.ts` fixed at the root: switched from `useRef`+`useEffect` to a callback ref. The bug: any element that mounts conditionally after first render (e.g. inside Base UI's `DialogPortal`, which renders `null` until the dialog opens) got its `ResizeObserver` attached to a `null` ref on that first pass, and since the effect's dependency array never changed, it never got a second chance once the real node appeared — clip-path silently never applied. Callback refs fire on every actual attach/detach, whenever that happens.
- Squircle corner smoothing is now retrofitted everywhere per the design-tokens rule above: `Button` applies it automatically per size (no more opt-in prop — `default`/`lg`/`icon`/`icon-lg`→8px, `sm`/`icon-sm`→12px, `xl`/`icon-md`→16px, `xs`/`icon-xs`→4px, mapped from each size's actual rendered radius), plus `pill-input.tsx` (16px), `input-otp.tsx` (16px), `toast.tsx` (12px). All existing Button/pill-input/OTP/toast usages across the app inherit this with no call-site changes.
- /create-project's empty-state content (avatar, greeting, heading, create-project button, subtext) now has a blur+opacity mount-in transition via Tailwind's `starting:` variant (`@starting-style` — no client JS, stays a Server Component), applied once to the whole group as a single unified appearance (no stagger — tried per-element staggering first, felt off), per `.agents/skills/review-animations/STANDARDS.md` (Emil Kowalski / animations.dev conventions: strong ease-out curve, duration-300).
- Onboarding tour built from the Figma "Onboarding 0-5" exports, all under components/onboarding/: OnboardingProvider (onboarding-context.tsx) is the single source of truth — step is `"cover" | 1-5 | null`, read from/written to `localStorage["presto:onboarding:completed"]` — global, not per-project (it's the same tour regardless of which project you're in; OnboardingProvider no longer even takes a projectId prop). Client-only per-browser persistence, no schema change — see the "Tour trigger" decision this was built against. OnboardingCover is the full-viewport accept/decline gate (Figma "Onboarding 0", z-50 over everything); OnboardingTopbar/OnboardingCallout render the steps-1-5 chrome (danger "End onboarding" → success "Complete onboarding" on step 5). components/shared/project-topbar.tsx swaps ProjectsNavbar for OnboardingTopbar mid-tour; ProjectSidebar force-highlights the current step's nav item via `activePath` (tour narrates in place, doesn't navigate). The callout card's vertical position is a calc() formula mirroring the sidebar's own spacing tokens (pad-md/2.5rem-item/dist-md, minus main's own p-pad-lg) rather than a DOM measurement — see the comment on `calloutTop()` in onboarding-callout.tsx if the sidebar's rhythm ever changes. Wired into app/projects/[projectId]/layout.tsx (OnboardingProvider wraps the whole chrome). Step content/copy lives in components/onboarding/steps.ts. Context also exposes `restart()` (jumps straight to `"cover"`, no localStorage clear needed) behind a small outline "Replay onboarding" button (components/onboarding/replay-onboarding-button.tsx, top-right corner of the dashboard empty state) — a dev/testing affordance, not part of the Figma design, so it's deliberately understated.
- Two onboarding fixes per `.agents/skills/review-animations/STANDARDS.md` + the apple-design skill: (1) OnboardingCover's gradient image was rendering blurred — the bug was stacking order, not the image itself: a `backdrop-blur` dim layer was placed *after* (on top of) the image instead of blurring only what's behind the whole cover, so it blurred the image it sat on. Since the image is opaque and edge-to-edge, that dim/blur layer never showed through anyway (matches the Figma screenshot, which is crisp) — removed it outright rather than reordering. (2) OnboardingCallout had no transition at all between tour steps — content just snapped. Fixed with three coordinated pieces, all CSS-only (no animation library added): the card's position is now a `translate` (not `top`, which is layout-triggering) that transitions on every step change (`ease-out`, 300ms); the card's one-time mount (opacity/scale/blur) uses `starting:` so it "materializes" per the apple-design skill rather than a plain fade, and doesn't replay on step changes since `starting:` only fires at DOM insertion; the inner icon/heading/description/button block is `key={step}`'d so each step is a fresh element with its own small `starting:` fade+lift entrance (200ms) — no exit animation, matching this codebase's existing mount-in-only convention.
- Two more onboarding items via Agentation annotations + follow-up: (1) the cover's background image had no mount-in at all (only the text block did), so it popped in solid a beat before the text — gave it the identical `starting:` blur+opacity transition so both fade in together. (2) Settings page gets a "Log out" button (reuses the existing `logout` server action + `LogoutButton` from the profile page — no new component) so the onboarding flow can be tested end-to-end without digging through Profile. (3) The dashboard's empty state was top-aligned instead of centered *behind the tour's blur overlay* specifically — OnboardingCallout's wrapper was `relative flex-1` but not itself `flex`, so the wrapped page's own `flex-1 justify-center` had no flex parent to act against; fixed by adding `flex flex-col` to the wrapper.
- ProjectsNavbar gets a new optional `backHref` prop — an icon-only `brand-secondary` button (matches the gear's style, which also switched from `brand` to `brand-secondary`) next to the logo, only rendered when set. ProjectTopbar passes `backHref="/projects"` for the in-project case; the /projects page itself doesn't pass it, so no back button shows there (nothing to go back to).
- ProjectFolder (the /projects grid card) picked up two more interactions, both plain CSS via a `group` class on its wrapping `<Link>` — no "use client" needed: (1) press feedback, `group-active:scale-[0.97]`, on its own 150ms ease-out transition (per the animation standards' button-press duration, not the 300ms the entrance opacity/scale already used — split via one arbitrary `[transition:scale_150ms_ease-out,opacity_300ms_...]` declaration so entrance and press don't have to share a duration). (2) a "Created <date>" caption (ProjectFolder now takes `createdAt`, formatted with `toLocaleDateString`) absolutely positioned top-left, revealed via `group-hover:opacity-100` — no Tooltip primitive; components/ui/tooltip.tsx exists (shadcn default, unstyled) but isn't used anywhere yet.
<!-- END:presto-agent-rules -->
