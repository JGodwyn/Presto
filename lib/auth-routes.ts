// `/login` and `/forgot-password` are redirect stubs into the persisted signup
// flow (the real screens live there so the segmented control has something to
// animate across — see app/(auth)/login/page.tsx). They stay as bookmarkable
// entry points, but they are *destinations for navigations only*.
//
// A Server Action must redirect to the final URL below instead. Next renders
// the redirect target into the action's own response and copies that render's
// headers onto it, and `location` isn't on its forbidden list — so redirecting
// an action at a stub produces a 303 that still carries the stub's own
// `Location`. The browser's action fetch follows it silently, React gets an
// HTML page where it expected a Flight payload, and the action rejects with
// "An unexpected response was received from the server" having already run.
// See LEARNINGS.md.
export const LOGIN_URL = "/signup?view=login"
export const FORGOT_PASSWORD_URL = "/signup?view=forgot-password"
