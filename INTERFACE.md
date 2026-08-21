# INTERFACE.md — design decisions

Every UI decision this project has settled, written so a new screen can be built
from this file alone without re-deciding anything. If you are about to invent a
value, a pattern, or a component, look here first.

**Update this file the moment a design decision is made** — not at the end of a
task, and not only when a whole feature lands. A decision is anything a future
screen would otherwise have to guess at.

Companions: `LEARNINGS.md` (bugs and gotchas, so they don't recur),
`EXECUTIONS.md` (what was done, when).

---

## 1. Foundations

### Tokens are the only source of values
- `design-tokens/foundations.json` — colors, spacing/padding, radius, stroke.
- `design-tokens/typography.json` — family, size, weight, line height.
- Both are resolved into `app/globals.css` as `@theme` (Tailwind v4, CSS-first —
  **there is no `tailwind.config.ts`**).
- Never invent a color, spacing value, radius, stroke width or font size. If the
  value you need isn't in the tokens, ask — don't pick a close one.
- Light mode only. `foundations.json` has no dark-mode values yet.

**Documented exceptions** (each was explicitly authorised; don't add more
without asking):
- Raster artwork carrying its own colour — the dashboard sidebar's pixel
  gradient, the Generate/Content glow art, `file-type-icon.tsx`'s per-extension
  tag hexes (taken literally from the Figma "FileTypes" export).
- `ProjectSidebar`'s `min-h-20` spacer.
- `--ease-over-extend` in globals.css (a `linear()` curve, see §5).

### Type
- Display/headings: **Phudu** (`font-display`), via `next/font/google`.
- Body/UI: **Open Runde**, self-hosted in `app/fonts/`.
- `heading-sm` is always paired with `font-display` — never a bare
  `font-bold` override on a body face.
- Icons come from **Phosphor**. Weight `bold` for navigation, `fill` for the
  48px empty-state icon and success marks.

### Colour naming
- Surfaces: `surface-rest` / `surface-2` / `surface-3` / `surface-4`.
  A card sitting on a tray uses the tray's surface for separation and drops its
  border (see `KanbanPostCard`).
- Text: `text-subtle` / `text-bold` etc.
- Icons use the **`icon-*` namespace, not `text-*`** — icons rest at
  `icon-subtle` and move to `icon-bold` (neutral) or `icon-danger` (destructive)
  on hover. `icon-minimal` is the empty-state illustration weight.

### Corner smoothing (squircles)
Any element with a corner radius uses Figma's corner smoothing, never plain CSS
`border-radius`:
- `useSquircleClipPath` (`hooks/use-squircle-clip-path.ts`) + the `figma-squircle`
  package. Reference implementation: `components/ui/segmented-control.tsx`.
- Always keep the matching `rounded-rad-*` class as the pre-measurement fallback.
- `Button` applies it automatically per size — no opt-in prop. Size→radius:
  `xs`/`icon-xs`→4, `default`/`lg`/`icon`/`icon-lg`→8, `sm`/`icon-sm`→12,
  `xl`/`icon-md`→16.
- **The one deliberate exception is `toast.tsx`**: a fully-rounded stadium has no
  straight edge for the smoothing to blend into, and the path math expects a
  radius that fits inside the box. It uses `rounded-full` and no clip-path.
- A drop-shadow and a clip-path can't live on the same element (the clip cuts the
  shadow). The standing fix is **two divs**: shadow on an unclipped wrapper, clip
  + border on the inner card. See `toast.tsx`, `menu.tsx`.

---

## 2. Navigation & chrome

- **Sidebar:** Dashboard, Instructions, Generate, Content, Connections.
  "Instructions" covers instructions *and* resources (one section). "Content" is
  the content-calendar section — **the route path stays `calendar`**.
- **Navbar:** user chip, Settings (gear). `ProjectsNavbar` is shared; optional
  `backHref` renders an icon-only `brand-secondary` back button beside the logo,
  and `settingsHref` points the gear at the current project.
- **Connections is social accounts only.** BYOK AI models live on **Settings**,
  because a key is user-scoped, not project-scoped — one model added once works
  in every project. Anything else user-scoped belongs there too.
- URLs are `/projects/<id>/…`. The `[projectId]` layout does the ownership check
  once. `/` and `/login` fan out by project count; `/create-project` is the
  no-projects state.
- Optional-prop convention: chrome affordances render **only when a handler or
  href is passed** (`backHref`, `cornerAction`, `onOpen`, `onTurnToDraft`,
  `showInfoMarker`). A component never renders a dead control.

