# LEARNINGS.md — solved once, never again

Every non-obvious thing this project has been bitten by, in the shortest form
that still prevents a repeat: **symptom → cause → rule**. Read the section that
matches what you're about to touch *before* you touch it.

**Add an entry the moment something surprises you** — while the cause is still
in front of you, not reconstructed at the end of the task. One entry per
learning; if you're writing a narrative, it belongs in `EXECUTIONS.md`.

Companions: `INTERFACE.md` (design decisions), `EXECUTIONS.md` (what was done).

---

## React

**A `useEffect`/`useLayoutEffect` that observes a DOM node misses conditionally
mounted ones.** The effect runs once against a `null` ref and, since its deps
never change, never gets a second chance when the real node appears (bit us in
`use-squircle-clip-path.ts` inside a portal, and in the skip-dates carousel's
width measurement). → **Use a callback ref.** It fires on every real
attach/detach.

**An inline `[]` or `{}` passed to a hook is a new value every render.** A hook
whose effect depends on it by reference re-fires forever — `setState` in an
effect, "Maximum update depth exceeded", and React silently bailing out of the
loop, which makes *animations look like they snap* rather than looking like an
error. → Hoist a module-level constant (`const NO_MONTHS: MonthSelection[] = []`).

**Reading a hook-returned ref object during render trips `react-hooks/refs`.**
`scrollFade.ref` in JSX errors; `const { ref } = useScrollFade()` doesn't. → Always
destructure at the call site, and **don't thread refs into or out of custom
hooks** — handlers should read `event.currentTarget` instead (`use-drag-scroll.ts`).

**localStorage in state is the "external store" case.** Copying it into state in
an effect trips `react-hooks/set-state-in-effect` and has no server snapshot. →
`useSyncExternalStore` over a module-level store. Accept the one-frame default.

**Refs restore on remount; state doesn't.** RHF-registered uncontrolled inputs
survive a remount (`shouldUnregister` defaults false) — component state doesn't
survive a route remount, which is why the Content tab had to move to storage.

**React captures its `fetch` reference at module init**, so monkey-patching
`window.fetch` never sees server-action calls. → Wrap explicitly at the call site
(`withNetworkStatus`).

**Clearing a list in state doesn't clear what it wrote to the DB.** The
Generating page's Restart reset `posts` to `[]` and re-ran the batch, but the
loop's only verb was an INSERT — so every previous row stayed, orphaned, and a
calendar-based re-run stacked a second post onto every day it had already
scheduled (visible in the live DB as duplicate pairs sharing a `scheduled_for`
to the second). → A "start over" over persisted rows needs a slot → row id map
so the re-run can UPDATE what that slot already produced, with the INSERT as the
fallback for slots whose row is genuinely gone. Key the map on the **batch
index**, never the array position — deletes shift the latter.

## Next.js

> This is **not** the Next.js in your training data. Read
> `node_modules/next/dist/docs/` before writing anything.

**Server Actions have a hard 1MB body limit** (`1024 * 1024`, the silent default
with no `serverActions.bodySizeLimit` set). A larger request is rejected by the
framework *before* any of your validation runs, as an opaque error — so a "10MB
max" check in the action is dead code. → 1MB is the real limit; enforce it
client-side too. Raising it means moving the client check **and**
`next.config.js` together.

**`route.ts` may export only route handlers.** Next type-checks that file's
exports, so a shared `const` parked next to `GET` (the LinkedIn OAuth state
cookie name, shared by the authorize and callback legs) fails the build as an
invalid route export. → Shared values belong in a lib module both routes
import, never in one of the route files.

**A layout's own errors are caught by the boundary one segment up.**
`[projectId]/layout.tsx` throwing is caught by `app/projects/error.tsx`, not the
sibling `error.tsx` inside it.

**`reset()` alone looks like a dead button** — it re-renders the boundary against
the same already-failed RSC payload. → `router.refresh()` *then* `reset()`, in a
transition. And an error boundary can't read *why* it rendered (messages are
redacted in production), so its copy must not commit to a cause.

**`useLinkStatus` is the wrong tool for a section spinner.** Its pending flag is
true "before history updates, false after" — the URL changing, not the new tree
painting — and it's **skipped entirely for prefetched routes**, which every
sidebar link is. → Arm on the link's own `onClick`, clear when `usePathname`
reaches the target.

**The router will commit a superseded navigation's late content.** Tap A, tap B
while A's fallback is up, and A's page can paint in full before B commits (17–425ms,
nondeterministic). → A navigation armed while another is in flight skips the
show-delay and renders its overlay synchronously from the arming render.

**A folder whose name starts with `_` is a Next private folder** — excluded
from routing entirely, so `app/__preview/page.tsx` is a 404 with no error to
explain it. Fine for colocating helpers; surprising when you meant a route.

**Middleware is `proxy.ts` in Next 16.**

**A page with no `loading.tsx` doesn't commit until its fetch returns** — the tap
appears to do nothing. Add one that renders the page's own shell.

## CSS

**`overflow-x: auto` forces `overflow-y: auto`.** An axis can't stay `visible`
once the other scrolls — so a horizontal row clips drop-shadows vertically. →
`py-*` for the bleed plus a cancelling `-my-*`.

**`overflow: hidden` is still a scroll container.** Content wider than the box
(deliberately oversized artwork) can be scrolled into view by anything —
accessibility-tree clicks did it — and stays there. → `overflow-clip`, which
crops identically and is never scrollable.

**But `clip` does *not* zero a flex item's automatic minimum size the way
`hidden` does.** Switching silently un-caps the element's height. → Say it
explicitly with `min-h-0`.

**Any `clip-path` other than `none` makes the element the containing block for
its `fixed` descendants.** A `fixed inset-0` overlay rendered inside a
squircle-clipped panel lays out *inside the panel* and gets cropped. → Portal
overlays to `<body>`.

This has now bitten three times — day-deck's overlay, post-details' toast, and
Profile's change-password toast, which appeared to slide out of the password
card instead of down from the top of the screen. Every squircled card in this
app carries a clip-path, so **any toast raised from inside a card hits it**. →
`components/shared/toast-slot.tsx` is the shared fix; reach for it rather than
writing another `fixed inset-x-0 top-pad-2xl` wrapper in place.

**Identical transitions do not make two elements move as one.** A popover card
and its tip, each with the same duration and easing but scaling around its own
transform-origin, travel at different rates in screen space — the tip visibly
detaches and re-seats. → Put the smaller part *inside* the element that
animates, so one transform moves both. Same reasoning as the FLIP/offsetParent
note below: geometry, not timing.

**Base UI's enter/exit animations need `data-starting-style` /
`data-ending-style`, not a React `open ?` ternary.** The element mounts with
`open` already true, so a ternary renders it at its final state with nothing to
transition from — it snaps, and any dials driving it look dead. → Keep the
resting state as the base classes and put the from-states on the two data
variants, as dialog.tsx does.

**"Declared" is not "running".** Reading `transition-duration` /
`transition-timing-function` off a settled element proves only that the
transition exists, not that it ever played — a snapping element reports exactly
the same computed values. → Verify motion by catching a mid-flight frame with
`computer` (screenshots foreground the tab), or by cranking the duration up
first. Never conclude from computed styles alone.

**Base UI's `Popup` parts ignore the `style` prop.** Dialog.Popup and
Popover.Popup both write their own `style` attribute straight to the DOM,
outside React, clobbering anything passed in that way — an inline
`transitionDuration` silently reverts to whatever the class list says. → Set
CSS variables on the *positioner* (or any ancestor you own) and reference them
from the popup's className; variables inherit and nothing overwrites them.

**A `transform` makes the element its descendants' `offsetParent`.** FLIP
measurements taken inside a transformed row miss the row's own re-centring. →
Put the transform on a wrapper *around* the scrolling row.

**Tailwind's `scale-*` sets the standalone `scale` property, not `transform`.**
A transition list saying `transform` therefore never animates it.

**An inline `transition` shorthand fully replaces a class-based one** for the same
property — so a JS-set `transition: transform …` permanently disables that
element's own class-driven fade. → Animate with WAAPI instead; it runs
independently of the `transition` property.

**A CSS transition only starts if the browser rendered the old value first.** In a
commit big enough (swapping a whole list), the change can land without an
observed previous frame and the element jumps — no `transitionrun` at all. → WAAPI
states its own from/to and can't depend on the previous frame.

**`blur()` and `drop-shadow()` are both `filter`** — animating blur inline
replaces the shadow, and Motion *parks* `filter: blur(0px)` when it finishes, so
it stays replaced. → Two elements: wrapper animates, inner keeps the shadow.

**A clip-path cuts the element's own drop-shadow.** → Two divs: shadow outside,
clip inside.

**Auto margins collapse to 0 once content overflows** — `mx-auto` can't centre an
overflowing row. → Centre by setting `scrollLeft`, before measuring children.

**Positioned elements paint after static ones regardless of DOM order**, and
same-`z-index:auto` positioned siblings paint in DOM order. Dropping
`position: absolute` without adding `relative` made a block disappear behind an
image; ordering the image before `<nav>` is what keeps nav on top.

**A flex row's `align-items: stretch` is why a short card's border runs past its
content** — and `h-full` on the inner card is what makes it fill the stretched
height. Adding a wrapper between row and card breaks that chain unless the
wrapper carries `h-full` too. (Content later chose hugging heights + `items-start`
instead.)

**A flex item's automatic minimum is its content**, so a row that must shrink
needs `min-w-0`.

**A row sized by its tallest child changes height when that child changes.** A
list of rows whose actions differ — a 32px button in one, plain text in the
next — comes out ragged (48px vs 40px). Pin the content band to the tallest
action's own height token rather than fixing the row height.

**cubic-bezier overshoot is a proportion of the animated range** — on a 0.9→1
scale it's under half a percent, i.e. invisible. → `linear()` for a fixed-size
overshoot.

## Browser runtime

**A backgrounded tab suspends rAF and transitions**, and their completion events
never fire. An item removed just as the tab loses focus stays mid-fade forever.
→ Every unmount waiting on `transitionend` / `animation.finished` needs a
`setTimeout` backstop, cancelled by whichever path finishes first.

**`Promise.all(animations.finished)` rejects the instant any one is cancelled** —
which unmounted a whole deck and cut every *other* card's flight short. →
`Promise.allSettled`.

**Leaving entrance animations with `fill: "both"` keeps a compositor layer alive
per element** for as long as the view is open. → Cancel once they land; the last
keyframe is the resting state, so nothing moves.

**macOS overlay scrollbars silently ignore `::-webkit-scrollbar`.** → Hide the
native scrollbar and render a real thumb element.

## Third-party APIs

**LinkedIn serves profile pictures from two hosts**, and its own docs
disagree: the Sign In with OpenID Connect page samples
`media.licdn-ei.com`, the media guides use `media.licdn.com`. → next/image's
`remotePatterns` must list **both**, or an unlucky share of members get a
400 and a broken avatar. Symptom would have been intermittent and
member-specific, i.e. nearly impossible to reproduce locally.

**Those URLs are also time-limited and dynamically keyed** — LinkedIn tells you
to re-fetch them periodically. Anything that *stores* one (we hold it for the
life of a connection, up to 60 days) needs an `onError` fallback, not a
guarantee.

