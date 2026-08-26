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
