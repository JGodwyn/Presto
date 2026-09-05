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
| Tooltip open delay | 200ms, app-wide | — |

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
- **Motion values get tuned on a DialKit panel and then frozen in code.** The
  panel is a means, not a fixture: once the feel is right the numbers become
  named constants in the file that animates them, and the panel is deleted (git
  history holds it for re-tuning). Done for `toast.tsx`, `use-shake.ts`,
  `day-deck.tsx` and now the generating page. Where a component already carries
  the value as a prop default, freezing means *removing* the prop from the call
  site rather than passing a constant into it.
- Pluralisation follows plain English, not the exports (which are inconsistent).
- Copy typos in exports are corrected ("view it's content" → "its").
- **Restart rewrites the batch it already produced; it doesn't add a second
  one.** Each slot of a re-run rerolls the post that slot generated
  (`regeneratePost` — an UPDATE, so the row keeps its id, its day and its
  platform) and only inserts where that row is gone, e.g. the card was deleted
  first. A calendar-based batch therefore stays at one post per day however many
  times it's restarted. Resume is not a restart — it's the same run continuing,
  and it still inserts.
- **An emptied results grid isn't a screen.** Deleting the last generated post
  returns to the Generate page rather than leaving a Restart button for a batch
  that no longer exists, and it leaves **on the click** — not after the exit
  animation or the server's answer, which together put about a second of dead
  screen between the two. The page hands over to the same centered
  `SectionSpinner` every other in-project navigation uses while the router
  fetches Generate, so the emptied grid is never on screen. Only applies once
  the batch is finished (a running one has more cards coming) and only when it
  actually produced posts — a batch that generated nothing keeps its "Nothing to
  show" modal instead.

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
- **The connected page is the same `EmptyState` as the empty one.** The
  "Connection - connected" export resolves what was open above: identical
  three-part layout (48px icon, caption, heading + action; gaps
  dist-lg/dist-lg/dist-xl), with three swaps — `Plugs` → `PlugsConnected`, the
  grey caption line → a `surface-success-light` stadium badge reading "n
  connection(s) active", and the title → "Presto can post directly to your
  social media account." `EmptyState`'s `caption` is a `ReactNode` for exactly
  this: a screen may name its state with a badge instead of a line of text.
- **The row list breathes more once something is connected** — `dist-lg`
  instead of `dist-md`, per the connected export. The connected block is two
  stacked pieces plus its own expiry line, and needs the air to read as one
  unit rather than as three loose rows.
- **Connect shows a pending spinner that never resolves on this side**, because
  the click hands the browser to LinkedIn. It ends when the page leaves. The
  same shape will apply to any other "this control navigates away" control.
- **Disconnect does not confirm** — it follows the app's optimistic-delete
  convention instead (row goes immediately, comes back with a danger toast only
  if the server call actually failed).
- **The connected row has three states, driven by the countdown**
  (`expiryStatus`, lib/format-date.ts — exports
  "Connection-ConnectedState{Connected,ExpiringSoon,Expired}"):
  *active* is the green block with Disconnect and a `text-subtle` countdown;
  *expiring* (≤ **7 days**, `EXPIRY_WARNING_DAYS`) keeps the green block but
  turns the countdown `text-warning` and grows a quiet `surface-2` "Renew now"
  chip beside it; *expired* turns the block `surface-danger` with a
  WarningDiamond over "Connection expired", swaps the action for a
  success-green **Reconnect**, and drops the countdown line entirely.
- **The amber window is the whole point, and the tooltip explains why**:
  renewing while the token is still alive is a silent redirect (LinkedIn skips
  the consent screen); after it lapses it's a full re-authorisation. Hence
  "Renew now to avoid having to authorize all over again".
- **Renew and Reconnect are the same action as Connect** — one authorize
  redirect. LinkedIn decides whether to show consent, and the callback's upsert
  replaces the row in place.
- **The badge counts live connections, not rows.** The Expired frame's green
  "1 connection active" is a leftover from duplicating the connected frame; an
  expired token is exactly what can't be used. At zero the pill holds its shape
  and drops to `surface-2`/`text-subtle` ("No connections active") so the page
  doesn't reflow.
- **No Disconnect in the expired state** — the action slot holds Reconnect, per
  the export. Removing an expired account means reconnecting first.
- The countdown's type moved `body-md-bold` → **`body-lg-bold`** across the new
  export set; the healthy state was updated to match.
- **A stored avatar URL is not durable.** LinkedIn's profile-image URLs are
  time-limited and dynamically keyed, so the connected row treats the photo as
  best-effort and falls back to the gradient avatar `onError` — which is also
  the no-photo case, so there's one visual fallback, not two.
- **Disconnect confirms; connecting doesn't announce itself.** Disconnect opens
  the shared `ConfirmationModal` (Figma "DefaultConfirmationModal") with the
  `Plugs` icon — the icon shows the state the button leads to, as the
  delete-post modal's Trash does. The copy states the consequence without
  borrowing gravity the action hasn't earned: "Presto will lose access to this
  account until you reconnect it. Your posts and drafts aren't affected."
  *"until you reconnect it"* does the job *"You can't undo this"* does on the
  delete modal, pointed the opposite way. The button says just "Disconnect"
  rather than repeating the title, since a card with one button and an X has
  nothing to disambiguate. **A considered alternative was optimistic-delete plus
  an undo toast** — cheaper for a reversible action — but a confirmation was
  asked for directly, and the modal is what shipped.
- **Success is silent.** The "LinkedIn connected" toast is gone: a connection
  that worked announces itself far better than a toast can, since the row it
  produced is right there, green, carrying the member's name and photo. Every
  toast this page raises is now a failure.
- **The OAuth round trip reports itself in the URL**, since a redirect is the
  only channel a callback has: `?connected=` / `?connect_error=<code>`. The
  page seeds its toast from those at mount and then strips them with
  `window.history.replaceState` (no refetch). A cancelled consent screen gets
  no toast at all — it's a decision, not a failure.

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

## 9c. Content — filter

`components/content/content-filter.tsx` + `lib/content-filter.ts`, from
design-sync/content-filter-1 (nothing selected) and content-filter-2 (LinkedIn
+ two topics). A second 44×32 chip sits beside the search one — `FunnelSimple`,
same surface and radius — and opens a 216px menu.

**The header pair.** Both chips are 44×32 around a centred 24px glyph in
`icon-bold`, 8px apart, right-aligned to the page's own padding. The 10px the
centring leaves either side is not a padding token, which is why neither chip
declares padding: the box does it. The search control's collapsed state was
resized to match (it had been 40px with a `icon-subtle` glyph).

**The menu** is the shared `Menu` (its squircle, ring and shadow) at **240px —
24 wider than the export**, by request, which is what lets a label like
"Artificial intelligence" sit unabbreviated. Every section carries `pad-lg`
rather than the export's `pad-md`/`pad-sm` (also by request: "+8"; 20px isn't
on the token scale, so this is the step that is). `MENU_WIDTH_PX` and the
card's `w-60` are hand-synced — the positioning maths needs the number.
It is portaled to `<body>` and pinned under the chip with its right edges
aligned, 8px below — portaled for the reason topic-picker.tsx spells out: GlowPanel's
squircle is a clip-path, and clip-path clips *every* descendant, including
absolutely positioned ones. Closes on Escape, on the chip, and on a pointerdown
anywhere outside.