**LinkedIn returns granted scopes comma-delimited, though you send them space-
delimited.** A live exchange for `openid profile email` comes back as
`email,openid,profile` — reordered and re-separated. → Anything testing whether
a scope was granted must split on both, or it will report a granted scope as
missing.

**Plain `http://localhost` redirect URIs are accepted** by the developer portal
and the authorization endpoint, despite the docs saying HTTPS. Verified live on
`http://localhost:3001/...` — no tunnel needed for local development.

**An OAuth callback registered from a worktree breaks the moment the branch
merges.** `redirect_uri` is derived from the request's own origin, and each
worktree owns its own dev-server port — so the flow verified on
`http://localhost:3001/...` started sending `:3000` once the branch landed and
`main` became the place it runs. LinkedIn matches the URI byte-for-byte (scheme,
host, **port**, path, trailing slash) and answers *"The redirect_uri does not
match the registered value"*, which reads like a code bug and isn't one — the
origin-derived default is correct and is what makes previews and production work
without per-environment config. → **Register `:3000` alongside the worktree's
port** when a branch first registers a callback anywhere external; the portal
accepts several. Don't "fix" it by pinning `LINKEDIN_REDIRECT_URI` to the
worktree port — nothing is listening there once the worktree is gone. That
variable is only for a proxy whose internal origin isn't the public one.

**LinkedIn access tokens: 60 days, no refresh for ordinary apps.** Programmatic
refresh tokens are MDP-partner-only. Re-auth before expiry skips the consent
screen; after expiry it doesn't. And **changing the requested scope invalidates
every previously issued token** — so adding a scope is a migration, not an
edit.

## Supabase & auth

**"Request failed" and "request rejected" are indistinguishable at the call
site.** `signInWithPassword` errors identically for a wrong password and a dropped
connection; `getUser()` returns no user for both an expired session and an
unreachable auth server. That's how a dropped wifi said *"Incorrect email or
password"* and bounced people to `/login` mid-session. → `isNetworkError`
(`lib/network-error.ts`) is checked **before** any "wrong credential" branch, and
middleware won't redirect on a network failure while an auth cookie is present
(RLS still gates every row, so the worst case is an empty page).

**A connectivity probe must target the backend, not your own origin.** `/favicon.ico`
is localhost in development — reachable with the wifi off — so the offline toast
dismissed itself ~5s after appearing. → Probe
`${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` with `mode: "no-cors"`: reachable
resolves opaquely, only real connectivity failure rejects.

**RLS makes "someone else's row" and "no such row" identical** — which is the
point. Don't try to distinguish them in error copy.

**A server component that throws on a failed query is safer than one that returns
null** — it can't render a page for someone who isn't signed in.

## AI

**Vercel AI Gateway BYOK is a *preference*, not a requirement.** The docs say a
request "may still fall back to use system credentials if the provided
credentials fail", and there is no flag to forbid it — so an expired user key
quietly bills *this app*. Detection is only after the fact, via
`gateway.getGenerationInfo({ id })`'s `isByok`. → Check at key-add time and after
every BYOK generation, and **fail open** on an indeterminate result (flipping a
working model to an error state on a flaky lookup is worse than missing one).

**`ai@7` re-exports `gateway`/`createGateway`**, and a plain `"creator/model"`
string routes through it — no package needed, and provider-executed tools still
pass through.

**A regenerate is not a delete-and-insert.** Keep the id (cards are keyed on it),
the date and the platform; read everything the prompt needs from the stored row,
not from the client, which may be stale.

**A reroll at the same prompt lands near the same answer.** The rejected text has
to be quoted back with a "new angle" instruction, placed **last** so it's the
most recent thing the model reads.

**Don't non-null-assert a value restored from localStorage** (`MODEL_OPTIONS.find(…)!`)
— an id deleted since the last visit throws on render. And gate the repair effect
on an explicit `loaded` flag: "list is empty" is indistinguishable from "not
fetched yet".

## Tooling

**Figma REST API and Figma MCP are rate-limited to unusable levels** on the free
Starter plan. → `design-sync/` exports via the Figma Bridge plugin, always.

**tailwind-merge silently evicts custom font-size classes.** `text-heading-lg` and
`text-text-subtle` fall into the same default bucket, so one drops the other. →
`cn()` uses `extendTailwindMerge` with this project's tokens registered.

**DialKit's default panel id is per component *instance*** (`name-${useId()}`), so
a `useDialKit` call inside a reusable component registers a duplicate panel per
mount (four identical "Toast" panels on one page). → Any `useDialKit` outside a
single-instance component needs an explicit `id`.

**Tuned motion values get frozen into constants and the dial panel deleted** —
git history holds it if it ever needs re-tuning.

## Git worktrees (parallel branches)

**Turbopack refuses a symlinked `node_modules` and takes `next dev` down with
it.** A worktree with `node_modules` symlinked to the main checkout panics on
boot: *"Symlink [project]/node_modules is invalid, it points out of the
filesystem root"*. The trap is that it looks fine right up until you run the
app — `tsc --noEmit` and `vitest` both resolve through the symlink happily
(vitest even picks up a symlinked `.env.local`), so every cheap check passes.
→ **Clone `node_modules` instead of linking it**: `cp -Rc` on APFS is
copy-on-write, so it costs ~10s and shares the blocks rather than another
657 MB. Only `node_modules` needs this; `.env.local`, `design-sync/` and
`.claude/settings.local.json` are fine as symlinks and *should* stay symlinks so
a new Figma export is visible everywhere at once.

**A gitignore pattern with a trailing slash does not match a symlink to a
directory.** `/design-sync/` matches a real directory only — to git a symlink is
a symlink, not a dir, so the linked `design-sync` in every new worktree showed
up as untracked and made the tree permanently dirty (which then blocked
`worktree.sh remove`, which refuses to tear down dirty trees). → **Drop the
trailing slash** (`/design-sync`) for anything that might be symlinked.

**A per-worktree port leaks into anything registered externally.** An OAuth
callback URL, a webhook endpoint, an allowed origin — all pinned to the port the
branch happened to own, and all wrong the moment it merges to `main` on :3000.
→ Register both, at the time you register either. See the LinkedIn
`redirect_uri` entry under Third-party APIs.

**A worktree must live outside the repo.** Nested under the project root it gets
walked by `next build`, eslint and vitest globs, silently duplicating every file
in the project. `../presto-worktrees/<slug>` — a sibling directory, not a child.

**`git worktree remove` and `git branch -d` are the safety, so never work around
them.** `remove` refuses a worktree with uncommitted changes and `-d` refuses a
branch whose work is not in `main`. Both refusals are the feature. `-D` is never
the answer — it deletes work that exists nowhere else.


## Browser automation (verifying in-browser)

**Every `javascript_tool` eval backgrounds the tab** (`visibilityState:
"hidden"` inside the eval), which suspends rAF and throttles `setTimeout` to
~1/sec. So: Motion animations freeze at their initial frame, mid-flight DOM
sampling reports only the `initial` state, and **absolute timings are
meaningless**. → Read initial/settled values via eval; catch frames with
`computer` screenshots (which foreground the tab); trust a MutationObserver's
**ordering**, never its clock; run spring math in Node against Motion's own
`spring()` generator.

**ResizeObserver callbacks do not fire during an eval either, and they make
a working element look broken.** Testing `useScrollFade` on a line that stops
overflowing: an eval widened its container, waited, and read the mask back
unchanged — the element was 945/945 (nothing hidden) and still carried a 24px
fade. The hook looked wrong; it wasn't. RO callbacks are delivered as part of
the rendering steps, which a hidden tab suspends along with rAF, so the
observer had simply never run. Interleaving a `computer` screenshot (which
foregrounds the tab) between the resize and the read gave the correct
`black 0px, black 100%`. → Any DOM change whose effect is delivered by the
frame lifecycle — RO, IntersectionObserver, transitions, rAF — needs a
foregrounding call between the mutation and the measurement.

**Mutating the DOM in an eval does not re-run a React hook's effect**, so a
value the effect writes will read stale and indict the wrong code. Setting
`textContent` directly to test a shorter string left the old mask in place,
because nothing re-rendered — in the app the same change arrives as a prop and
the (dependency-array-free) layout effect re-measures on that render. → Test
through something React or the browser actually reacts to (a resize, a real
navigation), never by editing the DOM under it.

**A short-lived, auto-dismissing element can vanish between two standalone tool
calls.** A 4s toast read as "never rendered" across several navigate →
screenshot pairs, and the eval sent to check the DOM had itself backgrounded
the tab, freezing the toast at `opacity: 0` — which looked like confirmation.
Both readings were artifacts, and the code they indicted was fine. → Put the
navigate, the wait and the screenshot in **one `browser_batch`**, and before
blaming a mechanism, revert to it and re-measure the same way.

**A Base UI element measured through an eval shows `transition: none` and
`data-starting-style` still attached** — that's not a bug, it's the starting style
waiting for a frame that never comes while you're looking. Hover with `computer`
first, then measure.

**`useLayoutEffect` with no dependency array is right for a fixed-size scroller**
observed by a ResizeObserver — content changing what's scrollable doesn't resize
anything, so there'd be nothing to depend on.

**Don't drive a verification run with `location.href`.** Assigning it while
React's ViewTransition is still running a client-side push throws
`InvalidStateError: Transition was aborted because of invalid state` — which
reads exactly like a bug in whatever you just changed, and it isn't. It also
races a slow dev server: the forced load can land before the previous page
finished resolving, so the clicks that follow hit a page that isn't there yet
and the run silently tests nothing. → Navigate with the `navigate` tool or a
real click, wait for the screenshot to show what you expect, and compare
against the stashed build before believing a console error is yours.
## Tooling: prettier is not this project's formatter

**Symptom:** a new component came back reformatted with semicolons and different
line breaks, matching nothing else in the codebase.

**Cause:** `npx prettier --write <file>` was run to tidy a hand-edited file.
There is no `.prettierrc` in the repo and prettier isn't in `package.json` — so
it ran with its own defaults (semicolons on), not this project's style.

**Rule:** don't run prettier here. Formatting is whatever ESLint enforces plus
the existing files' conventions (no semicolons, double quotes). If a file needs
tidying, edit it by hand and check it against a neighbouring file.

## An href-builder prop silently breaks the Server → Client boundary

**Symptom.** The dashboard route rendered `route-error-recovery.tsx`'s
"Something's wrong" screen with no type error and nothing wrong in the
component. The dev server log carried the real message:

> Functions cannot be passed directly to Client Components unless you
> explicitly expose it by marking it with "use server".
> `{generate: ..., content: ..., post: function post}`

**Cause.** A Server Component passed a client component an `hrefs` object
holding `post: (postId: string) => string`. Props crossing that boundary are
serialised, and a function isn't serialisable. TypeScript can't see it — the
prop types are perfectly valid on both sides — so the first sign of it is a
blank error boundary at runtime.

**Why it's easy to walk into.** An href builder is the *natural* shape for
"one card renders many links off a base route", and it's the shape you'd
reach for without thinking in a fully-client app. Formatters, comparators
and `renderItem` callbacks are all the same trap.