---

## 3. Component inventory — reach for these before building new

| Need | Use |
| --- | --- |
| Any button | `components/ui/button.tsx` (variants incl. `brand`, `brand-secondary`; sizes `xs`–`xl`) |
| Tabbed switch | `components/ui/segmented-control.tsx` |
| Single-line field | `components/ui/pill-input.tsx` |
| Multi-line field | `components/ui/pill-textarea.tsx` (has its own scroll thumb) |
| Toggle | `components/ui/switch.tsx` |
| Dropdown / listbox | `components/ui/menu.tsx` (+ `MenuItem`, `highlighted` for keyboard focus) |
| Removable tag | `components/ui/chip.tsx` |
| Modal | `components/ui/dialog.tsx` (Base UI; `popupClassName` sizes the popup, `className` styles the inner card) |
| Transient message | `components/ui/toast.tsx` (optional `extraInfo` capsule) |
| Hover label | `components/ui/tooltip.tsx` |
| Blank page | `components/shared/empty-state.tsx` |
| Platform brand mark | `components/shared/social-icon.tsx` (LinkedIn/X, full colour, any size) |
| Platform row | `components/connections/platform-row.tsx` |
| Card shell | `components/instructions/instructions-card.tsx` — generic despite the name; optional `headerAction` |
| Page panel | `components/shared/glow-panel.tsx` (green pixel-glow, corner marker, `data-clip-boundary`) |
| Date picking | `components/ui/calendar.tsx` — `size` sm/md/lg, `mode` single/range/multiple, `disableNavigation` |
| Combobox | pattern in `topic-picker.tsx` / `model-combobox.tsx` (hand-rolled, no package) |
| Scroll thumb | `useScrollThumb` + `components/ui/scrollbar-thumb.tsx` |
| Edge fade | `hooks/use-scroll-fade.ts` |
| Drag-to-scroll | `hooks/use-drag-scroll.ts` |
| Reflow animation | `hooks/use-flip-reorder.ts` |

**Empty state** (`EmptyState`) has a deliberately **inverted hierarchy**: a small
grey `body-md` caption *names* the state, and the large Phudu `heading-sm` below
it carries the message. Both text blocks are a fixed `w-68` (272px) so the title
wraps to 3–4 lines. The 48px icon is fill-weight `icon-minimal`. The action
button **hugs its content** (`size="xl"`) — unlike buttons inside cards and
forms, which go full width.

---

## 4. Layout rules

- **Two-column pages keep the header in the outer wrapper**, not in one column,
  so it doesn't jump when the columns change (Generate's number vs calendar
  modes share one `w-230` `mx-auto` header).
- A panel that must fill the viewport and scroll its own content internally:
  `relative flex-1` wrapper + `absolute inset-0` panel. An out-of-flow child
  contributes nothing to its parent's content minimum, which is what lets the
  parent collapse to `flex-1`'s height. Done per-page (Content), **not** on the
  shared `SectionContent` wrapper — every other section relies on page scroll.
- `GlowPanel` clips with `overflow-clip` **and** an explicit `min-h-0`. `clip`
  (not `hidden`) because `hidden` is scrollable and the oversized glow art gave
  it a scroll offset nothing was meant to reach; `min-h-0` because `clip` does
  *not* zero a flex item's automatic minimum size.
- Fades that sit over resting content need padding equal to the fade width plus a
  cancelling negative margin (static masks only — `useScrollFade` computes the
  real remaining scroll distance and so never dims resting content).
- Cancelling margins are the standing way to adjust a token-driven gap
  (`-mt-dist-lg` to take 24px down to 8px). Keep the pair in sync by hand.

---

## 5. Motion

All motion is reviewed against `.agents/skills/review-animations/STANDARDS.md`
(Emil Kowalski / animations.dev). Cite it rather than improvising values.

### Which tool
- **CSS + `@starting-style`** for mount-in of server-rendered content (no client
  JS, keeps Server Components). Mount-in only — this codebase has no CSS exit
  animations.
- **WAAPI (`element.animate()`)** for predetermined motion over many elements at
  once, and for anything that must not collide with a CSS `transition` (an
  inline `transition` shorthand *replaces* a class-based one for the same
  property). Used by `useFlipReorder` and the day deck.
- **Motion (`motion/react`)** where presence must be tracked (`AnimatePresence`
  in `toast.tsx`) or a spring is wanted.
- No animation library was added for any of this.

