# Figma → Presto bridge

Gets Figma designs into the repo without the rate-limited REST API or MCP
server. A private Figma plugin serializes the selected frame(s) via the
(unmetered) Plugin API and POSTs the result to a local bridge script, which
writes it into `design-sync/` where Claude Code reads it off disk.

## One-time setup

1. Build the plugin: `npm run figma:plugin`
2. In the **Figma desktop app**: menu → Plugins → Development →
   **Import plugin from manifest…** → pick `figma-bridge/plugin/manifest.json`

## Per-session usage

1. In the repo: `npm run figma:bridge` (leave it running)
2. In Figma: select one or more frames → Plugins → Development →
   **Presto Export** → click **Export selection to Presto**
3. Output lands in `design-sync/<frame-slug>/`:
   - `frame.json` — full node tree: auto-layout, fills/strokes/effects, text
     segments, component/variant info, and **token bindings** (`tokens` and
     `variable` fields hold variable names that match
     `design-tokens/foundations.json`, e.g. `Flame/Flame5`)
   - `screenshot.webp` — the frame at 2x
   - `assets/` — icons as SVG, image fills as WebP (referenced from
     `asset` fields in `frame.json`)

   The bridge converts all PNG output to WebP (quality 80, longest side capped
   at 2880px) via sharp, which ships with Next — typically ~85% smaller with no
   visible quality loss, and ready to copy into `public/` as-is. If sharp is
   missing it falls back to writing the original PNGs.

Re-exporting a frame replaces its folder — the latest export is the source of
truth. `design-sync/` is gitignored.

## Notes

- The plugin main thread has no network access, so `ui.html` does the POST;
  `manifest.json` allowlists only `http://localhost:4411`.
- Exports are capped at 4000 nodes per frame (`truncated: true` in
  `frame.json` if hit).
- Plugin source is `plugin/code.ts`; `plugin/code.js` is compiled output
  (gitignored) — rerun `npm run figma:plugin` after editing.