**Rule.** A Server Component hands a Client Component **data, never
behaviour**. Pass the base string (`postBase: "/projects/<id>/calendar"`) and
let the client compose; pass a value, not a formatter. If a callback genuinely
has to cross, it must be a `"use server"` action.

## A CSS mask erases `position: fixed` descendants that sit outside the box

**Symptom.** Adding a top fade to the in-project `<main>` with `useScrollFade`
looked perfect — and silently removed every Toast in Instructions,
Connections, Settings, Content and Generate.

**Cause.** Those five sections render their toast into a
`fixed inset-x-0 top-pad-2xl z-50` slot **inside** `<main>`. A mask is applied
to the element's entire painted subtree, with the mask's geometry taken from
the element's own border box. `<main>` starts ~136px down the viewport; the
toast is fixed at 32px. It therefore maps to a fully transparent part of the
mask and is painted out completely — not clipped, not moved, gone.

**What is *not* the cause, checked rather than assumed.** `mask` and
`clip-path` do **not** make an element the containing block for its
fixed-position descendants — of the three usual suspects only `filter` does
(probe at viewport 0,0 stayed put under mask and clip-path; under `filter` it
jumped to the element's own 136,536). The toasts keep correct positioning
throughout. Being painted out is the entire failure.

**Rule.** `useScrollFade` is safe on a scroller with **no fixed descendants** —
which is every other one in this app (Kanban board and columns, the day deck's
row, pill-textarea, the Content month list). For a container that hosts fixed
children, fade with an **overlay strip in the canvas colour** instead
(`components/shared/section-scroll-area.tsx`). Before masking any container,
ask what `position: fixed` renders inside it.

## `rounded-rad-rd` silently computes to 0px — the token exists, the utility doesn't

**Symptom.** Every progress bar on the dashboard rendered square-ended despite
carrying `rounded-rad-rd`, and the Setup badges were squares instead of
circles. Caught by an annotation ("use rounded corner edges for every bar"),
then confirmed: `getComputedStyle(track).borderRadius === "0px"` with the class
plainly on the element.

**Cause.** `app/globals.css` defines `--rad-rd: 100000px` in `:root` — so the
*variable* resolves fine and looks present to a grep — but the `@theme` block
that maps radii into Tailwind stops at `--radius-rad-xl`. There is no
`--radius-rad-rd`, so Tailwind generates no `rounded-rad-rd` utility at all and
the class is inert. Nothing warns: not TypeScript, not ESLint, not the build.

**Why it's easy to walk into.** Every other radius in the token file *does*
have a matching utility (`rounded-rad-md`, `-xmd`, `-lg`…), so the name pattern
invites the assumption. `--rad-rd` is also genuinely used elsewhere in the
export data, which makes it look wired up.

**Rule.** Stadium/pill shapes use **`rounded-full`**, which is what the rest of
this codebase already does (`toast.tsx` documents the same swap, plus
avatar.tsx, select-pill.tsx, number-stepper.tsx). More generally: a `--x-*`
variable existing in `:root` is not evidence that a Tailwind utility exists —
only a `@theme` entry in the right namespace (`--radius-*`, `--color-*`,
`--spacing-*`) generates one. When a token class seems to do nothing, read back
`getComputedStyle` before assuming the value is wrong.

## localStorage is shared by every worktree that has used the same port

**Symptom.** The Generate page failed for one branch with the generic
"We couldn't load this page. Check your internet connection & try again." —
intermittently, and only on that branch. Nothing was wrong with the network.

**Cause, in two layers.** The visible one: `generate-card.tsx` restored
`account` from localStorage without validating it, then non-null-asserted the
option lookup (`ACCOUNT_OPTIONS.find(...)!`) and read `.icon` off the result.
An unknown value therefore threw a `TypeError` during render, which the route's
`error.tsx` caught and reported as a connectivity problem — that copy
deliberately doesn't commit to a cause, because Next redacts the real one in
production.

The layer that made it *look* random: **localStorage is keyed by origin —
`http://localhost:3002` — not by branch, worktree or checkout.** Every worktree
dev server that has ever run on a given port shares one storage bucket. The
try-on branch had written `account: "tryout"` while it held :3002; this branch
later moved from :3003 to :3002 and read that value straight back. Same code,
same branch, different port, different outcome.

**Rules.**
1. Treat anything out of localStorage as **untrusted input from another
   branch**, not just from an earlier version of your own. Validate a restored
   value against the list it has to belong to, and never non-null-assert a
   lookup keyed on one.
2. When a bug follows the *port* rather than the branch, suspect origin-scoped
   browser state (localStorage, sessionStorage, IndexedDB, cookies, service
   workers) before suspecting the code.
3. A generic "check your connection" screen is a rendering error until proven
   otherwise — read the browser console for the real throw.
## A disabled <button> swallows the mousedown a floating menu depends on

**Symptom:** clicking a greyed-out row in the Generate page's account menu
closed the whole menu, as though a real option had been picked. Nothing was
selected — the menu just vanished.

**Cause:** `SelectPill` keeps its menu open by holding focus on the trigger:
the menu card's `onMouseDown` calls `preventDefault()`, so the click never
blurs the trigger. Disabled form controls don't dispatch mouse events *at
all*, and nothing bubbles out of them — so that handler never ran, the trigger
blurred, and its `onBlur` closed the menu. The row itself did nothing, which
is why the selection was unchanged.

**Rule:** a disabled row inside a focus-held popup needs `pointer-events-none`
on top of `disabled`. Then the click hit-tests through to the menu card, whose
own `onMouseDown` runs and keeps focus (and the menu) where it was. `disabled`
alone makes a control inert; it does not make it transparent.

### A `"use server"` file may export *only* async functions — a re-exported type breaks it at runtime

**Symptom.** Generation died before it started, with a server-side
`ReferenceError: PostRow is not defined` thrown at *module evaluation* of
`post-actions.ts` (pointing at an unrelated line — the first export after the
offending one), a 500 on `POST /…/generating`, and no posts written. Nothing
was wrong at the line the trace named, and `tsc --noEmit` was completely clean.

**Cause.** Moving the `PostRow` type into `lib/supabase/queries.ts` left this
behind in `post-actions.ts` so an existing importer wouldn't have to change:

```ts
import { …, type PostRow } from "@/lib/supabase/queries"
export type { PostRow }   // ← this
```

A `"use server"` module is rewritten by Next's server-actions loader, which
enumerates the module's exports and registers each one as a callable action.
Type-only exports are erased by the time it looks, so it emitted a value
re-export of a binding that does not exist at runtime. `tsc` can't see this —
the file is valid TypeScript; the breakage is in what the loader emits.

**Rule.** Every export from a `"use server"` file must be an async function.
Don't re-export types (or constants, or anything else) through one, even for
call-site convenience — put the type where it's declared and have consumers
import it from there. `app/api/regenerate-post/route.ts` now takes `PostRow`
straight from `lib/supabase/queries`.

**Corollary for verifying.** A green `tsc` + green unit tests do not prove a
server action still loads. Anything touching a `"use server"` file's exports
has to be exercised in the running app before it counts as done.

### `innerText` reads empty in a backgrounded tab — instrument with `textContent`

**Symptom.** A MutationObserver watching for a toast reported nothing, even for
a toast already *proven* to fire (the "Moved to draft" one, previously measured
at 15ms). Polling with `setInterval` found nothing either. The feature worked;
the instrument was blind.

**Cause.** Both probes read `document.body.innerText`. `innerText` is defined in
terms of *rendered* text — it forces and depends on layout — and a backgrounded
tab may not compute layout at all, so it comes back empty or stale. Every
`javascript_tool` eval backgrounds the tab (already noted elsewhere in this
file), so this hits every DOM assertion made through that path.

**Rule.** Use `textContent` for any assertion made from an eval. It is a pure
tree read with no layout dependency. Keep `innerText` only for the rare case
where the rendered/visible form is genuinely what's being checked — and then
foreground the tab with `computer` first.

**Corollary.** A 4s auto-dismissing toast (toast.tsx's default `duration`) is
usually gone before the next tool call returns, so it cannot be caught by
screenshot or by polling across calls. Capture it with a MutationObserver —
callbacks are driven by DOM changes, not timers, so background throttling can't
suppress them — and read the result afterwards.

### A NUL byte in a source file makes git show no diff for it

**Symptom.** `git diff lib/ai/generate.ts` reported
`Bin 10818 -> 11558 bytes` and not a single line of change, so the file's
edits would have been invisible to a reviewer. Earlier the same file had
silently returned nothing from `grep` — including `grep -c ""` — and `file`
called it `data` rather than text.

**Cause.** `STREAM_ERROR_MARKER` (and now `STREAM_DONE_MARKER`) deliberately
contain NUL bytes, chosen so no model output could ever collide with them. A
single NUL is enough for git, grep and `file` to classify the *entire* file as
binary. The file is valid UTF-8 and compiles fine; only the tooling's
heuristic is affected. This predates the branch that noticed it — the first
marker already had NULs.

**Rule.** A file that intentionally contains control bytes needs
`path/to/file diff` in `.gitattributes`, or its changes never appear in a
diff or a review. Reach for `grep -a` on it too. If a source file ever seems
to return nothing from grep, check `file` on it before assuming the search was
wrong.

## A streaming route's framing and its persistence are two tees, and they must agree

**Symptom.** A regenerate could blank the post on screen while the DB kept the
old text; a reload silently restored it. Separately, navigating away right
after Regenerate quietly threw the generation away.

**Cause.** `app/api/regenerate-post/route.ts` reads `result.fullStream` for
framing while `streamPost`'s `onEnd` persists — two independent tees off one
stream. Three ways they disagreed:

- *Different predicates for "is this text".* Framing used
  `part.text.length > 0`, persistence used `end.content.trim()`. A
  whitespace-only completion satisfied one and not the other.
- *The success marker outran the write.* STREAM_DONE_MARKER was enqueued in
  the framing tee's `finally`; the update ran on the other tee. DONE therefore
  meant "the stream ended", which is not what the client reads it as.
- *The client aborting kills persistence.* A client disconnect aborts the
  request the handler is running in, so onEnd sees `ok: false` and saves
  nothing. Aborting on unmount to avoid setState-after-unmount destroyed
  finished work to solve a problem a flag solves.

**Rule.** If one tee frames the response and another does the writing, the
framing tee must *wait on* the writing tee's outcome before claiming success —
a promise settled on every path through the callback, including its throw, with
a timeout backstop so a callback that never fires can't hold the response open.
Keep both tees' "did we get real content" test byte-identical. And never abort
an in-flight request just to silence setState-after-unmount: use a cancelled
flag and let the read loop run out, or the server stops persisting the work the
user already paid for.

## A correct aggregator over the wrong input set reads as a broken feature

**Symptom.** The dashboard's "What you're posting about" reported Try out at
"0 posts • 0%" for a project holding 14 try-out posts, while the LinkedIn bar
beside it counted fine.

**Cause.** `platformSplit()` was right — it partitions on `isTryout` before
platform, and its tests pin exactly that. The bug was one level up, in what it
was handed: `dashboard-view.tsx` passed `monthPosts`, a **scheduled-only** set
(it exists for the month calendar, which has nothing to draw for a post with no
date). And try-out posts are normally dateless — the usual Try out path is a
number-based generation, which schedules nothing. So the class of post the row
exists to count was filtered out before the counting started, and no test of
the counter could ever catch it.

**Rule.** When a derived figure reads as zero, check the set before checking
the derivation — a filter applied upstream for a *different* consumer's needs
is invisible at the point the number is computed, and passes every unit test
the computation has. Where a set is reused across consumers, name it for what
it *contains* (`monthPosts` = scheduled in this month) rather than for the
month it belongs to, and give a consumer with different needs its own set
(`postsInMonth`, which takes a dateless post by its creation date). The wider
tell: any code path keyed on `scheduled_for` silently excludes every draft, and
try-out posts are usually drafts. Usually, not always — calendar-based
generation carries whatever the account pill was on, so a dated try-out post is
reachable. `postsInMonth` handles both halves rather than relying on that.

## A `javascript_tool` eval can't observe a page whose commit rides a ViewTransition

**Symptom.** Verifying the generation chrome-lock: `hasStop: true` (so a run
was demonstrably in flight and rendered) while the store read `locked: false`
and the sidebar carried none of its lock classes. Every eval agreed, across
several full page loads, and a `console.log` in the writing effect produced
nothing — the picture of an effect that simply never runs. Screenshots of the
same page, in the same state, showed the lock plainly applied.

**Cause.** The generating page is wrapped in React's `<ViewTransition
enter="blur-in">`, and **every `javascript_tool` eval backgrounds the tab**
(already documented above for animations). A hidden document can't run a view
transition, so the commit that the transition gates — and the effects that
follow it — sits pending for as long as the tab stays hidden. The eval then
reports a tree that has rendered but not committed: real DOM from an earlier
paint, none of the state the pending commit would have produced.

**Rule.** On any route wrapped in `ViewTransition`, evals are not a source of
truth about post-commit state (effects, external stores, class flips). Verify
those with `computer` screenshots, which foreground the tab. And treat "the
effect never ran" as a claim needing a foregrounded check before acting on it —
here it sent me instrumenting the store, then hunting a stale-bundle theory,
before a plain screenshot showed the feature working the whole time. A visible
one-off probe string rendered by the component under test is the cheap way to
tell a stale bundle from a stalled commit.

## Stamping a time onto a date walk breaks the walk's own end comparison

**Symptom.** (Caught in review, not in the wild — but it would have shipped as
"the last day of my range never gets a post", intermittently: only for
afternoon and evening times, never for midnight or morning.)

**Cause.** The Generate page's date-range walk pushed `cursor` while `cursor
<= dailyRange.to`. Both sides used to be local midnight, so the comparison was
really "same calendar day or earlier". Once the cursor carries a picked time
of day, `Aug 20 19:03` is genuinely greater than `Aug 20 00:00`, so the loop
exits one day early. Nothing about the code changed — only the *precision* of
one side of a comparison that had silently been a date comparison all along.

**Rule.** A `Date` in this codebase is either a calendar day (local midnight)
or an instant, and the two must never be compared with `<`/`<=`/`===`. When
adding a time to something that used to be date-only, grep for every
comparison and every `getTime()` on it. Build a fresh local-midnight `Date`
for the boundary (`new Date(d.getFullYear(), d.getMonth(), d.getDate())`) and
compare against that, or compare the day parts directly. The same trap sits
under `lib/content-grouping.ts`, which is safe only because it reads local
date *parts* rather than comparing timestamps — which is now load-bearing
rather than incidental.
## A backgrounded tab hides CSS transitions too, not just rAF animations

**Symptom:** verifying the Profile disclosure's open/close, no
`transitionrun`/`transitionstart`/`transitionend` ever fired on the animated
element; `element.getAnimations()` returned `[]` immediately after a click that
demonstrably changed the state; and injecting a `transition-duration: 3000ms
!important` override still produced a fully-settled screenshot.

**Cause:** every `javascript_tool` eval backgrounds the tab (already noted in
AGENTS.md for Motion/rAF animations, which freeze at their initial frame). The
same suspension applies to *CSS transitions* — they complete without dispatching
their events while hidden, so any listener installed by an eval has nothing to
catch by the time the next eval reads it.

**Rule:** through this automation path you can verify a transition's
*declarations* (`transition-property`, duration, timing function, delay) and its
two *settled* states, and that's it. Don't claim to have watched a transition
play. If the interpolation itself is genuinely in doubt, that needs a real pair
of eyes or a screen recording, not another eval.

## A debounce is not a save queue, and a per-segment wrap is not a clock

Two from the same review, both cases of local correctness that isn't correct in
the whole.

**The stepper.** `time-field.tsx` wrapped the hour inside 1-12 with modular
arithmetic. Read alone that function is right: it wraps, it never goes out of
range. But the hour is half of a value whose other half — the meridiem — lives
in a sibling control, so 11 AM + 1 came out as 12 AM: midnight, eleven hours
backwards. The conversion function beside it (`to24Hour`) handles exactly this
pair and says so in its own comment, and is exhaustively tested. The stepper
had no tests, because it looked too simple to need any.

**Rule.** When a value is split across two controls, stepping *one* of them is
arithmetic on the whole value, not on the field. Convert to the canonical form
(here 24-hour), do the arithmetic there, convert back — and put it in the
module that owns the type, where the existing round-trip tests can reach it.
A range that "can't go out of range" is not the same as a range that is right.

**The debounce.** The same branch debounced its time writes at 300ms and
described that as removing the ordering hazard `useSaveQueue` exists for. It
doesn't. A debounce collapses a *burst* into one call; it says nothing about
two calls separated by more than its own window. Nudge the hour, pause 400ms,
tap AM/PM, and two writes race on one row — and the loser is whichever response
arrives second, not whichever was sent second.

**Rule.** Debounce answers "how many requests", a queue answers "in what
order". They are not substitutes, and a fix for one is not evidence about the
other. If out-of-order responses would persist stale data, only the queue
helps.

## Never redirect a Server Action to the login page

**Symptom.** Log out spun forever and never signed anyone out, while a page
refresh redirected to login as though it had. The only thing in the server log
was `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`.

**Cause.** A Server Action is a `POST` to the page's own URL, so route-level
auth middleware sees it exactly like a navigation. Redirecting it produces a
307 that the browser's action `fetch` follows **with the `Next-Action` header
still attached**, which Next answers with a plain `404 text/plain`. React
can't read that as an action result, so the action promise never settles — the
pending flag stays set and the action itself never ran.

**Rule.** Middleware may only redirect *navigations* — gate the redirect on
`request.method === "GET"`. A signed-out POST is let through and answered by
the thing that actually enforces access (RLS, and each action's own user
check). This matters most for the actions that exist to *fix* a broken session:
bouncing sign-out to the login screen makes the one thing that would have
cleared the bad token unreachable.

**Corollary, on reading a stack trace.** The logged `AuthApiError` was a
symptom, not the failure: every auth-js path in that trace returns the error,
and the print was auth-js's own `console.error` in a catch that then continues.
Resolve minified frames against the built chunk and check whether the throw is
even on the path you're debugging before treating a logged error as the cause.

**Corollary, on pending flags.** `void action()` on a redirecting action leaves
no way to clear its pending state when the action fails. A redirecting Server
Action *resolves* on the client (the router takes the navigation off the
response), so a `.catch` there is unambiguously a real failure — clear the flag
and say so.

## A Server Action must never redirect at a redirect

**Symptom.** `logout()` signed the user out and then rejected with
"An unexpected response was received from the server" — no navigation, and
only a manual refresh showed the login screen.

**Cause.** `redirect()` in a Server Action doesn't just set a header: Next
renders the redirect target into the action's own response (to save the client
a round-trip) and copies *that render's* headers onto it. `location` is not on
its forbidden list — only `content-length` and `set-cookie` are — so when the
target is itself a redirect (`/login` → `/signup?view=login`), the action
answers `303` **with** a `Location`. The client's action `fetch` uses the
default `redirect: "follow"`, so the browser follows it before React ever sees
the response, and the reducer throws on the HTML page that comes back.

**Rule.** Server Actions redirect to real pages only. Redirect stubs
(`/login`, `/forgot-password` here) are for navigations — a `<Link>`, an
address bar, middleware. Keep the real URL in one place both can import
(`lib/auth-routes.ts`) so the stub and the action can't drift.

**How to see it without a browser.** A server action can be invoked with curl:
its id is in `.next/server/server-reference-manifest.json`, keyed by the routes
that contain it. `POST` it with `Next-Action: <id>` and a JSON `[]` body, and
read the response headers — a healthy action redirect is a `303` carrying
`x-action-redirect` and `content-type: text/x-component` and **no** `location`.

## AI Gateway BYOK

**Symptom.** Adding a user's own Anthropic key failed with "That key didn't
work with Anthropic. Check you copied all of it and that it's still active."
The account behind the key did have no balance, which made the message look
roughly right — it wasn't.

**Cause, two layers.**

1. **BYOK on the Vercel AI Gateway requires paid credits on the *gateway*
   account** (ours, the operator's — not the end user's). Without them every
   BYOK request fails, whatever the user's provider key is:
   `403 GatewayInternalServerError: "Bring Your Own Key (BYOK) is available
   only with paid credits."` Listing the catalog is free, so the modal loads
   fine and the wall only appears at the verification step, which is what makes
   it read as a key problem.
2. **Gateway errors are not `APICallError`.** They surface as
   `GatewayInternalServerError` (and siblings), carrying `statusCode` and
   `message` but failing `APICallError.isInstance`. So a classifier gated on
   that instance check matches *nothing* and every failure falls through to
   whatever the generic branch says — which is how one catch-all message ended
   up blaming the key for an operator billing problem.

**Rule.** Classify provider/gateway failures by **duck-typed `statusCode` +
message text**, never by `APICallError.isInstance` alone — see
`verifyFailureCopy` in settings/model-actions.ts. And order the branches so the
BYOK-needs-credits case is checked *before* the generic 401/403 one, since it
is itself a 403. Related: `classifyGenerationError` (lib/ai/generate.ts) has
the same instance-check assumption and will mis-bucket gateway errors as
"unknown" — untouched here, but it is the same trap.

**Also worth knowing:** the built-in Gemini model is unaffected by any of this.
It calls `google()` on `GOOGLE_GENERATIVE_AI_API_KEY` directly and never routes
through the gateway.

### A free-tier model makes a fake BYOK key look valid

**Symptom.** Adding `anthropic/claude-3-haiku` with a personal Anthropic key
succeeded; every other Anthropic model failed. Read as "that one model works" —
it isn't.

**Cause.** Haiku is in the gateway's **free tier**, and for a free-tier-eligible
model the gateway serves the request on *its own* account and ignores the BYOK
credential entirely. Proven with a syntactically fake key, same key both calls:

- `anthropic/claude-3-haiku` → `GatewayRateLimitError: "Free tier requests on
  this model are rate-limited"` — i.e. accepted, then rate-limited. Never an
  auth error, because the key was never used.
- `anthropic/claude-sonnet-5` → `"Bring Your Own Key (BYOK) is available only
  with paid credits"` — not free-tier, so the real BYOK path is reached.

`verifyProviderKey` only asked `didFallBackOffByok`, which answers "is there
positive evidence of a fallback" and says *no* when it can't tell. So the
free-tier run passed and a key that had never been exercised got saved.

**Rule.** **Add-time verification must fail closed; post-generation checks fail
open.** The asymmetry is the whole point: saving an unexercised key means every
later generation quietly bills *us*, whereas flagging a working model on one
flaky lookup is a lesser harm. `confirmedRanOnByok` (lib/ai/generate.ts)
requires `isByok === true` and is what add-time uses;
`didFallBackOffByok` keeps its lenient contract for the post-generation path.
Corollary: "the request succeeded" is never evidence a BYOK key works.

## JSX

### An interior space next to an expression can vanish across a line break

**Symptom.** `Anthropic key ending ***TwAA` rendered as **"Anthropickey ending
***TwAA"** — one space, silently gone. The source looked correct:

```jsx
<p>
  {providerDisplayName(model.providerSlug)} key ending &bull;&bull;&bull;
  {model.keyLastFour}
</p>
```

**Cause.** JSX text is normalised line by line, and a literal that begins right
after an expression but whose node spans multiple lines loses that leading
space. Reading the source doesn't reveal it — the space is plainly there on the
line — so this only shows up in the rendered output.

**Rule.** When interpolating into a sentence, build the whole string in one
expression (`` {`${name} key ending ***${last4}`} ``) rather than alternating
JSX text and `{}`. It's immune to the whitespace rules, and it reads as the
sentence it is. `{" "}` also works but is easy to drop in a later edit. Check
`textContent` in the DOM, not the source, when spacing looks wrong.

### `supportedGenerationMethods` is not a modality filter

**Symptom.** Google's provider list offered image, music, speech and
transcription models as things you could write posts with.

**Cause.** The filter was `supportedGenerationMethods.includes("generateContent")`,
described in an earlier commit as "an exact capability check rather than id
heuristics". That was wrong. The field names the *method* the model is called
through, not what it emits — Gemini's image, TTS, transcribe and Lyria music
models all list `generateContent` too.

**And the ids don't rescue it.** A modality-word blocklist gets most of them,
but `nano-banana-pro-preview` is image generation and `lyria-3-*` is music;
neither says so in its name. Only checking against the live catalog surfaced
those two — 39 models list `generateContent`, and just 20 can write a post.

**Rule.** Treat a provider's capability metadata as necessary, not sufficient.
Every provider here needs a maintained blocklist (`GOOGLE_NON_WRITING`,
`OPENAI_NON_TEXT`, `GROQ_NON_TEXT`), each pinned by tests against real catalog
ids, and each re-checked against the live list rather than reasoned about — the
names that trip it are exactly the ones you wouldn't predict.

### `autoComplete="off"` does not stop password managers

**Symptom.** Opening the Add-a-model dialog in Dia autofilled the user's email
into the **Provider** field and a saved password into the **API key** field,
even though the key field already had `autoComplete="off"`.

**Cause.** Two parts. The dialog's shape — a text input immediately followed by
a `type="password"` input — is precisely the heuristic browsers use to detect a
login form. And **Chromium deliberately ignores `autocomplete="off"` on
password fields**, because sites misused it widely enough that honouring it hurt
users more than it helped.

**Rule.** For a password-typed field that is *not* a credential (an API key, a
token, a secret to store rather than sign in with):
`autoComplete="new-password"` — the documented "don't fill this" signal that
Chromium does respect — plus `data-1p-ignore` / `data-lpignore` /
`data-bwignore` for 1Password, LastPass and Bitwarden, which run their own
heuristics regardless of the browser. Give the **text field beside it** the same
treatment: it's the other half of the pair the heuristic matches on, and it's
what receives the email. Also avoid `name`/`id` values like `username`,
`email` or `password` on such fields.
---

## The LinkedIn connect flow only works on the port registered with LinkedIn

**Symptom.** Clicking Connect from a worktree's dev server lands on LinkedIn's
own error page: "Bummer, something went wrong. **The redirect_uri does not
match the registered value**". Nothing in this app's logs shows a failure — the
request never reaches the callback, so there is no `connect_error` code and no
toast either.

**Cause.** `getLinkedInConfig` (lib/linkedin/oauth.ts) derives the redirect URI
from the *request's own origin*, which is deliberate — it keeps localhost,
previews and production working with no per-environment config. But LinkedIn
matches `redirect_uri` against an exact allow-list registered on the app, and
only `http://localhost:3000/api/connections/linkedin/callback` is on it. A
worktree serves on 3001, 3002, … so its origin produces a URI LinkedIn has
never seen.

**Rule.** **Do the OAuth connect/reconnect leg on :3000** (the main checkout),
whatever port you're developing on. Every worktree shares one database, so a
row created from :3000 is immediately visible to the branch you're working on —
and the state cookie is host-only (cookies ignore port), so the two legs can
even straddle ports if you pin `LINKEDIN_REDIRECT_URI`. Adding each worktree
port to the LinkedIn app's registered list would also work, and is worth doing
if this keeps biting.

**What is *not* affected.** Only the browser-redirect legs care about the port.
Everything server-to-server — the token exchange, `/v2/userinfo`, the liveness
check, revoke — is a plain `fetch` from the Node process and works identically
on any port. That's why the revocation check verified fine on :3002 and only
Connect failed.

## Bundles

### A module-scope side effect defeats tree-shaking, and no gate can see it

**Symptom.** `.next/static/chunks` went 3.7 MB → 6.9 MB, with a 1.07 MB chunk on
four routes, containing `dangerouslyAllowBrowser`, `anthropic-version`,
`x-api-key` and `api.groq.com`. No API key shipped — but four provider SDKs did.

**Cause.** `lib/ai/providers.ts` builds its provider objects at module scope, so
importing *anything* from a module that reaches it pulls the whole graph.
`lib/ai/generate.ts` imports it for `modelFor`, and five client components
imported a single constant — one string each — from `generate.ts`.

**The part worth internalising: tsc, eslint, vitest and `next build` were all
green the entire time.** Nothing in the standard gate set observes a bundle
boundary. It took diffing built output between branches to see it, which is why
it reached review rather than being caught locally.

**Rule.** Constants a client component needs live in a module that imports
nothing (`lib/ai/model-constants.ts`), and the module holding server-only
machinery never re-exports them — a convenient re-export is just the trap with a
shorter path back. Assert the boundary in a test that reads source
(`lib/ai/no-client-sdk.test.ts`), since the build won't. And when a change could
plausibly move bundle weight, `du -sh .next/static/chunks` plus a grep for
vendor-specific strings is the only gate that actually checks.

### A host allowlist checked before `redirect: "follow"` checks nothing

**Symptom.** `fetch-url.ts` refused `http://169.254.169.254/` when typed
directly, but happily fetched and inlined it when a public URL redirected there.

**Cause.** The guard ran once, against the URL the user supplied; `fetch` then
followed the chain itself. The final hop — the only one that matters — was never
tested. No DNS control required, just a 302.

**Rule.** A per-host check is only worth as much as the number of hops it sees.
Use `redirect: "manual"` and re-run the check on every `Location` before
fetching it, with a hop cap and one deadline across the chain. And keep the
comment honest about scope: "this isn't an SSRF defence" invited exactly the
bypass above, because it implied partial protection where there was none.

### A private-address guard that only knows the IPv4 spellings

**Symptom.** `fetch-url.ts`'s `PRIVATE_HOST` regex blocked
`169.254.169.254`, `localhost` and `[::1]`, so it read as a working guard. Run
against the other literal spellings of the same addresses, it allowed every one:

```
ALLOWED  [fd00:ec2::254]      EC2's IPv6 instance-metadata address
ALLOWED  localhost.           legal FQDN spelling, still resolves to 127.0.0.1
ALLOWED  [::ffff:a9fe:a9fe]   v4-mapped 169.254.169.254
ALLOWED  [fe80::1]  [::]  100.64.0.1
```

**Cause.** One regex, written from the IPv4 forms outward. Three things it could
not see: an IPv6 literal arrives from URL parsing with its brackets attached and
was never anchored for; `^localhost$` misses a trailing dot; and an IPv4 address
can be *embedded* in an IPv6 literal, dotted or as the final two hextets, which
no amount of IPv4 prefix matching will catch. It shipped in a branch whose
redirect handling was itself a fix for the previous version of this guard — the
mechanism was reworked correctly and the predicate it called was left alone.

**Rule.** A range check is a predicate with a table of literals behind it, not a
regex. Cover both families and the bridges between them: IPv4 prefixes, IPv6
`::`/`::1`/`fc00::/7`/`fe80::/10`, and v4-mapped forms tested as the IPv4
address they actually reach. Normalize first (lowercase, strip a trailing dot,
strip brackets), and pad the first hextet to four digits before comparing it —
`fd00::1` is unique-local and `fd::1` is not, and the written prefix alone
cannot tell them apart. Test the predicate directly against a table of
spellings; a stubbed-fetch test only ever proves the one spelling you thought of.

### "Published" derived from the clock cannot report a failure

**Symptom.** The Content page's Published tab and the dashboard's Posted count
both showed 76 posts. Nothing had ever been published — the app has never called
a share endpoint. Both figures were also identical for LinkedIn and X, because
neither consulted `platform` at all.

**Cause.** `belongsToTab` said published meant `scheduledFor < now`. That is a
statement about the calendar, not about the post: it cannot distinguish "went
out" from "the date arrived and nothing happened". `posts.status` had a
`'published'` value, but the only line writing it had no callers, so
`dashboard-summary.ts` deliberately ignored the column and derived from dates
too — two files agreeing on the same wrong answer, which is why it read as
settled rather than as a placeholder.

**Rule.** A state the outside world decides has to be *recorded*, not inferred
from a schedule. The schedule is an intention; the provider's confirmation is
the fact. Store the confirmation (`published_at`) with the provider's own id for
what it became, constrain the pair so one cannot exist without the other, and
have every tab, count and chip read that. What the clock can still tell you is
that an intention has gone unmet — which is a different state (`isOverdue`),
worth showing, and not the same as success.

**Corollary.** When two files answer the same question with the same derivation,
that is not corroboration — it is one rule copied twice, and it will drift the
first time either side changes. `totalsByState` now calls `belongsToTab` rather
than restating it, and grouping and sorting inside a tab now read one shared
`groupingTimestamp`; they had already drifted, so Published grouped by the day a
post went out while ordering the cards inside that day by when it was due.

## OAuth: "any 4xx means the token is dead" disconnects rate-limited users

**Symptom:** a refresh that came back 429 marked the connection `revoked`,
which in the UI is unrecoverable without the member reconnecting.

**Cause:** the revoked/unavailable split was written as
`status >= 400 && status < 500`. 429 sits inside that range and is not a verdict
on the grant at all — it means "ask again later". The same reasoning catches 408.

**Rule:** only **400 and 401** mean a grant is dead. Everything else — 429, any
5xx, a dropped connection — is "couldn't tell", and must leave the row alone for
the next attempt. This is the same fail-open principle as `verifyLinkedInToken`
and `didFallBackOffByok`: killing a working connection on an ambiguous answer is
worse than noticing a dead one late. It matters more on X than on LinkedIn,
because the Free tier's rate budget is shared across every user of the app, so
429 is an ordinary occurrence rather than an anomaly.

**Also:** don't branch on the provider's error *string*. X answers a spent
refresh token with `invalid_request` and "Value passed for the token was
invalid", not the `invalid_grant` the OAuth spec would suggest — so matching on
text is both wrong today and fragile tomorrow. Branch on the status.

## X's refresh tokens are single-use, which makes concurrency a data-loss bug

**Symptom (anticipated, guarded before it shipped):** two requests that both
read the same stored refresh token each spend it. X invalidates the old token
the moment it issues a replacement, so one request wins and the other gets a
rejection indistinguishable from revocation — and whichever replacement lands
second overwrites a live token with a dead one.

**Rule:** anything that rotates a single-use credential needs (a) a claim so
only one request rotates at a time — `social_accounts.refresh_started_at`, the
same shape as `posts.publish_started_at` — and (b) the persist ordered *before*
the new credential is handed to a caller, since a crash in that window leaves a
row holding a token that can never be redeemed. The loser of the claim waits and
re-reads rather than failing: the winner communicates its result through the row.

A compare-and-swap on the stored value can't substitute for the claim here, for
two reasons: it only detects the collision after both requests have already
spent the token, and the values are AES-GCM ciphertexts with random IVs, so the
same token never encrypts to the same bytes twice.

## X's developer console rejects `localhost`, which forces 127.0.0.1 end to end

**Symptom:** "Not a valid URL format" when registering the app.

**Cause:** two different fields, two different rules. The **Website URL** field
wants a real public URL and rejects localhost in any form (it plays no part in
the OAuth flow — any valid URL does). The **callback** field rejects the
hostname `localhost` specifically, and accepts the loopback IP.

**Rule:** register callbacks as `http://127.0.0.1:<port>/...`, **and browse the
dev app at 127.0.0.1 too**. Pinning `X_REDIRECT_URI` to the IP form while
browsing on localhost looks like it should work and doesn't: `localhost` and
`127.0.0.1` are distinct cookie origins, so the OAuth state cookie set when the
flow started is not sent to the callback, and the flow dies at the state check
with an error that says nothing about hostnames. Note the Supabase session
cookie is per-origin too, so signing in again on 127.0.0.1 is expected.

## `request.nextUrl.origin` lies in development — it is always `localhost`

**Symptom:** an OAuth `redirect_uri` derived from `request.nextUrl.origin` came
out as `http://localhost:3003` even when the browser had requested
`http://127.0.0.1:3003`. X only accepts a redirect_uri that matches a registered
one byte for byte, and its console cannot register the hostname `localhost` at
all — so every connect attempt would have been rejected by X, with an error that
says nothing about hostnames.

**Cause:** in development Next pins `nextUrl.origin` to `http://localhost:<port>`
regardless of the host requested. Verified with a probe route: a request to
127.0.0.1:3003 reports `host: "127.0.0.1:3003"`,
`x-forwarded-host: "127.0.0.1:3003"`, and `nextUrl.origin:
"http://localhost:3003"`.

**Rule:** when a URL has to match what the *browser* used — OAuth redirect URIs,
anything paired with a cookie set on that origin — read the `Host` header, not
`nextUrl.origin`. But the Host header is client-controlled, so building a
redirect off an arbitrary one is an open-redirect vector: trust it **only when
it names a loopback address** (`resolveRequestOrigin` in lib/x/oauth.ts), where
a forged value can point the victim nowhere but their own machine. Everywhere
else `nextUrl.origin` stands.

Note LinkedIn's routes have the same latent issue and are unaffected only
because `localhost` is what its app has registered. Left alone deliberately —
see FOLLOWUPS.md.

## Next blocks dev assets on 127.0.0.1, and the page *renders* — it just doesn't work

**Symptom:** the app on `http://127.0.0.1:3003` looked broken in ways that
resembled several separate bugs: the segmented control had no pill, clicking it
did nothing (a click on "Login" fell through to the default and landed on
"Create account"), and the branded gradient artwork, wordmark and dev toolbars
were all missing. The same URL on `localhost:3003` — *the same server* — was
perfect. No console errors at all, and React itself was loading.

**Cause:** Next blocks cross-origin requests to dev-only assets and endpoints by
default, allowing only the hostname the dev server was initialised with, which
is `localhost`. `127.0.0.1` is a different origin by that rule, so its client
chunks and images were refused — silently. The server HTML still rendered, which
is what makes this so misleading: it looks like a styling or hydration bug rather
than a transport one, and the absence of console errors argues against exactly
the right answer.

**Rule:** `allowedDevOrigins: ["127.0.0.1"]` in next.config.ts. It is needed here
specifically because X's console will not register an OAuth callback on the
hostname `localhost`, so the loopback IP is the only address the connect flow can
be exercised at. Development only — no effect on a production build.

**Diagnostic worth reusing:** load the same path on both spellings of loopback
and compare. One origin rendering fully and the other not is conclusive, and it
takes seconds; chasing the individual symptoms (a pill that doesn't draw, a
click that does the wrong thing) leads away from the cause, since each looks like
a plausible component bug on its own.

## A stash round-trip poisons a running dev server's config

**Symptom:** the app on 127.0.0.1 went dead again — no segmented-control pill,
clicks doing nothing — with `next.config.ts` on disk still perfectly correct.

**Cause:** stashing the branch to check whether a lint error was pre-existing
reverted `next.config.ts` for a few seconds, which dropped
`allowedDevOrigins: ["127.0.0.1"]`. The dev server was running throughout,
re-read the config during that window, and **kept the reverted version in
memory** after `git stash apply` restored the file. Reading the file proves
nothing here; the running process is what matters.

**Rule:** if a dev server is running, restart it after any operation that
briefly rewrites config on disk — `git stash`, `git checkout`, a bisect, a
worktree switch. And when a "it broke again" symptom exactly matches a bug you
already fixed, check whether the *process* has the fix before re-debugging the
code: the file having the line and the server having read it are different
facts.

Better still, do the baseline comparison without touching the working tree:
`git show main:path/to/file > /tmp/x && npx eslint --no-ignore /tmp/x`, which is
what should have been used here.

## A function that returns a "bad" value on purpose needs a second name

**Symptom:** a "Skip to …" button performed the exact account switch the dialog
it lived in had just refused. Only reachable when *every* alternative position
was refused.

**Cause:** `nextPostAccount` returns the refused target in that case on purpose
— the pill has to stay live and explain itself rather than silently do nothing —
and its own comment says so. But every call site that needed "somewhere this
post may actually go" used it anyway, and documented the opposite. One function
was answering two different questions, and the dangerous answer was the
non-obvious one.

**Rule:** when a function deliberately returns something a caller must not act
on, that is a second question, not a flag on the first. Give it its own name
(`nextAllowedPostAccount`) so a call site cannot pick the wrong contract by
accident, and pin the divergence with a test asserting the two disagree in
exactly the case that matters. A comment on the returning side does not travel
to the calling side — this one was correct, detailed, and still didn't stop the
bug.

## Release a lock in `finally`, not on every path out

**Symptom:** one early return inside a claimed region skipped `releaseClaim`,
which permanently wedged an X connection — every later refresh found a claim
nothing would ever release and sat out its timeout.

**Cause:** the claim was released by hand on each exit, under a comment saying
"must be released on every path out". Three of four did. The missed one was an
early return added later than the comment.

**Rule:** a comment asking future code to remember something is a defect
waiting to happen; make the structure do it. `try/finally` releases on paths
that do not exist yet. Where an exit already writes the release as part of
another update, a flag skipping the redundant round trip is fine — that is an
optimisation on top of a guarantee, not a replacement for one.

### Two constants that must be ordered, set independently

**Symptom.** The scheduler could publish the same post twice to a real
LinkedIn timeline. Every gate was green and the claim-inside-the-update — the
thing built specifically to prevent double-posting — was correct.

**Cause.** Two constants in different files: `CLAIM_TIMEOUT_MS` (5 minutes,
`lib/publish-runner.ts`) and `PUBLISH_GRACE_MINUTES` (15, `lib/publish-due.ts`).
A claim went stale ten minutes *before* its post aged out of the due window, so
there was a ten-minute band where a post was both re-claimable and still
selectable. Add an unchecked write — the success `update` had no `const { error }`
— and the row could keep `published_at: null` after LinkedIn had accepted,
which is indistinguishable from never having been sent.

Neither half is a bug alone. A stale-claim window is correct (a crash must not
strand a post forever); an unchecked write is merely sloppy. Together they are a
duplicate post on someone's real timeline.

**Rule.** When two constants must hold an ordering, derive one from the other
rather than setting both and trusting a comment. `CLAIM_TIMEOUT_MS` is now
`(PUBLISH_GRACE_MINUTES + 1) * 60 * 1000` — the `+ 1` makes the ordering strict,
so the last tick that can *see* a post is never the tick that can *re-claim* it.
Two independent numbers can drift back into overlap silently; a derived one
cannot.

**Corollary, and the more general lesson.** Ask what happens when a write fails
*after* an irreversible side effect has already succeeded. That is not an error
path, it is a distinct state — "it happened and we failed to write it down" —
and it needs its own outcome (`record_failed`), its own message, and above all
must never be retried. The claim is deliberately *left held* there: an
unreleased claim delays one post, while a released one publishes it twice.
Prefer the failure you can undo.

**Testing note.** Both halves were verified by reintroducing each regression
separately and confirming the new tests fail — 2 failures for the unchecked
write, 1 for the shortened claim. A test written against a fix, never run
against the bug, is a test that proves nothing.

### A lease is not a lock

**Symptom.** A fix for a double-publish bug reintroduced the same bug, one code
path over, while its own tests passed.

**Cause.** The fix left a claim held on a post that was live but unrecorded, and
its comment said the claim was "deliberately left held". It was not held — it
was *leased*. The claim predicate re-grants any claim older than
`CLAIM_TIMEOUT_MS`, so the block expired after sixteen minutes. The scheduler
never noticed, because a post that old has left its due window; the manual
"Publish now" button has no such window and would happily re-send.

**Rule.** Before relying on a mechanism to block something, check what *lifts*
it. A stale-claim window exists precisely so a crashed publish does not strand a
post forever — which means it is designed to expire, and cannot also be the
thing that makes a block permanent. Those are opposite requirements and one
value cannot serve both. The durable block is a written marker with no expiry
(`publish_error: "record_failed:<urn>"`, excluded by the claim predicate); the
lease still covers the gap before that marker is attempted.

**Corollary.** When a guard exists on two paths, fixing one and calling it done
is the default failure. Both publish handlers needed the same `try/finally`;
both writes in the same function needed the same error check. After fixing an
instance, grep for the shape rather than the symptom.

### A PostgREST `not.like` on a nullable column excludes every NULL row

**Symptom.** A one-line predicate added to stop a specific post being re-claimed
instead stopped *every* post being claimed. Publishing died completely and
silently, reporting "That post is already being published" for every post,
through both the button and the scheduler. tsc, eslint, 358 tests and the build
were all green.

**Cause.** `.not("publish_error", "like", "record_failed:%")` renders as a bare
`NOT (col LIKE …)`, and in SQL that evaluates to NULL — not true — when the
column is NULL. `publish_error` is NULL on every post that has never failed,
which is essentially all of them. Measured against the live database: the bare
form matched **0 of 311** rows; the null-safe form matched all 311.

It was also self-sealing. `publish_error` is only ever written from inside the
same function whose claim now failed, so no post could ever reach a state that
made it claimable again.

**Rule.** Any negative filter on a nullable column must spell out the NULL case:

```ts
.or(`publish_error.is.null,publish_error.not.like.${PREFIX}*`)
```

Chained `.or()` calls AND together, so this composes with an existing one.

**The deeper lesson, and the reason this shipped past a review.** The test suite
could not catch it *by construction*: `lib/publish-runner.test.ts` uses a
hand-rolled Supabase fake that re-implements predicates in JavaScript, where
`String(null ?? "").startsWith(…)` is false and the claim is therefore granted —
the opposite of what the database does. **A fake proves your code calls the
query you meant; it can never prove the query means what you think.** Where the
two can differ, either assert on the predicate as written (which is what the new
`the claim predicate is null-safe` test does) or check it against a real
database. This one was found by running both forms against live PostgREST.

### An optional field silently dropped at a boundary type-checks perfectly

**Symptom.** A fix to make a `record_failed` post read as "published, not
recorded" worked in isolation and did nothing in the app. The card kept saying
"Didn't send" under a toast saying the post had published, and changed its story
on reload.

**Cause.** The helper was correct; the server action never passed it the field.
`publishErrorFor({ failure, publishedUrn? })` takes the URN as **optional**, so
an action that returned only `{ failure }` satisfied the type and lost the URN
in silence. The client then stored `"record_failed"` while the database held
`"record_failed:<urn>"`, and every reader that prefix-tests the marker
misclassified it.

**Rule.** When a value must survive a boundary — a server action's return, a
props hop, a serialization — an *optional* field is not a contract, it is a
suggestion. Either make it required on the shape that carries it, or pin the
agreement with a test that constructs what the producer really returns and
asserts the consumer's answer. A type that permits the bug will not report it.

**Corollary.** Fixing the display of a state is not fixing the state. Three
surfaces described this one post differently — the toast, the card, and the
still-enabled "Publish now" button — because each derived its answer from a
different field. Once a state exists, find every reader before declaring it
handled.

### LinkedIn and X cannot be connected from the same dev origin

**Symptom.** With the X flow working on `http://127.0.0.1:3000`, LinkedIn's
connect button fails at the state check. Browse at `http://localhost:3000`
instead and LinkedIn works while X is rejected by X with a redirect_uri
mismatch. Neither is broken; they cannot both work at once.

**Cause.** The two derive their `redirect_uri` differently, for a good reason
each:

- **X** must use `127.0.0.1`, because X's developer console *refuses to
  register a callback on the hostname `localhost` at all*. So `lib/x/oauth.ts`
  has `resolveRequestOrigin`, which prefers the `Host` header (restricted to
  loopback, or it would be an open-redirect vector) over `nextUrl.origin` —
  because **Next pins `request.nextUrl.origin` to `http://localhost:<port>` in
  development regardless of the host actually requested.**
- **LinkedIn** uses `request.nextUrl.origin` directly, so it always says
  `localhost`, which is what is registered on the LinkedIn app.

Both set an httpOnly `sameSite: lax` state cookie at authorize and read it at
the callback. `localhost` and `127.0.0.1` are **different cookie origins**, so a
flow that starts on one and returns to the other never sends its cookie and dies
at the state check. Supabase's auth cookies split the same way, so each origin
is a separate signed-in session.

**Rule.** In development, pick the origin for the provider being worked on:
`127.0.0.1:3000` for X, `localhost:3000` for LinkedIn. Pinning
`X_REDIRECT_URI`/`LINKEDIN_REDIRECT_URI` does not rescue this — the mismatch is
the *cookie* origin, not just the registered URI.

In production both are the same real hostname and the problem disappears, so
this is a dev-workflow trap rather than a product bug. Do not "fix" it by
teaching LinkedIn to follow the Host header: that would make the two agree, but
LinkedIn's registered callback is `localhost`, so agreeing on `127.0.0.1` would
break LinkedIn instead.

## A `backdrop-filter` seam lands wherever its own box ends, and a scroll container won't let it leave

**Symptom.** During the onboarding tour the blurred section reads as blurred
*and* razor-sharp along its own boundary at the same time: content near the
edge is mushy, then stops dead on a perfectly straight line.

**Cause.** `backdrop-filter` is clipped to the element's box. The onboarding
blur layer was `absolute inset-0` on a wrapper whose rect was byte-identical to
the content's (measured: both `536,120 1264×1034`), so the seam sat exactly on
the panel's edge — the one place a blur can't hide it, because the halo the
blur spreads outward has nowhere to land.

**The obvious fix fails silently in a scroll container.** Bleeding the layer
outward (`inset: -16px`) measured correctly — the box really did grow to
`520–1816` — and changed nothing on screen. The layer lived inside `<main>`,
and **`overflow-y: auto` forces `overflow-x` to `auto` as well** (an axis can't
stay `visible` once the other is a scrolling value), so the bleed was clipped
straight back to the box it existed to escape. Measuring the element's rect is
*not* evidence the bleed is visible; screenshot it.

**Rule.** A bled `backdrop-filter` layer has to be a sibling of the scroll
container, not a child of it. And bleeding alone isn't enough if the layer also
carries a tint: the tint then ends on a hard rectangle out on the flat canvas
(~1/255 here, still visible as a straight line — caught only by zooming a patch
of empty canvas). Mask the outer band over exactly the bled distance
(`mask-composite: intersect` for two axes) so the wash and the last of the blur
fall off together. Drive both the negative inset and the mask stops from one
constant.

**Corollary worth remembering:** the bleed distance is a layout budget, not a
free parameter — it's capped by the smallest gutter between the blurred region
and anything that must stay sharp. Here `dist-xl` (24px) to the sidebar allowed
`dist-lg` (16px), leaving 8px of clearance.

## A `max-w-full` chip shrinks instead of overflowing, so its row can never scroll

**Symptom.** Two reports that read as separate bugs: topic chips truncating on
the post card, and topic pills rendering *completely empty* on the day deck's
cards — while the same post's topics showed fine on its own page.

**Cause, one for both.** `components/ui/chip.tsx` carries `max-w-full` plus a
`truncate`d label. Inside a horizontally-scrolling row that is itself
`flex-1 min-w-0`, that cap is measured against the row — so when the row is
squeezed, the chip **shrinks to fit it** rather than overflowing. Nothing
overflows, so `scrollWidth === clientWidth`, so the row has nothing to scroll
and the scroll-fade never engages; the label just ellipsises down to nothing.
Measured on the deck's 272px card: 65px left for topics after the status chip
and account pill, chip rendered at 41px, scrollWidth equal to clientWidth. With
`max-w-none` the same chip is 161.6px and the row scrolls.

**Rule.** A chip in a scrolling row must hug its content (`max-w-none
shrink-0`). `max-w-full` only makes sense where the chip is expected to *fit* —
a wrapping list — and is actively harmful anywhere the row is meant to overflow.
An "empty pill" is the tell: the element is present at its padding-plus-border
width with the label squeezed to zero.

**Corollary for debugging:** if a scroll-fade "isn't working", check
`scrollWidth` against `clientWidth` before suspecting the fade. A fade that
never fires because nothing overflows looks identical to a broken hook.

## A programmatic `scrollLeft` from `javascript_tool` won't fire a scroll handler

**Symptom.** Setting `element.scrollLeft = 999` in an eval moved the element
(the value read back correctly, clamped to its max) but the scroll-driven mask
never updated — in that eval or in a later one. It looked exactly like
`useScrollFade`'s `onScroll` was not attached.

**Cause.** Chrome aligns scroll events to `requestAnimationFrame`, and **every
`javascript_tool` eval backgrounds the tab**, which suspends rAF. The scroll
happens; the event announcing it never gets dispatched.

**Rule.** Scroll-driven behaviour has to be exercised with `computer`'s `scroll`
(or a real drag), which foregrounds the tab — then measured. This is the same
trap already documented for Motion animations and `setInterval` under an eval,
one API wider than it was written: it isn't only rAF-driven *animation* that
freezes, it's anything the browser schedules on a frame, scroll events included.

### An OAuth callback is registered per port, and a worktree's port is assigned

**Symptom.** X's Reconnect button dies at `You weren't able to give access to
the App` before any consent screen. It reads exactly like asking for a scope the
app isn't permitted to grant — which was also the change being made at the time
(`tweet.write`, plus flipping the X app from Read to Read-and-write), so the
scope was the obvious and wrong suspect.

**Cause.** The redirect URI is derived from the request's own origin, so the
port the dev server happens to be on becomes part of it. `/branch` assigns each
worktree a free port from 3001 up; the X app's registered callbacks were added
by hand while earlier work ran on :3000 and :3003. A worktree on **:3002** sends
a `redirect_uri` that was never registered, and X refuses the authorize request
outright.

**Rule.** Isolate a provider-side rejection by **changing one variable at a
time against the provider itself**, not by reasoning about which change is more
recent. Hand-build the authorize URL and load it: old scope on the new port, new
scope on a known-good port. Here that took two page loads and settled it
immediately —

- read-only + :3002 → same error ⇒ not the scope
- write + :3003 → consent screen listing "Post and repost for you" ⇒ not the
  permission either

**Corollary.** `curl` cannot do this test. X validates `redirect_uri` and scope
only *after* the member is authenticated, so an unauthenticated request returns
the login redirect for every variant and looks identical whatever is wrong. It
has to be the signed-in browser.

**Practically:** either register every worktree port on the provider's app once,
or move the dev server onto a registered port for the OAuth leg — and say which
port out loud, because everything else about the app works fine on the wrong one
and only the redirect breaks.

### A provider can refuse for reasons that have nothing to do with the request

**Symptom.** The first real X publish failed with the app saying *"X wouldn't
accept this post. Try again."* Retrying could never have worked: X had returned
`402 {"detail":"credits depleted","title":"Payment Required"}` — the developer
account was out of API credits.

**Cause.** The response handler had one bucket for every non-2xx. That is right
for the refusals that *are* about the post (too long, duplicate, malformed) and
actively harmful for the ones about the **account**: a permanent billing state
described as a transient one sends someone round a loop that cannot terminate,
and a rate limit described the same way invites the retry that deepens it.

**Rule.** When mapping a provider's HTTP failures, sort them by *what the reader
should do next*, not by what went wrong. Three different answers hid behind one
code here — fix the post (4xx about content), stop and pay (402), wait (429) —
and only the first is a verdict on what was sent.

**Corollary, and the reason this took two live sends to find:** a coarse failure
code with no logging is undiagnosable from the outside. The provider's own
problem document is the only thing that says *which* refusal this was, and it
existed for exactly as long as the response object. Log the status and a
bounded slice of the body at the point of refusal — provider error bodies
describe the app, not the member.

## `text-balance` does not shrink the box, so centred text inside a capped one sits in dead gutters

**Symptom.** A multi-line tooltip capped at `max-w-64` and centred looked wrong:
"too much space right and left" of the text. Nothing about the padding or the
alignment was unusual, and the same classes on a short tooltip look fine.

**Cause.** `text-wrap: balance` splits the text into lines of roughly equal
length — but it does **not** feed that back into the element's width. Chrome
sizes the box first, as `min(max-content, max-width)`, and only then balances
the lines inside whatever it got. So a sentence whose `max-content` is 541px
pins the box at the 256px cap, and balance then lays it out as 166/170/174px
lines inside a 232px content box. Centred, that is ~29px of empty gutter on each
side, and it is *worse* the more balance has to shorten the lines. Measured with
a probe carrying the same classes: slack 57.8px with balance, 20.7px without.

**Rule.** `text-balance` is for text that is allowed to size its own box —
headings, a `w-fit` block. On anything with a width cap it only ever *adds*
whitespace, and centring makes that whitespace symmetric and obvious. Cap the
width or balance the text; doing both fights itself.

**Corollary on measuring this.** Don't eyeball it off a screenshot and don't try
to measure the live tooltip — every `javascript_tool` eval backgrounds the tab,
which closes a hover-driven popup before the measurement runs. Build a probe:
one off-screen div with the same class string, then read `getBoundingClientRect`
for the box and `Range.getClientRects()` for the individual line boxes. That
also lets several candidate class strings be compared in one pass.

**And check the width scale exists.** In the same pass, `max-w-56` and
`max-w-48` silently did nothing — they are not in this project's Tailwind scale,
so the class was dropped and the box went to its full 541px `max-content`. A
width utility that "has no effect" is more likely absent than overridden.


### A clean merge can still break the build, when two branches split a module

**Symptom.** `feat/x-publish` merged `main` with four ordinary content
conflicts. None of them mentioned `lib/publish-due.ts`, which nonetheless no
longer compiled: `import { isGrantStale } from "@/lib/linkedin/scopes"`, and
that export was gone.

**Cause.** One branch *added a consumer* of a symbol; the other *moved the
symbol* to a new module. Neither branch edited the other's file, so from git's
point of view there is nothing to reconcile — a three-way merge compares
content, and no content disagreed. The break lives in the relationship between
two files that were each changed exactly once.

**Rule.** After any merge that touches module structure — a symbol moved,
renamed, re-exported or split — **run tsc before assuming a clean merge is a
working one**, and grep for every consumer of what moved rather than trusting
the conflict list. `git status` reporting no conflicts is a statement about
text, not about the program.

**Corollary, and the reason this was cheap to fix rather than expensive:** the
resolution belongs in the *importing* file, not by restoring the old export.
Re-adding `isGrantStale` to `lib/linkedin/scopes.ts` would have compiled just as
well and quietly reinstated the LinkedIn-only version — the exact bug the move
existed to fix, now with a passing build on top of it.

### A predicate that hides a control is not a predicate that refuses a write

**Symptom.** A branch whose whole purpose was "a published post is read-only"
shipped with the guarantee holding only in the browser. `updatePost`,
`regeneratePost` and the regenerate route all accepted an edit to a post that
was live on someone's timeline.

**Cause.** One good predicate (`isPostLocked`) was written and then used only
where the *UI* asks whether to draw a control. The single server-side use was in
`draftFollowUpPost`, asserting the opposite direction. Everything else inherited
the guarantee by assumption.

There is a real race behind it, not just a theoretical hole: the post-details
page holds a load-time snapshot, so if the scheduler publishes while that page
is open, every control stays live against a post that has since gone out.

**Rule.** When a rule protects something irreversible, the server enforces it
and the UI merely reflects it. And enforce it **inside the statement**, not as a
read followed by a write: a fetch-then-update re-opens the same race it was
meant to close, because the row can change between the two. A conditional
`UPDATE … WHERE <still unlocked>` with `.select()` lets the database decide, and
the absence of a returned row *is* the refusal.

**Corollary — one question, one predicate.** The same branch had two answers to
"may this account publish": the scheduler asked `isGrantStale` (every requested
scope, `email` included) while the send asked `hasPublishScope` (only
`w_member_social`). An account missing `email` published by hand and was
excluded from the scheduler forever. Two predicates for one question always
drift; the fix is for the second caller to ask the first one's question, not to
keep them in sync by hand.

### Reading a control's label is not reading its state

**Symptom.** Verifying a merge in the browser, a published post appeared to have
lost the read-only lock another branch had just added: the page listed an "Add to
calendar" button, which a locked post should not offer. For a moment this looked
like the merge had dropped that branch's work.

**Cause.** The probe collected `aria-label` and nothing else:

```js
[...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label'))
```

The button was there and `disabled`, which is exactly what the lock does — it
disables the control rather than removing it, so the reason stays visible. A
list of labels cannot tell those apart. The same probe also reported the page
had an editable content area; that turned out to be a **browser extension's own
`<textarea>`** sitting in the same document, matched because the selector was
`textarea, [contenteditable="true"]` against the whole page.

**Rule.** When checking whether a control is *available*, assert on the property
that makes it unavailable — `disabled`, `aria-disabled`, `hidden`, `pointer-events`
— never on the control's presence or its label. Presence is the wrong question
whenever "disabled but explained" is a deliberate state, which in this codebase
it usually is.

**Corollary.** Scope DOM probes to the app's own subtree (`main`, or a known
container) rather than `document`. An extension can inject inputs, dialogs and
buttons into the page, and a broad `querySelector` will find them and attribute
them to the app. Two of the three surprises in this session's verification pass
were extension chrome, not the product.

### A rule written in a comment is not a rule the code follows

**Symptom.** `UNLOCKED_PUBLISH_ERROR_FILTER`'s doc comment said, in bold,
"applied to the UPDATE itself, never as a read followed by a write" — and three
write-backs in the same repo did exactly the forbidden thing, across a window
far wider than the one the comment was written about. A reviewer found them the
sweep after the comment landed.

**Cause.** The rule was written while fixing *one* call site, and the sentence
generalised while the fix did not. `regeneratePost` and both writes in
`app/api/regenerate-post` checked `isPostLocked`, then awaited a live model call
for seconds, then wrote unconditionally — so the scheduler could publish the
post mid-generation and the write would land on something already public. The
commit message asserted the stronger property too, so the record was wrong in
two places at once.

**Rule.** When you write a rule down, grep for its violations in the same pass.
A comment that states a property the codebase does not have is worse than no
comment: the next reader trusts it, and the next reviewer has to disprove it.
If the fix is only partial, say which call sites are covered — that is a true
sentence, and it invites the follow-up rather than hiding it.

**And test the rule, not the helper.** The tests shipped alongside that comment
were four cases restating an existing `describe` block and two asserting a
constant contained substrings of itself; deleting `.is("published_at", null)`
from any write left the whole suite green. What broke twice was a *call site*
missing a filter, which is a property of the source — so
`lib/publish-lock-writes.test.ts` reads the source and asserts every
post-content write carries all three filters. Verified by deleting each filter
in turn and watching the matching case fail. A row-matching Supabase fake would
have been worse than useless here: this repo has already been bitten by one
diverging from PostgREST and hiding a bug that disabled publishing outright.

## OAuth password setup does not create an email identity

**Symptom.** An OAuth-only user could set a password in Profile and immediately
saw the disclosure promote to Change password, but a page refresh returned it
to Set password.

**Cause.** `supabase.auth.updateUser({ password })` updates the user's password
hash but does not add `email` to `auth.users.identities` or
`app_metadata.providers`. Those auth metadata fields describe how the account
was first linked, not every credential added later.

**Rule.** Never infer a password from Supabase identities. For product UI that
needs that distinction, use a minimal RLS-protected application record keyed to
the user; backfill it once from existing password hashes, and write it only
after the Auth update succeeds.

## A Vercel project made by `vercel project add` has no framework, and the build still passes

**Symptom.** First production deploy reported `readyState: READY`,
`aliasAssigned: true`, `aliasError: null`, and the build log showed a real
Next.js build — `✓ Compiled successfully in 37.3s`, TypeScript checked, pages
collected. Every URL returned `404` with `x-vercel-error: NOT_FOUND`. The custom
domain 404'd, the auto-generated `*.vercel.app` production alias 404'd, and the
deployment URL 302'd to `vercel.com/sso-api` — which read like a DNS or alias
problem and sent the investigation at the domain for several minutes.

**What made it legible.** The two hosts that appeared to "work" were only
returning Vercel's SSO redirect — the app itself had never served a byte.
Bypassing protection (`vercel curl`, which mints an automation-bypass token on
the spot) made the deployment return the *same* 404. That moved the fault off
the domain and onto the deployment.

**Cause.** `vercel project add <name>` creates a bare project. It does **not**
run framework detection — that only happens when a project is created by
importing a repo or by `vercel deploy` on an unlinked directory. The project sat
at `framework: null`, which is a valid setting meaning "no framework": Vercel
still runs the build (it infers `next build` from package.json), the build
genuinely succeeds, and then the output is published as **static files with no
Next.js adapter** — no server functions, no routing manifest, no pages. A
correct build, served wrong. Nothing anywhere reports an error, because from
Vercel's point of view nothing went wrong.

**Rule.** After creating a Vercel project by any path other than importing a
repo, check `framework` before trusting a deploy:

```
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v9/projects/<name>?teamId=<team>" \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('framework'))"
```

`null` on a Next.js app is the bug. Fix with
`PATCH /v9/projects/<name>` `{"framework":"nextjs"}` and redeploy — a promote
is not enough, the output itself has to be rebuilt.

**The generalisation worth keeping:** a 404 on *every* route, including `/`, is
almost never a routing bug in the app — the app would have to be missing
entirely. Suspect the platform's idea of what it is serving before suspecting
the code. And when some hosts "respond" and others 404, check what the
responding ones actually returned: an SSO redirect is the edge answering, not
the application.

## 2026-09-10 — A transparent fade endpoint still exposes the hard clip

**Symptom.** Mobile scroll content looked softly faded near the bottom, but a
high-contrast button or card edge still revealed a thin, sharp cutoff at the
actual overflow boundary.

**Cause.** The overlay gradient reached the boundary at its most opaque colour
but relied on the exact terminal sample of that gradient to cover the cut. At
device-pixel rounding boundaries, a contrasting edge could still meet the
overflow clip before it was completely hidden.

**Rule.** When a scroll fade terminates at an internal overflow boundary, end
it with a short opaque cap in the canvas colour before beginning the gradient.
The cap guarantees the content is already invisible when it reaches the hard
clip; keep the pure edge-to-transparent gradient for boundaries that genuinely
bleed off-screen.

## 2026-09-10 — Optimistic navigation belongs to the destination

**Symptom.** The mobile tab highlight worked on the first navigation but became
unreliable after several taps, especially when a second tab was chosen before
the first route finished loading.

**Cause.** Pending selection state was keyed to the pathname where the click
started. When an older route committed, that origin no longer matched and the
newest optimistic selection was discarded even though its own navigation was
still in flight.

**Rule.** Track an optimistic navigation by its destination. Keep the newest
selection authoritative through intermediate commits, and yield to the URL
only when that destination arrives or navigation leaves the tab system.
