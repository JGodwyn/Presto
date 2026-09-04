// The kill switch, and the "explicit confirm" half of every platform's publish
// gate. One switch, both platforms: turning publishing on is a single
// deliberate act, not a per-provider setting.
//
// Absent by default and absent from .env.local.example on purpose — it is not
// configuration. See AGENTS.md's hard publishing constraint.
//
// **Server-only**, which is why it is not in lib/publish-failure.ts alongside
// the copy: that file is read by client components, and an env read there
// compiles to `undefined` in the browser — a gate that silently always answers
// "off" is worse than no gate at that layer at all. Nothing client-side asks
// this question; the control is always offered and the refusal explains itself
// (see lib/post-publish.ts).
const LIVE_PUBLISH_ENV = "PRESTO_ENABLE_LIVE_PUBLISH"

// Only ever read through this, so there is exactly one place that decides.
export function isLivePublishEnabled(): boolean {
  return process.env[LIVE_PUBLISH_ENV] === "true"
}
