// Values shared between the generation code and the UI — and, critically, the
// only AI module a **client component** may import from.
//
// This file exists because of a real regression. These constants used to live
// in lib/ai/generate.ts, which imports lib/ai/providers.ts to build a model
// from a ModelSelection. providers.ts constructs its provider objects at module
// scope, so nothing tree-shakes: five client components importing a single
// string from generate.ts pulled the Anthropic, OpenAI, Groq and Google SDKs
// into the browser bundle — `.next/static/chunks` went 3.7 MB → 6.9 MB, with a
// 1.07 MB chunk on Generate, Content, post details and Generating.
//
// Nothing caught it. tsc, eslint, vitest and `next build` were all green while
// it happened; only diffing built bundles surfaced it. lib/ai/no-client-sdk.test.ts
// now fails if a client component reaches generate.ts again.
//
// **Keep this file free of imports.** Types and literals only. The moment it
// imports something that pulls a provider SDK, it stops being the safe module.

export const BUILTIN_MODELS = ["gemini-3.6-flash", "tastetest"] as const
export type BuiltinModel = (typeof BUILTIN_MODELS)[number]

// The built-in that actually calls a model, on the app's own
// GOOGLE_GENERATIVE_AI_API_KEY. Anything the model pill offers beyond these two
// is a user_ai_models row id (a uuid) — see resolveModelSelection.
export const BUILTIN_MODEL_ID: BuiltinModel = "gemini-3.6-flash"

// The free, no-API-call stand-in (lib/ai/taste-test.ts): post-actions.ts
// branches on this instead of calling generatePost at all.
export const TASTE_TEST_MODEL_ID: BuiltinModel = "tastetest"

// Appended to the plain-text stream (streamPost + app/api/regenerate-post/
// route.ts) when the underlying model call fails mid-stream. Plain text has no
// framing of its own, and the response has already gone out with a 200 the
// moment headers were flushed, so there is no status code left to signal
// failure with once streaming has started. Chosen to be something no real
// generated post could contain.
export const STREAM_ERROR_MARKER = " PRESTO_STREAM_ERROR "

// The success counterpart, appended when the stream ends having produced text.
// It exists because "the connection closed" and "the model finished" look
// identical over plain text: a function hitting its duration ceiling, or a
// proxy idling the socket out, ends the response cleanly mid-generation.
// Without this the client would treat whatever arrived as the finished post
// while the server correctly persisted nothing. Requiring a positive
// end-of-stream signal makes truncation detectable instead.
export const STREAM_DONE_MARKER = " PRESTO_STREAM_DONE "

// Why a generation failed, in the terms the UI reports.
// "missing_instructions"/"not_signed_in" are added by post-actions.ts (they are
// not generatePost failures at all); the rest come from classifyGenerationError.
export type GenerationFailureReason =
  | "missing_instructions"
  | "not_signed_in"
  | "model_unavailable"
  | "rate_limit"
  | "auth"
  | "server"
  | "network"
  | "unknown"
