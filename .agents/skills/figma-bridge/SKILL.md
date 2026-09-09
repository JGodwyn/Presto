---
name: figma-bridge
description: Presto-specific rules for implementing UI from Figma exports in design-sync/ (token→utility mapping, component map, icon policy). Use whenever building or verifying a screen/component from Figma in this repo — alongside the figma-bridge plugin skill, which covers the general export-reading workflow. Never use the Figma REST API or Figma MCP tools in this project; both are rate-limited to unusable levels on the free Starter plan.
---

# Figma bridge — Presto specifics

The general workflow (checking `design-sync/` freshness, asking the user to
export, reading `frame.json`/`screenshot.webp`/`assets/`, interpreting layout/
sizing/truncation) lives in the **figma-bridge plugin skill** — this file only
adds what's specific to Presto.

Quick reference: `npm run figma:bridge` starts the bridge (now the external
`figma-bridge` CLI from ~/Code/figma-bridge, installed globally); the Figma
plugin is **"Figma Bridge"** (Plugins → Development), which replaced the old
"Presto Export" plugin.

## Mapping frame.json to this codebase

- **Token names map 1:1 to `design-tokens/foundations.json` /
  `typography.json`** (`Flame/Flame500`, `pad-lg`, `rad-xmd`,
  `Body/body-lg-bold`), which are already wired into `app/globals.css` — use
  the matching utility (`text-flame-500`, `p-pad-lg`,
  `rounded-[var(--rad-xmd)]`, `text-body-lg-bold`), never the raw hex/px also
  present in the JSON. If a token name has no utility, check globals.css
  before inventing anything.
- **Component names map to existing code components** — e.g. Figma "Buttton" →
  `components/ui/button.tsx` (`brand`, `brand-secondary` variants, `xl` size),
  "TextField" → `components/ui/pill-input.tsx`, "Segmented-bar" →
  `components/ui/segmented-control.tsx`. Search `components/` before writing
  new markup.
- **Icons**: prefer a Phosphor icon (`@phosphor-icons/react`; use the
  `/dist/ssr` entry in server components) when the exported icon obviously
  matches (Envelope, User, Folder, Power…). Copy the exported file into
  `public/images/` only for non-icon art (backgrounds, illustrations, the
  gradient avatar) — the WebP is already web-ready.
- **Headings using `font-display` (Phudu) render in caps automatically** —
  don't add `uppercase` unless comparing screenshots shows a mismatch.
- Remember the corner-smoothing rule from AGENTS.md: any radius from the
  export gets the squircle treatment (`useSquircleClipPath`), not plain
  `border-radius`.