- **Header row** — "Filter" (`body-md-bold`) and an `ArrowCounterClockwise`
  reset, disabled while nothing is selected.
- **Social** is a *cycling* row, not a dropdown: All → LinkedIn → X, carrying
  the same `ArrowsClockwise` the "Show as" pill uses, since with three values a
  tap-through beats open-then-pick. "All" draws both brand marks. The icon
  **turns half a rotation per tap**, accumulating — `hooks/use-icon-spin.ts`,
  extracted from the "Show as" pill so both cycling controls share one
  implementation. It's a WAAPI animation rather than a transition on the inline
  `rotate`, for the reason documented in that file: the tap also swaps the
  content underneath, and a commit that big can apply the new value without a
  transition ever starting.
- **Topics** is `All topics` (a green `icon-success` check when nothing is
  selected) over one `MenuItem` per topic with a 20px checkbox: `surface-3` +
  inset `border-subtle` ring unchecked, `surface-brand` with a white check when
  ticked. Rows are 40px and **span the card's full width** — the topics section
  carries no horizontal padding of its own and the rows keep `MenuItem`'s own
  `px-pad-md`, which with its transparent `stroke-xl` border lands every label
  exactly 16px in: flush with "Topics", "Social" and "Filter" above them (and
  the checkboxes 16px from the right edge, flush with the reset icon). Each
  row's divider therefore runs edge to edge. Bleeding the divider out
  of a narrower list can't work: `overflow-y: auto` forces `overflow-x` to a
  scrolling value, so anything past the list's box is clipped. Two gotchas in
  that override, both commented at the call site — `before:inset-x-0` loses to
  MenuItem's own `before:inset-x-pad-md` (tailwind-merge doesn't recognise the
  named spacing value, so both ship and CSS order picks the shorthand), hence
  the `left`/`right` longhands; and they carry a negative `stroke-xl` offset to
  cancel MenuItem's transparent border, which insets the padding box the
  pseudo-element is positioned against. The list caps at six rows (240px) and
  scrolls under the app's standard thumb, with `useScrollFade` on the same node (16px top,
  32px bottom — deeper at the bottom for the same reason as everywhere else:
  it's the only thing signalling there's more below). Both hooks are composed
  into one callback ref and one scroll handler.
- The offered topics are the ones **actually on this project's posts**
  (`topicsInPosts`), taken from every post rather than the current tab or query
  — an option that can only return nothing is worse than no option, and a list
  that reshuffled as you typed would be unusable.

**Semantics** (`filterPosts`): platform ANDs with topics, topics OR among
themselves, and the whole thing ANDs with the search query. Empty topics means
"all", so a topic appearing on a newly generated post can't fall outside an
existing filter. Unticking the last topic lands back on All topics on its own.

**Three deliberate departures from the export**, all noted because the export
doesn't show them:

- The chip's glyph turns `icon-brand` while a filter is active. A filter
  narrows the page silently; without it, missing posts look like a bug.
- A filter that matches nothing renders the no-matches `EmptyState`
  (`FunnelSimple` / "No matches for this filter" / "Try another topic or social
  account") rather than the plain tab empty state the export draws, which would
  send you looking for posts that are merely hidden. A query, if there is one,
  takes precedence in that message.
- **The filter is persisted** per project alongside the tab and the layout
  (lib/content-view.ts, key `presto:content-filter:<projectId>`), by request:
  it survives a tab switch and a refresh. Two things make that safe. Reads are
  cached on the raw stored string — `useSyncExternalStore` compares snapshots
  by identity, so parsing fresh on every read would re-render forever — and
  "nothing selected" is stored as the *absence* of an entry and always returns
  the shared `NO_CONTENT_FILTER` instance. And a restored filter is
  reconciled against the topics that still exist
  (`reconcileContentFilter`, derived at render, not written back): a topic
  filter saved before those posts were deleted or retagged would otherwise
  empty the page with nothing in the menu to explain it, because the menu is
  built from the posts that remain. It inherits the same one-frame behaviour
  as the tab and layout — the first client render is unfiltered until the
  stored value is read.

## 9d. Generate — the account pill

- **The menu is driven by what the project has actually connected**
  (design-sync/generate-page-modal). Three rows: "Try out", then one per
  platform, each greyed out unless `public.social_accounts` has a row for it.
  A greyed row is `text-minimal` with its brand mark at **10% opacity** — the
  export's own values, and `MenuItem`'s existing `disabled` styling already
  produces the text half.
- **"Try out" is the default, and the answer to "what does the pill show when
  nothing is connected?"** Generation needs no social account at all (nothing
  is ever published — see §10a), and a project with nothing connected is the
  common case, so the pill resting on a greyed-out platform would be wrong.
  It leads the list, can never be unavailable, and is what a stale persisted
  value falls back to. Its icon is Phosphor `Eyes` at `icon-minimal`: a
  stand-in, not a brand.
- **An account's value is its platform, not its row id.** `social_accounts` is
  unique on (project_id, platform), so within a project a platform names
  exactly one account — which keeps the value that rides in localStorage and
  the /generating URL the shape it has always been. A "Try out" batch still
  has to write posts for *some* platform, and borrows LinkedIn.
- **Rows are labelled by platform, not by account name** ("LinkedIn", not
  "Godwin John"), per the export. Which identity that is belongs to
  Connections, which shows it in full.
- **An expired connection still counts as connected.** Generation never touches
  the access token, so greying it out would block a choice that works. Expiry
  is Connections' business (§9a).
- **The menu row's icon trails the label** (the export's "R.Slots" 24px slot),
  while the trigger keeps its icon leading. The trigger's mark is 16px, the
  menu's 20px — both straight off the export, which is why an account option
  carries two icons.
- **A disabled row keeps the menu open when clicked.** It's `pointer-events-none`
  so the click lands on the menu card instead of nowhere — see LEARNINGS for
  why a plain `disabled` button closed it.
