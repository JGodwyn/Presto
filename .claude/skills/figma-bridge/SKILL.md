---
name: figma-bridge
description: Implement or verify UI against Figma designs using local exports in design-sync/ (frame.json + screenshot.webp + assets). Use whenever the user wants a screen/component built from Figma, mentions a Figma frame, an export, "Presto Export", or design-sync — or whenever you need to see a Figma design at all. Never use the Figma REST API or Figma MCP tools in this project; both are rate-limited to unusable levels on the free Starter plan.
---

# Figma bridge — reading designs without the Figma API

Designs enter this repo as files, exported by the "Presto Export" Figma plugin
through a localhost bridge. Your job starts at `design-sync/`.

## Workflow

1. **Check for an export first**: `ls -lat design-sync/` — one folder per
   exported frame, named after the frame. Check the timestamp and the `name` /
   `exportedAt` fields in `frame.json` to confirm it's the frame the user means,
   not a stale export.
2. **If the frame isn't there (or is stale), ask the user to export it.**
   You cannot pull from Figma yourself. The user needs to:
   - run `npm run figma:bridge` (you can start this in the background for them)
   - in Figma desktop: select the frame → Plugins → Development →
     **Presto Export** → click **Export selection to Presto**
3. **Read the export** from `design-sync/<frame-slug>/`:
   - `screenshot.webp` — the frame at 2x (`screenshot.png` in exports from
     before the WebP upgrade). Read it first; it's ground truth for what the
     result must look like.
   - `frame.json` — full node tree: sizes, auto-layout, fills/strokes/effects,
     text, component/variant names, and resolved token bindings.
   - `assets/` — icons as SVG, image fills as WebP, referenced from `asset`
     fields in the tree. The bridge already optimized these (WebP q80, longest
     side ≤ 2880px) — copy them into `public/` as-is, no further conversion
     needed.

## Interpreting frame.json

- **`variable` / `tokens` fields hold design-token names** (`Flame/Flame500`,
  `pad-lg`, `rad-xmd`, `Body/body-lg-bold`). These map 1:1 to
  `design-tokens/foundations.json` / `typography.json`, which are already wired
  into `app/globals.css` — so use the matching utility (`text-flame-500`,
  `p-pad-lg`, `rounded-[var(--rad-xmd)]`, `text-body-lg-bold`), never the raw
  hex/px also present in the JSON. If a token name has no utility, check
  globals.css before inventing anything.
- **`layout`** = auto-layout: `direction`/`gap`/`padding` ([top,right,bottom,left])
  /`justify`/`align` → flexbox. **`sizing`** `HUG`≈fit-content, `FILL`≈flex-1 or
  w-full, `FIXED`≈explicit size.
- **`component` / `variant` / `props`** on instances name the design-system
  component. Map to existing code components before writing new markup —
  e.g. Figma "Buttton" → `components/ui/button.tsx` (`brand`, `brand-secondary`
  variants, `xl` size), "TextField" → `components/ui/pill-input.tsx`,
  "Segmented-bar" → `components/ui/segmented-control.tsx`.
- **`asset` fields**: prefer a Phosphor icon (`@phosphor-icons/react`; use the
  `/dist/ssr` entry in server components) when the icon obviously matches
  (Envelope, User, Folder, Power…). Copy the exported file into `public/images/`
  only for non-icon art (backgrounds, illustrations, the gradient avatar) —
  the WebP is already web-ready.
- **Text**: Figma copy can contain typos — flag and fix rather than copy
  blindly. Headings using `font-display` (Phudu) render in caps automatically;
  don't add `uppercase` unless comparing screenshots shows a mismatch.
- `truncated: true` means the frame exceeded the node cap — ask the user to
  export a smaller piece.

## Verifying

After building, compare the running app against `screenshot.png` (browser
screenshot side by side). Check token names in the built code against the
`tokens` fields in `frame.json`.

## Plumbing (when something breaks)

- Bridge: `npm run figma:bridge` → localhost:4411 → writes `design-sync/`
  (gitignored; re-export replaces the frame's folder).
- Plugin source: `figma-bridge/plugin/code.ts`; rebuild with
  `npm run figma:plugin`. One-time install: Figma desktop → Plugins →
  Development → Import plugin from manifest → `figma-bridge/plugin/manifest.json`.
- Full details: `figma-bridge/README.md`.