### Settled values
| Thing | Duration | Curve |
| --- | --- | --- |
| Button / card press (`scale-[0.97]`) | 150ms | ease-out |
| Small popover, list add/remove | 200ms | strong ease-out |
| Page / section mount-in | 300ms | strong ease-out |
| FLIP reflow (`REORDER_DURATION_MS`) | 100ms | quick move |
| Day deck open / close | 400 / 480ms, 80ms stagger (cap 270ms) | `cubic-bezier(0.23,1,0.32,1)` |
| Toast in | spring `bounce 0.6, visualDuration 0.25` | — |
| Toast out | 200ms | strong ease-out |
| Tooltip in | scale 200ms, opacity 130ms | `--ease-over-extend` / ease-out |

Rules that fall out of those:
- **Exits ease out, never in, and never overshoot** — a bounce on something
  leaving pulls the eye back to it. The deck is the one deliberate inversion
  (its exit runs *longer* than its entrance, because the cards travel further
  going home than fanning out).
- **Opacity never rides a spring or an overshoot curve** — it passes 1, clamps,
  and reads as a flicker. Give it its own tween.
- A fixed-percentage overshoot needs `linear()`, not `cubic-bezier` — bezier
  overshoot is a proportion of the animated range, so on a 0.9→1 scale it's
  invisible.
- Stagger runs **outward from the middle** for a fan (deck), and reverses on
  close. Cap the total, don't multiply per item.
- Transitions and their completion events are **suspended in a backgrounded
  tab** — any unmount waiting on `transitionend`/`animation.finished` needs a
  `setTimeout` backstop.

---

## 6. Feedback & state

- **Anything that takes noticeable time gives immediate feedback.** No static
  screen after a click.
- **Deletes are optimistic**: remove from the UI now, let the server call finish,
  reinsert + danger Toast only on real failure. Reference:
  `writing-style-card.tsx`'s `handleDelete`.
- **Everything else that has no new content to show is also optimistic** (date
  change, platform change, inline edit). The one awaited exception is
  **regenerate** — there is nothing to show until the model answers, so the card
  holds its `GeneratingPostCard` placeholder for exactly as long as the promise
  is in flight (no timer).
- **Autosave that can fire in a burst goes through `useSaveQueue`**
  (`hooks/use-save-queue.ts`) — one save in flight, anything queued behind
  collapses to the latest payload. A single isolated blur-to-save doesn't need
  it.
- **Every client call to a server action is wrapped in `withNetworkStatus`**
  (`lib/network-status.ts`). It returns `null` when the request never landed,
  having already raised the offline toast; call sites read `if (result === null)
  return`. A connectivity failure never blames a form field.
- Offline is reported by one toast mounted in the root layout
  (`components/shared/network-status.tsx`, `z-100`). It clears only when a real
  probe of the Supabase health endpoint succeeds — never on `navigator.onLine`.
- Server-render failures land on `error.tsx` → `route-error-recovery.tsx`. The
  copy never commits to a cause (Next redacts the error), and retry is
  `router.refresh()` **then** `reset()`.

### Loading
- Section switches (sidebar taps) use the **section-navigation overlay**
  (`lib/section-navigation.ts` + `components/shared/section-content.tsx`), armed
  by the link's own `onClick` and cleared when `usePathname` reaches the target.
  It is a **hard cut, never a cross-fade**, with `SHOW_DELAY_MS` 120 and
  `MIN_VISIBLE_MS` 300. Tapping the section you're already on is a no-op.
