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