- **Both pills carry a hover tooltip** — "Model to use" / "Socials to generate
  for" — on the app's 200ms delay. One `TooltipProvider` wraps the pair so Base
  UI groups them and the second shows instantly after the first.
  The trigger is the capsule itself (`SelectPill`'s `tooltip` prop), not a
  wrapper around it, and the tooltip is `disabled` while the menu is open — a
  bubble explaining a control you've already opened just covers the options.
- **The question and its stepper sit at `dist-lg`**, 8px tighter than the
  `dist-xl` rhythm around them, as their own nested group rather than a
  cancelling margin.
- **No info marker on this page.** `GlowPanel`'s corner marker was static with
  nothing wired to it, and this corner already carries a control that does
  something. Every page now passes `showInfoMarker={false}` — Content dropped
  it earlier for the same reason — so the prop's `true` default is currently
  unused.

## 9e. Post cards — the account pill and retired topics

- **A post card names its account, not its platform.** The pill was "LinkedIn",
  a category; it is now "Godwin John", the thing the post actually goes out as.
  Brand icon + account name (chosen over an avatar, and over an avatar with a
  brand badge). `lib/post-account.ts` is the single resolver, used by
  `GeneratedPostCard` (Generate + the day deck) and `KanbanPostCard`.
- **No `social_account_id` on posts, and none is needed.** `social_accounts` is
  unique on (project_id, platform) — the same fact §9d leans on — so a post's
  platform already identifies exactly one account in its project. Reconnecting
  upserts that row in place, so the id wouldn't be more stable than the
  platform anyway.
- **The fallback chain is account name → platform label.** A platform this
  project never connected (or has since disconnected) has no name to show, so
  the pill reads "LinkedIn"/"X" exactly as it used to. A connected row with a
  blank name falls back the same way — an empty pill is worse than a category.
- **"Try out" is the one thing the platform can't tell you**, which is why
  `posts.is_tryout` exists. A try-out batch borrows LinkedIn as its platform
  (§9d), so without the column a throwaway post would render under the user's
  real name. It shows Phosphor `Eyes` + "Try out", matching the Generate menu's
  own stand-in row.
- **The pill cycles through every account the project can post as, "Try out"
  included** (per direct request), in the Generate menu's own order: Try out
  first, then each connected platform. Try out was excluded at first, on the
  reasoning that a stand-in isn't an account — that was wrong in practice, and
  the correction is worth keeping: with a single connected account (the common
  case) it left the pill with nowhere to go, so the control was permanently
  dead exactly where it mattered most.
  - **A Try out position carries the post's own platform**, so switching onto
    it and back is lossless. The two always travel together
    (`PostAccountTarget`), and `updatePost` writes both.
  - The pill still becomes a plain `<span>` when there is nowhere to go — no
    cursor, no hover tint, not a tab stop — but that now only happens with *no*
    connected accounts, where Try out is the only position the post could be in.
  - A post whose own platform has since been disconnected isn't a position in
    the cycle at all; it enters at the top.
  - `components/shared/post-account-pill.tsx` is the one implementation, in the
    Generate grid, the day deck, a Kanban card (display-only there — the whole
    card is a link, so a button inside it would nest controls) and post-details.
- **A deleted topic keeps its chip, retired.** `posts.topics` is a
  denormalized snapshot with no foreign key behind it (§9 covers why), so
  deleting a topic in Instructions leaves it sitting on every post that used
  it. The chip stays — the post really was written about that — but drops to
  `Chip`'s third palette: **`surface-4` background, `border-minimal` border,
  `text-minimal` text**, against the live chip's surface-3/border-subtle/
  text-subtle. Corner smoothing is unchanged.
- **Which topics are live is a prop, not something a card can know.** The
  Content page fetches the project's current `instructions.topics` alongside
  the posts and passes a `Set` down; `GeneratedPostCard`'s `activeTopics` is
  optional, since the Generating page has no reason to have fetched them and
  every topic there was live seconds ago by definition.

## 9f. Post details — the centred column

From design-sync/contentpagenew.

- **One 400px column, centred in the panel, everything left-aligned inside
  it.** The export is explicit: the body area is `align: CENTER` holding a HUG
  column at `x=228` of an 856px parent, whose own children all sit at `x=0`
  under `align: MIN`. So the heading, the account/topics row and the post body
  share a single left edge. Before this the heading was its own hugging,
  centred block, which left it floating over the body rather than lining up
  with it — `items-center` on the wrapper centres the column, `items-start`
  inside it is what aligns the contents.
- **`dist-lg` between the three blocks**, the export's own 16px rhythm.
- **The account pill and topic chips are new on this screen** and sit between
  the heading and the body. Same pill component as the cards (§9e) and the same
  `Chip size="md" selected={false}`, retired when the topic is gone.
- The pill is **interactive here** — this is the screen for changing what a
  post is, so tapping cycles the account. Topic chips stay display-only: the
  topic is changed when regenerating (§9g), not by editing a label.
- **Topic chips use `text-bold` on this screen**, not Chip's own `text-subtle`
  — the export's own label fill, and here the topic is one of only two things
  describing the post rather than a secondary detail beside something louder.
  A **retired** chip keeps `text-minimal`: the point of that state is that the
  topic has faded out of the project, which a bold label would undo.
- The three corner actions and the back button are unchanged; the export still
  shows them alone in that corner, which is why `showInfoMarker` is off.

## 9g. Regenerate — choosing the topic

From design-sync/regeneratemodalwithtopic.

- **Regenerating is where a post's topic changes.** It is the one action that
  rewrites the post outright, so a new subject produces words that match it.
  Changing the topic anywhere else would leave the label disagreeing with what
  the post actually says.
- The pill is the model pill's own frame with a different label — same
  SelectPill, same surface-4/border-subtle overrides, sitting between "Using X"
  and the primary button.
- **Options: the post's own topic first, then the project's, deduped.** A topic
  deleted from Instructions is still what the post is about, so it stays
  selectable — dropping it would silently retopic the post the moment you
  regenerated.
- **Hidden entirely when there is nothing to choose between** (no project
  topics and none on the post). A pill offering one already-selected option is
  a dead control.
- Like the model pick, it is a **one-off for this regenerate** — it reverts to
  the post's own topic next time the modal opens, and never writes back to the
  project's Instructions.
- The topic is **written back only when it actually changed**, so an untouched
  reroll doesn't rewrite the column and a post with no topic doesn't gain one
  by being regenerated.

## 10a. Publishing — the gate, which replaced the hard constraint

**Superseded 2026-09-02/03**, on the user's explicit green light. This section
used to read "no UI may trigger a real post — build the buttons, leave them
unwired". The buttons are wired now, `w_member_social` is requested, a scheduler
exists, and one real post has been published (EXECUTIONS.md, 2026-09-03).

What replaces it is a runtime gate, not a convention: **`checkPublishGate`
(lib/linkedin/publish.ts) refuses every publish — button and scheduler alike —
unless `PRESTO_ENABLE_LIVE_PUBLISH` is exactly "true"**, and that variable is
deliberately absent from `.env.local.example`, because it is not configuration.
The refusal is surfaced, never hidden: `canAttemptPublish` (lib/post-publish.ts)
is blind to the gate on purpose, so the control is offered and the *attempt*
explains itself.

AGENTS.md's own "Hard constraint — publishing" section still describes the old
state and needs the user's own hand — it is their standing rule, not this file's
to rewrite.

## 11. Ask before

Adding an npm package · changing the database schema · swapping any part of the
stack · deleting or fully rewriting a file · introducing a UI pattern that
doesn't already exist above.

---

## 12. Dashboard

**There is no Figma frame for a populated dashboard.** `design-sync/dashboard`
is only the "Nothing here" empty state on the bare canvas. Everything below was
composed from tokens and the existing component vocabulary — restyle when a
frame lands.

- **Cards on the canvas, not a `GlowPanel`.** Generate and Content both wrap
  their content in the glow panel, which caps itself to the viewport height and
  scrolls internally. A dashboard is a stack of independent cards that should
  page-scroll, so it follows the **Instructions page's** rhythm instead: white
  `surface-4` cards on the surface-3 canvas, `dist-md` between them.
- `components/dashboard/dashboard-card.tsx` is that shell. It is a deliberate
  duplicate of `instructions-card.tsx`'s recipe rather than a reuse of it:
  that component hard-requires a title *and* a one-line description, which a
  stat tile doesn't have. Header (`DashboardCardHeader`) is `title-lg` Phudu
  with an optional trailing readout, one notch below the page's own
  `heading-sm` title.
- **Figures are date-derived, never `posts.status`** — `lib/dashboard-summary.ts`
  mirrors `lib/content-grouping.ts` exactly, so the dashboard can't contradict
  the page it summarises. (Nothing in the app ever writes
  `status: "published"`, so a status-derived "Posted" count would read zero
  forever.) `now` is stamped once by the page and passed down, same as Content.
- **Nothing here is engagement data, and nothing can be.** No impressions,
  likes, reach or best-time-to-post: the app doesn't publish (see §10a) and
  reads nothing back, so every such figure would be invented. The dashboard
  reports *plan* (what's scheduled, what's empty) and *setup* (voice, examples,
  connections, model) only.
- **Density ramp** (`month-heatmap.tsx`) uses the flame scale —
  `surface-3 → flame-50 → flame-100 → flame-200 → flame-400` for 0/1/2/3/4+
  posts a day, with `text-inverse` on the last step. Real tokens, not tints.
  Day cells use plain `rounded-rad-sm` with **no squircle clip-path**, the same
  call `components/ui/calendar.tsx` makes for its own day cells: 31
  ResizeObservers to smooth a 4px corner isn't a trade worth making.
- **A calendar day with posts links to Content with the matching tab already
  selected** — Content has no per-day route (its deck opens from a chip), so
  the tab is the closest honest destination. Chosen from `upcomingByDay`, not
  from the date, so *today* doesn't read as Queued once its posts have gone.
  Empty days are inert.
- **Standing conditions get a banner, not a Toast** (`notice-banner.tsx`): an
  expiring LinkedIn token or a BYOK key that fell back onto the app's
  credentials is still true tomorrow, and a Toast is for something that just
  happened and then leaves.
- **Setup is a 3x2 tile grid** (`dashboardsetup` export): tone badge, label,
  then a pill carrying the figure and a caret, all three tinted together per
  state. Pills take `mt-auto` so they share a baseline across a row regardless
  of label wrapping. It is the **one block on this page that is not a
  `DashboardCard`** — the export gives the section the canvas colour and no
  padding, so the white tiles are the only card-like thing in it, and they
  carry no border because nothing but the surface change separates them.
- **`SetupCard` is the half that works on day one**, before any posts exist —
  every row derived from data already stored, every row linking to the page
  that fixes it.
- **Clipped single-line text fades, it doesn't ellipsis** (`next-up-card.tsx`).
  Reach for `useScrollFade` even when the box doesn't scroll: it sizes each
  edge's fade to the distance actually hidden there, so a line that fits gets
  no fade, while a static mask would dim the tail of a short one. The static
  `EDGE_FADE_MASK` pattern (GeneratedPostCard, the skip-dates carousel) stays
  the right tool only where the fade width is fixed and the padding/negative-
  margin pair can hold it off resting content.
- **The in-project page scroll fades at the top only**
  (`components/shared/section-scroll-area.tsx`, wrapping `<main>` for every
  section). Content disappearing under `<main>`'s top edge dissolves instead of
  being cut; **there is no bottom fade by design**, because `<main>`'s
  `-mb`/`pb` pair bleeds the scroll area past the page padding to the real
  screen edge, so content there runs off the display rather than clipping at a
  line.
- **It is an overlay strip, not a CSS mask — the one place that rule is
  inverted.** A mask paints its whole subtree through the mask's geometry, and
  five sections render their Toast into a `position: fixed` slot *inside*
  `<main>`; those toasts sit above `<main>`'s box and get erased outright. Use
  `useScrollFade` on scrollers with no fixed descendants (all the others); use
  a canvas-coloured gradient strip where fixed children live. See LEARNINGS.

### 12a. Dashboard — built from the export

`design-sync/dashboarddesign` (+ `-2`, the same page scrolled) supersedes the
hand-composed mockup §12 describes. What changed and what holds:

- **Cards are `rad-xmd` (12), `pad-md` block / `pad-lg` inline, no border** —
  they sit on the surface-3 canvas and white alone separates them. The
  exceptions are deliberate: the three mini stat cards inside the Total-posts
  card get a `stroke-md border-subtle` (they sit on white), and the post cards
  in the Next-up column are `rad-lg`.
- **The Total-posts card is entirely project-wide.** Its bar, its legend and
  all three mini cards (Drafts / Queued / Published) count the whole library.
  The two mini cards were month-scoped at first, which put two different
  "Queued" numbers on one card — 85 in the bar, 10 in the card — with only a
  caption to explain it; changed per direct request. Month figures live on the
  row below, which is about the month by definition.
  - That row reads **To go out this month → Empty days ahead → Written this
    week** (order and first label per direct request): the two calendar
    figures sit together, and the activity figure — the only one measuring what
    you have *written* rather than planned — reads last.
- **Two stat shapes, and the difference is semantic**: the bordered mini card
  labels itself `body-lg`/text-bold (it heads a breakdown), the plain one
  `body-lg-bold`/text-subtle (it captions its own number).
- **The Total-posts bar is one stadium with cumulative segments** — Published
  is the track at full width, Queued painted over it, Draft over that. Each
  segment's width is a running total, which is what makes it read as one bar
  rather than three blocks with seams.
- **Calendar day states** map to Figma's `_calendar-item`: content →
  `surface-selected` + inverse text; in-month empty → `surface-hover` + bold;
  adjacent month → no fill, `text-minimal`. Cells skip the squircle clip-path,
  as `ui/calendar.tsx`'s own cells do.
  - **Today is a ring, not a state**: the `stroke-xl border-brand` outline is
    drawn *over* whichever fill the day already earns, so today with posts on
    it stays purple and today with nothing takes `surface-rest` (white — the
    ring needs something to sit against). It was a fourth mutually-exclusive
    state at first, which meant being today silently erased the fact that
    something was scheduled; changed per direct request.
- **The Next-up column is a scroller, not a growing list.** The export clips it
  mid-"Recently out" at the calendar card's height; it's bounded by the
  `relative` + `absolute inset-0` pair (the Content page's trick), because
  every ancestor here is content-sized.
- **No notices strip** — the export has none. An expiring connection and a
  failed BYOK key downgrade their own Setup row to the warning tone instead.
- Platform bar colours are each brand's own, taken literally from the export —
  the same documented exception as `file-type-icon.tsx`. X and Try out land on
  real Gray/Purple tokens; only LinkedIn's blue is a literal.
- **"What you're posting about" covers every post, not the reference month.**
  It asks what you write about, which is a property of the library rather than
  of a calendar page, and its title carries no month to say otherwise — the
  same scope as the Total-posts bar. It *was* month-scoped, which read as
  simply wrong (a project with 72 LinkedIn posts reported 26, the rest being
  scheduled for later months). The calendar card and the coverage stats stay
  month-scoped; they are about a month by definition.

### 12b. Dashboard — empty post sections, and the compact EmptyState

From `design-sync/emptydashboardpostsection`:

- **A Next-up/Recently-out section with nothing in it draws a tray, not a
  sentence.** Fixed 200px, `surface-2`, `rad-xmd` (squircled), `pad-2xl`,
  holding the empty-state block centred. Surface-2 rather than the post cards'
  surface-4: nothing is being carded, so the tray reads as the hollow where
  cards would be. The height is fixed so a one-line and a two-line message
  produce the same box.
- **`EmptyState` gained `size="sm"`** for it — the same three pieces in the
  same order at the export's smaller scale: 32px icon, `dist-md` between the
  pieces, `title-lg` title instead of the page-sized `heading-sm`. Text blocks
  stay `w-68`, as at full size. Reach for this whenever an empty state sits
  *inside* something rather than being the page.
  - The compact title renders as a `<p>`, not the full-size one's `<h1>`: it
    sits under a heading of its own ("Next up . . ."), so a second h1 would be
    wrong. It's still the loudest thing in its box.
- **Sections are `dist-2xl` apart** — both the two post sections inside the
  Next-up column (the export's own spacing) and the dashboard's own top-level
  sections, raised from `dist-xl` by request so the page reads as blocks rather
  than a single run.
- **The zero-posts dashboard has no action button.** The "Get started" CTA is
  gone by request: the sidebar is right there, and it was never wired to
  anything. `EmptyState`'s `action` slot stays — nothing else uses it today.
- Copy fixes on the export, the same call made on Content's "view it's
  content": "Your have no posts scheduled for later." → "You have no posts
  scheduled for later."

## 13. Time of day (Generate → dates)

- **The time field is one component in both cadences** (`components/ui/
  time-field.tsx`, from `design-sync/calendar-with-time-daily` and
  `-monthly`, which draw it identically): a `surface-2` `rad-lg` tray holding
  three 48×40 `surface-4` `rad-xmd` boxes — hour, minute, AM/PM — separated by
  `body-lg-bold`/`text-subtle` colons, with a 16px `surface-2` disc either
  side of the tray. The discs are a **mark, not a control**: nothing in the
  export makes them one, and a control flanking a three-part field wouldn't
  say which part it acted on. They're the one shape here that skips the
  squircle, being fully round (the `toast.tsx` exception).
- **Hour and minute are text inputs, not `type="number"`.** The number type
  brings spinners, accepts `e`/`-`, and takes unbounded length — none of which
  belong on a two-digit clock segment. Digits are filtered on input and capped
  at the widest legal entry, arrows step **and wrap** (a clock has no ends),
  and the typed draft is held separately from the committed value so padding
  and clamping don't fight the typist mid-word. Minutes display padded
  ("00"), hours don't ("9") — the export shows both.
- **AM/PM toggles on click.** Two options don't earn a dropdown. Its
  `aria-label` carries the action, since the visible text is the state.
- **Where it sits differs by cadence, and that's the export's call.** Daily:
  inside the `Calendar` card, under the day grid, no divider. Monthly: inside
  the month card, under a `DottedDivider`. `Calendar` grew a `footer` slot for
  the first, **day view only** — the month and year pickers replace the grid
  wholesale, and a time under a list of years reads as belonging to the list.
- **The month card is centred now** — year nav and month pills both, where
  they used to be left-aligned — and carries its own **info marker** at
  `top-pad-sm right-pad-sm`, absolutely positioned over the card, with a
  tooltip reading "Tap to choose a month. Then set a time to post." That
  marker **replaces the "Select months to generate for" line above the card**:
  the instruction has two halves once there's a time to set, and two lines
  above the card would push it out of line with the settings column beside it.
  Unlike `GlowPanel`'s static corner marker this is a real `<button>` — it
  does something on hover and has to be reachable from the keyboard.
- **One time per batch, not per post.** It lives on `GenerateCard` beside the
  dates, persists with them, resets with them, and is stamped onto every date
  the batch produces. Number-based generation schedules nothing, so it has no
  time to set and doesn't show the field.

- **The post pickers are one component**, `components/shared/date-time-picker-
  dialog.tsx` — the generated-post card and the post-details page render the
  same overlay, and it owns both commit paths: a date click commits and
  closes (carrying the showing time), while the time writes through on its
  own, debounced. A draft's time is held until a date exists to attach it to.
  Cancel closes without picking a date; it has never been a discard, and a
  pending time write is flushed on the way out.
- **The daily calendar's time row sits behind a dotted divider** with
  `dist-lg` either side (`design-sync/calendar-with-time-daily`, re-exported)
  — the same treatment the monthly card already had. `Calendar` draws the
  divider itself as part of its `footer` slot, so every caller that passes one
  gets it.

- **A date *range* keeps whatever year it needs** (`formatDateRange`): none
  when both ends are in the current year, one at the end when both share
  another year, and **both years whenever the range spans two** — including
  when one of them is current. "December 24 – January 15" would otherwise read
  as ending before it starts, which is the case that makes the rule
  conditional on the range rather than on `now` alone.
- **The Calendar's month and year lists have back/forward arrows**
  (`ArrowBendUpLeft`/`ArrowBendUpRight`, `size-5`, resting at `icon-bold`),
  from design-sync/calendarwithnavigation. Back steps up the Day → Month →
  Year drill-down; forward steps down it, and is **disabled on the year
  list**, which is the last step. Both are pure view moves — only picking an
  entry changes the displayed date, so backing out leaves the calendar exactly
  where it was. Tapping to drill forward still works as it always did.
- **The Calendar's month list has no scrollbar; its year list does.** A year
  list has no natural bounds, so a thumb is the only thing placing you in it;
  a year's months are common knowledge. **Both fade at the bottom** instead
  (`useScrollFade`, `end: 32`, `start: 0`) — bottom only, since that is the
  edge that has to say there is more below, and the month list has nothing
  else saying it. The year list carries both at once: the mask is on the
  scrolling div, the thumb is its sibling, so neither touches the other.
- **The app has exactly one date format: `formatDate` → "Aug 29"**, with the
  year only when it isn't the current one ("Aug 29, 2027"). No ordinal. There
  used to be a long-month twin for roomier surfaces; two shapes was the
  problem, so there is one function and every caller takes it. A date with no
  year means this year, the way a diary entry does, and dropping it is what
  lets a date share a card header with a time. It takes `now` as a parameter
  (defaulted) rather than reading the clock itself, so a server render and its
  hydration can't disagree about which year is current.
  - **Two exceptions.** The Content page's Calendar-view **day chips keep
    ordinals** ("28th", "1st") — a bare day genuinely is read as "the 28th",
    and that is `formatOrdinal`'s only remaining caller. And a Calendar
    day-cell's `aria-label` stays the verbose "Saturday, August 28, 2026"
    (`dayCellLabel`): it is spoken, not read, so it keeps the weekday and year
    the visible UI can take as read. `formatOrdinal` survives for **bare day
  numbers only** (a Content day chip, a Kanban column header): "the 28th" is
  how a lone day is read, but a date that already names its month and year is
  not.
- **`formatClockTime` (lib/time-of-day.ts) is the app's one time format** —
  "10:45 PM", and "9 AM" on the hour. Dropping `:00` is how the time is said
  out loud and also what makes it fit the tightest surface (a Kanban card's
  196px metadata row). Reads the local clock, matching how the Content page
  groups.
- **Where the time shows, and why each is different.** A post card
  (Generating page, day deck) reads `date • time` on one line: the date keeps
  the header's `body-lg-bold`, the bullet and time are plain `body-lg` in
  `text-subtle`, `dist-sm` apart, and the row is `gap-dist-md` so the time
  never sits flush against the actions button. The date truncates if the pair
  overruns, which a current-year date no longer does at the deck's 272px. A
  Kanban card leads its account/topics row with the time — that card shows no
  date (the column header does), and a fourth row would cost the board its
  third card. Post details puts it **on the heading line**,
  `AUGUST 28 • 10 AM` — the same `date • time` shape, at `heading-sm` in
  Phudu, with the bullet and time `text-subtle` against the date's
  `text-bold`. It only fits there because the current year is dropped; that is
  what let it come up off a line of its own. The three parts are separate
  elements rather than one `TextMorph` string, since a morphed string can't
  carry two colours. The dashboard card runs
  `date • time • relative day` on one row, which its width allows. **Day chips
  and Kanban column headers show no time** — they cover a whole day.
- **Within a day, posts sort by scheduled time**, in the same direction the
  days read: Queued forwards, Published backwards. A generated batch shares
  one time, so creation order (newest written first) is the tiebreak — and
  the whole rule for Draft, which has no scheduled time at all.
## 14. The navbar chip is the profile entry point

The gear is gone from `ProjectsNavbar` (both the /projects picker and the
in-project chrome). The user chip is the only affordance in that corner now,
and it is a `<Link>` to the Profile screen — same squircle, same
`surface-inverse` treatment as before, plus the app's standard press feedback
(`active:scale-[0.97]`, 150ms ease-out, matching the folder cards on
/projects). Its href comes in as `profileHref` (was `settingsHref`), defaulting
to the `/profile` redirect stub for the picker, which has no project in scope.

**Profile** (design-sync/profilescreen) is one centred column on the plain
canvas — avatar, name, "Member since …", the live connection pill, three menu
rows, and a red circular log-out button. No GlowPanel: the export puts the
content straight on the page background, same as Connections.

- **The menu row** — 312×40, surface-4, rad-lg, icon (`icon-subtle`) +
  `body-lg-bold` label. **The dotted rule and caret mark a row that opens
  something**: the export omits both from "Replay onboarding", which acts in
  place. So there are two components, and which one you reach for is decided by
  that, not by styling — `profile-row.tsx` for a row that just does the thing,
  `profile-disclosure.tsx` for one that expands.
- **The disclosure** (`components/profile/profile-disclosure.tsx`) expands in
  place to 312×188 / 312×180, caret rotating a quarter turn to point up. Its
  motion is the reference implementation for any accordion in this app, and
  every value is justified in the file against
  `.agents/skills/review-animations/STANDARDS.md`: height on
  `grid-template-rows` 0fr→1fr (the one place the transform-only rule can't
  hold — nothing else pushes the rows below it), 220ms open / 160ms close on
  the strong ease-out both ways, and a 140ms content fade *offset* from the
  height rather than parallel to it so text never smears against the closing
  edge. Closed panels are `inert`, not hidden.
- **The log-out button** is a 40px `surface-danger` circle carrying the
  export's own red glow (`0 4px 16px 4px rgba(162,0,0,0.2)` — dilate 4, dy 4,
  stdDeviation 8 read off the exported SVG's filter). Not a token; the same
  literal-shadow exception toast.tsx takes.
- **`ConnectionCountBadge` is shared** (components/shared/) between this screen
  and Connections — the same pill, the same "live connections, not rows" rule.

**Profile and Settings are one screen.** Neither held enough to justify two,
and with the gear gone there was only one way into that corner anyway, so
Profile now renders what Settings had — the AI-models card and Log out, on the
Instructions page's column rhythm — until the Figma export replaces it.
`/projects/<id>/settings` and the top-level `/settings` stub both redirect into
it rather than being deleted, so old links still land somewhere real, and the
dashboard's "AI Model" setup row points at Profile directly.

## Tooltip open delay

**200ms, everywhere.** `TOOLTIP_OPEN_DELAY_MS` in components/ui/tooltip.tsx,
applied through a single `TooltipProvider` wrapping `{children}` in
app/layout.tsx. The global Provider is what makes it app-wide: Base UI resolves
a provider-less trigger against its *own* 600ms `OPEN_DELAY`, so changing the
wrapper's default alone would only have moved the handful of tooltips that sat
inside a local Provider. Generate's model/account pills gave up their own
300ms and inherit it. **The dashboard's total-posts bar keeps `delay={0}`** —
the percentages are the point of the bar rather than a hint about it, so it
opens on contact; both keep their local Provider, which still earns its place as a *delay
group* — Base UI shows the next tooltip in a group instantly, so sliding across
the bar's bands or from one pill to the other doesn't re-wait. That grouping
now also spans the app as a whole, so moving between any two triggers while one
tooltip is open is instant.

## AI models list (Profile) — from the "ProfileScreenRedesign" export

The saved-models list is **one bordered tray, not a stack of cards**
(`components/settings/ai-models-panel.tsx` + `ai-model-entry.tsx`):

- Tray: `bg-surface-2`, `border-border-subtle` at `stroke-lg` (2px), `rad-md`
  (8px, squircled), `gap-dist-xs` (2px).
- Row: `bg-surface-3`, `px-pad-sm py-pad-xs`, **square corners** — the tray's
  rounding clips them. 52px tall at one line of each text style.
- **The 2px gaps are the separators.** The tray's own surface-2 shows through
  between surface-3 rows, which is why there is no divider element and why
  `DottedDivider` was removed from this list.
- Row text: label `body-lg`/`text-bold`, then `{Provider} key ending ***{last4}`
  in `body-md`/`text-subtle`. Delete affordance is 24×24, `p-pad-xs`,
  `bg-surface-2`, `rad-sm` (4px, squircled), 16px Trash.
- **Scrolling:** `max-h-38` (152px) rather than the export's fixed height. At
  three rows the export deliberately clips the third mid-line to signal more
  content, and max-h reproduces that while letting one or two rows hug instead
  of leaving a band of empty tray. Native scrollbar hidden
  (`HIDE_NATIVE_SCROLLBAR_CLASSNAME`); **no custom thumb** — at this width it
  would sit on the delete buttons, the same call made for the page-level
  `<main>`. The half-visible row is the affordance.
- Verified against the export in-browser: 148px inner height (152 − 2px
  borders), 52px rows, 2px gap, 2px border, `#e7dfdc`, clip-path applied,
  scrollTop 0 → 120.
---

## 9h. Social connections — the fourth state, "revoked"

§9a describes the connected row's three treatments, all driven by how much of
the 60-day token is left. There is now a fourth, and it is the one no date can
produce: the member removed Presto's access at LinkedIn's end, so a token with
weeks still on it simply stopped working.

**It reuses the expired treatment exactly** — red `surface-danger` block, the
WarningDiamond, the success-green Reconnect, no countdown — and changes only
the line of copy, to "Connection revoked". Deliberate: the *cause* differs, the
*remedy* doesn't, and inventing a fifth colour for "dead in a different way"
would ask the reader to learn a distinction that changes nothing they can act
on. **No Figma frame draws this**; it is composed from the exported expired
state.

**The countdown is dropped here too**, and that's the reason the rule is "dead"
rather than "expired": a revoked connection often has plenty of days left, and
showing "Expires in 54 days" under a red strip reads as a contradiction.

`connectionStatus(expiresAt, revoked, now)` (lib/format-date.ts) is the single
place that decides, and `isConnectionDead` the single predicate for "red and
Reconnect", so no caller can drift on which states count. **Expiry is checked
first**: a token that has both lapsed and been revoked reads "expired", the
reason a reader expects and one that is true whether or not a check ever ran.

Everything that counts *active* connections routes through the same pair — the
row, the "n connections active" badge, and the dashboard's setup checklist — so
a revoked connection stops counting as active everywhere at once. The Generate
page's account pill deliberately does **not**: generation never touches the
access token, so greying out a dead account there would block a choice that
still works (see the note in components/generate/account-options.tsx).

## 9i. X connections, and the platform a post cannot fit

**The connected row names an X account by its handle**, `@gdwn__`, not its
display name. On X the handle *is* the identity — unique, and the only thing
separating two people with the same display name. LinkedIn has none, so it keeps
the name; `resolvePostAccount` (lib/post-account.ts) falls through handle → name
→ platform label, so a blank name still renders something. Post cards follow the
same rule, so the pill on a card and the row on Connections always agree.

**An X row's expiry is its refresh token's horizon, not its access token's.**
The access token lasts two hours and is renewed silently; showing that would tell
every X user their connection expired today, forever. `fetchSocialAccounts`
resolves `refresh_expires_at ?? expires_at` into one `expiresAt`, so no component
branches on platform to render a countdown ("Expires in 180 days" on X, 60 on
LinkedIn).

### Moving a post to a platform it does not fit

X rejects anything over 280 characters, and a LinkedIn post is typically several
times that. The settled shape, after trying two others:

- **The switch is refused, not warned about.** A post sitting on X that X would
  reject is not a state worth being able to reach. A first pass allowed it with a
  character counter and a toast; both were removed — a counter that is only ever
  right at the boundary is noise on every card in the app.
- **The refused position is still offered by the pill.** It was briefly skipped
  in the cycle instead, which kept the control alive but made X quietly stop
  appearing — indistinguishable from "X isn't connected". Discovering *why* is
  the point, so the pill lands on it and the dialog explains.
- **The dialog carries both ways out**: Regenerate (rerolls for the target
  platform, then applies the switch) and "Skip to …" (the position the cycle
  would have reached anyway, so the pill is never a dead control). Closing it
  changes nothing, which is why the skip has to be a button rather than something
  dismissal does.
- **The switch lands only once the new text actually fits.** "It has been
  regenerated" is not "it fits" — a model can overshoot, and TasteTest ignores
  the prompt entirely. Failing that check reports "Still too long for X" and
  leaves the post where it was.
- **Try out is never refused.** `postAccountCycle` gives that position the post's
  own platform, so an X post's Try out entry carries `platform: "x"` — a naive
  limit check refuses it, which was a real bug. Nothing is published from a
  try-out post, so no limit applies.

All three surfaces that can reassign a post — post-details, the day deck, and the
Generating page — share the same `refusesPost` predicate between pill and guard,
so the two can never disagree about what is allowed.

`ConfirmationModal` gained an optional **`secondaryAction`** for this: a second
full-width button under the primary, `brand-secondary` so it stays subordinate,
with the actions in their own `dist-md` stack rather than the dialog's `dist-lg`
rhythm — two buttons offering alternatives read as one control group. The Figma
export draws a single button, so this is an addition. Its `icon` is optional too;
the too-long dialog omits it, the delete and disconnect dialogs keep theirs.

**A model that cannot meet a limit is greyed out rather than left to fail.** The
regenerate dialog takes the platform the reroll is *for* and disables TasteTest
when that platform has a length limit — it returns fixed canned posts of
1,274-1,513 characters and never reads the prompt, so it can never produce a
tweet. The selection falls back as well as the row greying out: the model
preference is persisted per project, so arriving with TasteTest already selected
is the common case, and confirming it would start a reroll that cannot succeed.

## 9j. Social connections — a stale grant, which is not a fifth treatment

§9h added a fourth *treatment* (revoked). This is a fifth *thing a row can be*,
and deliberately not a fifth treatment: a connection granted under an older,
smaller scope list than the app now asks for. The token is alive and still does
everything it was granted — so the row keeps its green block, its "Connected
as …", its Disconnect and its countdown. What changes is one chip.

**Why it isn't another `ConnectionStatus`.** Staleness is orthogonal to
liveness: a connection can be expiring *and* stale, revoked *and* stale. Folding
it into that enum would mean inventing a precedence order between a permission
problem and a date problem, for four combinations nobody has an intuition
about. It's a separate flag (`grantIsStale`) computed beside `status`, and only
the *chip* has to resolve a conflict.

**One chip, never two.** Where the row would show "Renew now" (≤ 7 days) and a
stale grant at the same time, the stale one wins. Both are the same authorize
redirect, so the click is identical; the copy that survives should be the one
about a permission the connection doesn't have, since renewing a token that
still works reads as optional and this doesn't. `RenewChip` is now
`ReconnectChip`, taking its label and tooltip as props — the two states differ
only in why they're asking.

- stale:    "Reconnect" — "Reconnect to grant Presto permission to post"
            (a two-sentence version was tried first and ran ~460px wide, far
            past the 312px row, laying a bar across the green strip it was
            annotating — a tooltip here has to fit on one short line)
- expiring: "Renew now" — unchanged wording from §9a.

**The predicate is `grantIsCurrent(scope)`** (lib/linkedin/scopes.ts), asked
against `LINKEDIN_SCOPES` rather than against any one scope name. So the state
is invisible today — every stored grant covers the list — and appears by itself
the moment a scope is added, for exactly the rows that predate it, and clears
itself on reconnect. That is the whole migration story for adding
`w_member_social`: LinkedIn invalidates previously-issued tokens when a
different scope is requested, and this is what tells the reader why, instead of
a silent 401 later.

**No Figma frame draws this either**; it is the exported expiring state's chip
with different copy. Not yet verified in-browser — it cannot render until a
scope is actually added.

## 12c. Overdue and failed — a marker, not a fourth tab

The Content page has three tabs and keeps them. A queued post that didn't go out
is still queued, so both of these states are said *on the card* instead:

- **Overdue** — `ClockCountdown`, `text-warning`, the word "Overdue". Its date
  passed and nothing published it.
- **Didn't send** — `WarningDiamond`, `text-danger`. An attempt reached LinkedIn
  and was refused; `posts.publish_error` carries which refusal.

**Failed outranks overdue, and they are never both shown.** A failed post is
past its moment by definition, but "we tried and it was refused" explains the
other one and is the state with something to do about it.

**The card gets two words; the post's own page gets the sentence.** Same
component (`PostStatusMarker`, `withReason`): on a card the only distinction
that matters is "this didn't go out", and the reason belongs where there is room
to say what to do about it. Copy lives in `lib/publish-failure.ts` so the toast
raised by a failed publish and the card's own treatment can never word the same
failure differently.

**Placement is the account/topics row, not the header.** The header is the
tightest thing on the card (232px at the deck's 272px width, already truncating
a date), and that row already leads with the time — which is exactly what the
marker qualifies: the time says when this was meant to go out, the marker says
it didn't. With a reason it takes `basis-full` and wraps to its own line above
the pill instead of widening the row.

**No Figma export draws either state** — the content exports predate publishing.
Composed from existing tokens and the card's own `body-md-bold`.

## 10b. X publishing — built, switched off, and said out loud

**Decided 2026-09-04.** X publishing works: `lib/x/publish.ts` is complete and
was exercised against the live API. It is switched off anyway, because posting
through X's v2 API is metered **per app across every user of Presto** rather
than per account — one member's click spends the app owner's budget — and the
first real send came back `402 credits depleted`. That is a cost decision, not
missing work.

**Nothing is deleted, and there are four switches.** `PUBLISHABLE_PLATFORMS`
(lib/post-publish.ts), `X_SCOPES` (lib/x/scopes.ts), `available` in
connections-panel.tsx's `PLATFORMS`, and the X app's own permission in X's
console. Tests in the first two fail loudly if either is flipped alone.

### The UI says "coming soon" rather than going quiet

Three surfaces, one rule: **a post whose platform will be publishable shows the
control disabled; a post with nothing coming shows no control at all.** The
distinction is `publishBlockedReason`, not `canAttemptPublish` — an
already-published or try-out post has nothing pending, and a greyed control
would be a promise that never lands. An X post beside a LinkedIn one with no
trace of the control reads as broken rather than pending, which is the whole
reason for the state.

- **Post details** — the paper-plane Button stays, `disabled`, with the reason
  in both its tooltip and its `aria-label` ("Publishing to X is coming soon").
  A disabled button still receives hover, so the tooltip works.
- **The deck's actions menu** — a disabled `MenuItem` reading "Publishing coming
  soon". `MenuItem` already styles `disabled` (`text-minimal`, no hover or
  pressed surface), so this needed no new treatment. **The label carries the
  reason because a disabled menu row cannot hold a tooltip** — "Publish now"
  greyed out says nothing.
- **Connections** — the Connect button is replaced by plain "Coming soon" text,
  which is what the Figma "Connect / Base" export drew for X before connecting
  shipped. `body-lg`/`text-subtle`, and `pr-pad-md` on the span: `PlatformRow`'s
  own `pr-pad-sm` is sized for a Button, which insets its label by a further
  `pad-md`, so bare text without that padding sits 12px nearer the edge than
  every other row's action.

### A connection that predates the withdrawal

It keeps its row — a live connection holding a stored token must not become
invisible — but loses every control that would *make* one:
`ConnectedAccountRow`'s `canReconnect={false}` drops Reconnect, "Renew now" and
the stale-grant chip, and a **dead** connection offers Disconnect where it would
otherwise offer Reconnect. An authorize redirect for a platform the app no
longer offers is a dead end wearing a button.

### Two consequences that fall out with no code

The Generate page's account pill already disables an unconnected platform
(`buildAccountOptions`), so X is disabled there on its own. And existing X posts
stay coherent: `lib/post-account.ts` falls back to the platform label when a
platform isn't connected, so their cards read "X" instead of an account name.

## 9k. A published post is read-only

**From `feat/published-posts`, 2026-09-04.** Publishing works, and what it
exposed is that the app had no concept of "published" as a *state a post is
in* — only as a tab it appears on. A live post could still be edited,
re-dated, moved to another account and regenerated, and none of that changes
what is public. The row and the real post drift apart silently.

**One predicate decides it: `isPostLocked` (lib/post-publish.ts)**, sibling to
`canAttemptPublish`, which now asks it too. Four controls across three surfaces
read it, and a control that locks on one screen and not another reads as a bug,
so there is exactly one definition. It keys off `publishedAt`, **never off
`platform`** — X publishing is being built alongside this and inherits the whole
treatment for nothing.

It counts two states as live: `published_at` set, and the `record_failed:`
marker (the share went out, the row's own write of it failed). The second is the
one every surface used to miss.

**Per control:**

| Control | Published |
| --- | --- |
| Inline content editor (click / double-tap) | Refused in the handler, and the `cursor-text` affordance goes with it |
| The date | The heading *is* the moment it went out; the pencil is removed, and the card's "Change date" button with it |
| Account pill | `nextAccount={null}` → a plain span. It still names the account, it just stops offering to change it |
| Turn to draft | Row left out of the actions menu; the button on post details stays disabled |
| Regenerate | **Stays, keeps its name, and writes a new draft** |

Nothing is *disabled and left sitting there* except the middle post-details
action, which keeps its place in a fixed row of four. Everywhere the layout can
absorb it, the control is gone: a greyed button invites a click that can never
do anything.

**Delete stays,** unchanged. It removes this app's record and its own copy says
the live post survives.

**Regenerate writes a new draft, and is still called Regenerate.** Rewriting a
published post would only make the screen and the timeline disagree, so it
writes a *new draft* instead (`draftFollowUpPost`) — a piece that landed well is
exactly the one worth another angle on. Same brief, with the published text as
`previousContent`. The new post inherits platform, try-out flag and topics and
nothing else: no date, no publish state, a fresh id.

**The control is not renamed** (per direct request, after the first pass called
it "Draft a follow-up" on the card, the tooltip and the modal title). Same
label, same ArrowClockwise icon, same modal title, same button labels — a
published post's Regenerate should not read as a different feature.
`RegenerateModal`'s `mode` therefore changes only two things: the placeholder,
and a `body-md`/`text-subtle` note under the title reading **"This will create
another post in your drafts"**, with an Info button to its *right* (the app's
other info lines lead with the icon; here the sentence is the thing being read
and the icon is the offer of more). Its tooltip carries the why: "A published
post can't be edited here — it's already live. Regenerating writes a new draft
instead." The note is pulled up with `-mt-dist-md`, cancelling half the dialog's
`gap-dist-lg` so it sits with the heading rather than between heading and field,
and the tooltip is capped (`max-w-64`) because at its default this sentence is
one ~440px line that lands on the dialog's close button.

**The publish confirmation carries no icon.** "Published to LinkedIn" with a
tick beside it is the toast saying the same thing twice. Scoped to that one
toast, not to success toasts generally.

**The click navigates, and the generation happens where you land.** The insert
is cheap — `draftFollowUpPost` calls no model — so the new draft's page opens at
once and the text streams in *there*, through the same route and the same
"generating post . . ." treatment an ordinary reroll uses. There is no success
toast: arriving on the post is the confirmation. The old shape (generate, spin
the button, toast a link) was replaced because a spinner on a 24px button is not
a loading state anyone can read.

Two mechanics this rests on. The draft is **seeded with the published text**,
since `content` cannot be empty and a copy is the only seed still useful if the
generation fails; it is never seen in the happy path. And the brief picked in
the modal crosses the navigation through `lib/pending-regeneration.ts`, a
consume-once module store — not a query string, because guidance is the user's
own free text. It degrades to nothing on a hard reload, which is the safe
direction: a lost handoff costs one click, a persisted one could re-fire a
generation on a post someone only meant to open.

**The card's header, on both surfaces.** A post published straight from a draft
never gets a `scheduled_for`, so its heading used to read "Draft" above
something live on LinkedIn. It now reports the published moment, with
PaperPlaneTilt in place of the calendar icon. Absent on the live-but-unrecorded
case, where the moment genuinely isn't known — the status chip says so there
(see §12c).