- Deeper navigations (a post's page) use a real `loading.tsx`, which renders the
  page's own shell around `SectionSpinner` so content arrives into a frame
  that's already there.
- A `<Link>` that leads somewhere slow and can't have a boundary gets a spinner
  in the control itself plus a `router.prefetch` on mount.

---

## 7. Scrolling

- **No scrollable area ever shows the browser's default scrollbar.** Always apply
  `HIDE_NATIVE_SCROLLBAR_CLASSNAME` (`hooks/use-scroll-thumb.ts`) — macOS's
  overlay scrollbars ignore `::-webkit-scrollbar` styling anyway.
- Whether to *also* show a custom thumb is per-container: dropdowns
  (`menu.tsx`) and `pill-textarea.tsx` do; the page-level `<main>` deliberately
  doesn't (a full-width thumb sat on top of card content).
- `ScrollbarThumb` renders as a sibling inside a `relative` ancestor that is
  **not** the scrolling element, and only shows while scrolling (fades ~1s
  after the last event) — never a permanently visible bar.
- Horizontal rows (carousels, boards, the deck) get `useDragScroll`: 4px
  threshold before a drag commits, pointer capture, resisted edge overshoot
  (35%, capped 72px), `select-none` **only while dragging** so text stays
  selectable.
- Scroll position is remembered across a there-and-back navigation by
  `hooks/use-scroll-memory.ts` — a module-level Map, keyed by layout + tab, that
  resets to 0 for an unseen key (the two layouts reuse the same DOM node).

---

## 8. Persistence of UI choices

Per-project UI preferences live in localStorage and are read through
**`useSyncExternalStore`**, never an effect that copies storage into state.
Same shape every time: a module-level store with get/set/subscribe and a server
snapshot (`lib/content-view.ts`, `lib/generate-settings.ts`,
`lib/network-status.ts`, `lib/section-navigation.ts`).
Accept the one-frame default before hydration; don't work around it.

Currently persisted: Content layout ("Show as"), Content tab, Generate model +
account. Onboarding completion is global, not per project
(`localStorage["presto:onboarding:completed"]`).

---

## 9. Content model conventions

- **Tab membership is decided by date, not by the `status` column**: Queued =
  scheduled in the future, Published = in the past, Draft = no date. All of it
  lives in `lib/content-grouping.ts`.
- Drafts group by **created** date so chips and the tap interaction stay
  identical across tabs; the Draft tab says so in an info line.
- Grouping reads **local** date parts — a scheduled day was picked in the user's
  timezone. `now` is stamped once by the page and passed down so server render
  and hydration can't disagree.
- Dates render with an ordinal suffix via `lib/format-date.ts`
  (`formatFullDate` "July 5th, 2026", `formatShortDate` "Sept 15th, 2026",
  chips "5th"). `Intl` has no ordinal, hence the hand-built string.
- Pluralisation follows plain English, not the exports (which are inconsistent).
- Copy typos in exports are corrected ("view it's content" → "its").

---

## 10. Building from Figma

- Exports live in `design-sync/<frame-slug>/` (frame.json + screenshot.webp +
  assets). `npm run figma:bridge` runs the bridge; the user exports frames from
  the "Figma Bridge" plugin.
- **Never use the Figma REST API or the Figma MCP tools in this project** — both
  are rate-limited to unusable levels on the Starter plan.
- `.claude/skills/figma-bridge/SKILL.md` holds the Presto-specific token and
  component mapping; the plugin skill covers general mechanics.
- Where an export and reality conflict, reality wins, and the deviation is
  recorded: fixed widths become `min-w-*` when real content overflows
  (`DayChip`), an icon that reads wrong is swapped (the writing-style File icon),
  a clipped overflow the export can't express becomes a real scroll.
- **No export exists for Connections or Settings.** Settings borrows the
  Instructions page's rhythm; Connections is a deliberate `EmptyState`
  placeholder until its frame lands, since the platform cards *are* its design.
  Its shape is specified in UX doc §10.3: one card per platform, "Connected"
  with the account name or "Not connected", Connect/Disconnect, a
  primary-platform selector, and greyed-out "Coming soon" rows beyond LinkedIn
  and X.

---

## 9a. Social connections

- **Platform rows, not per-platform cards.** The Figma "Connect / Base" export
  supersedes UX doc §10.3 here: one 312px `surface-4` pill per platform —
  brand mark and name left, action right, dotted leader between — stacked at
  `gap-dist-md`. Unavailable platforms show plain "Coming soon" text and no
  control.
- **Every row is 48px** regardless of its action. The content band is pinned to
  `pad-2xl` (a Button `sm`'s own height) so a text action doesn't produce a
  shorter row than a button one.
- **Connected** wraps the same row in a `surface-success` block that shows only
  along its bottom edge, carrying "Connected as {name}" over the gradient
  avatar. Both layers share `rad-lg` and the row is flush to the top, so their
  top corners coincide.
- **The expiry line sits outside that block**, in `text-subtle`: it's about the
  token, not the account. LinkedIn tokens run ~60 days and a standard app can't
  silently refresh them, so the countdown is load-bearing, not decoration.
  `formatExpiry` (lib/format-date.ts) rounds to nearest with a floor of one day.
- The export writes "Linkedin"; the app writes **"LinkedIn"** everywhere.
- Still unspecified: the connected *page* (only the row was exported), so the
  empty-state icon/caption/title simply come off once anything is connected.
  Also unspecified — a pending state on Connect (the click leaves the page, so
  it needs one), and whether Disconnect confirms.

## 9b. Content — expanding search

`components/content/content-search.tsx`. Sits at the **right end of the Content
page's header row**, aligned with the "Content" title, and is what that page has
instead of `GlowPanel`'s corner info marker (`showInfoMarker={false}`) — the
marker had no behaviour, this does.

- **Collapsed** it is a 40×32 chip: `bg-surface-3`, rad-xmd squircle, 24px
  `MagnifyingGlass` at `icon-subtle`, plus the app's standard hover tint and
  150ms press scale. That is deliberately the "Show as" pill's own surface and
  radius — they stack down the same edge and read as one cluster.
- **Expanded** it is a 280px field at the same height, radius and surface.
  `px-pad-xs` applies in **both** states, which with the 4px each icon has
  inside its own 32px button puts every glyph 8px in from its edge — so the
  padding never animates, only the width, and the icon's offset from the
  leading edge is identical open or closed.
- Width is the animated property (200ms, the strong ease-in-out this app uses
  for on-screen morphs). Animating width is against the usual
  transform/opacity-only rule and is the right call here: a scale would stretch
  the icon and text, where what's wanted is a field growing out from behind an
  icon that keeps its size and its offset from the leading edge. The squircle
  clip-path follows the transition frame by frame — `useSquircleClipPath`
  re-measures on every resize.
- **Clear button** (`PaintBrushHousehold` at 20px, a size down from the search
  glyph — it's the secondary control of the two) appears at the trailing edge
  once anything is typed. It **blurs in and out**: opacity + `scale(0.8)` +
  `blur(4px)`, 150ms, through `AnimatePresence` rather than the `starting:`
  mount-in used for conditional adornments elsewhere, because this one has to
  animate *out* too and React unmounts an element the moment it stops being
  rendered. It clears and returns the caret to the field — clearing is for
  typing something else, not for putting the control away.
- **Opens** on tap; focus moves to the input in a layout *effect*, after the
  commit — focusing inside the click handler would land focus in a subtree
  still marked `aria-hidden`, which Chrome blocks and warns about.
- **Closes** on Escape (clearing the field and returning focus to the icon
  button) or on blurring an empty field. A field with something typed in it
  stays open on blur — the query is still filtering what you're looking at, and
  it's also what stops the field collapsing out from under a click aimed at the
  clear button (blur runs first, while the value is still there).
- Collapsed, the input is `tabIndex={-1}` + `aria-hidden` and the icon button is
  the only control; the input stays mounted regardless, since the box has to
  have something to expand around.

**What search matches** — `filterPostsByQuery` (lib/content-grouping.ts): a
case-insensitive substring of the post's **content only**, no tokenising or
ranking. Not topics, platform or date: topics are already chips on every card
and a date has its own tab and chip. The filter runs *before* the tab split, so
searching stays "within what I'm looking at" rather than jumping tabs, and **the
query survives a tab switch** — searching, finding nothing on Queued and
checking Draft is the same search. The query lives in `ContentView` (it filters
the page, so the page owns it); open/closed stays inside the control. Changing
it closes any open day deck, same as switching tabs.

**No results** uses the standard `EmptyState`: `MagnifyingGlass`, caption
`No matches for **{query}**` — bold, but **still in the caption's own
`text-subtle`**: weight alone picks the query out, and darkening it would make
the small grey line compete with the heading under it — title "Check what you
typed and try again", no action button. The query is echoed in the *caption* — the small line names the
state, which here includes what was searched for — while the big line stays the
instruction, matching how the template's inversion works everywhere else. It's
trimmed to 32 characters, since the template's text blocks are a fixed 272px and
an unbroken longer string would run out of the block. `EmptyState`'s `caption`
takes a `ReactNode` (widened from `string`) so the query can be bold.

**Recent searches: deliberately not built.** The corpus is one person's own
posts in one project and the queries are single words they remember writing, so
a stored list mostly saves retyping "culture". The cost is a dropdown with its
own keyboard navigation, dismissal and per-project persistence, plus a second
thing competing for the space under the field. Revisit if search grows ranking
or cross-project scope; the pieces (`Menu`, the lib/content-view.ts storage
shape) are already there if so.

## 10a. Publishing — hard constraint

**No UI may trigger a real post.** A publish/share call to a live social account
is off-limits until the user explicitly green-lights the publishing phase, even
for an account that connected successfully. Build the buttons; leave them
unwired, and say so in the component's comment.

## 11. Ask before

Adding an npm package · changing the database schema · swapping any part of the
stack · deleting or fully rewriting a file · introducing a UI pattern that
doesn't already exist above.
