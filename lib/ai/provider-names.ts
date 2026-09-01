// Provider display names, kept apart from lib/ai/providers.ts on purpose:
// that module imports the provider SDKs, so a client component reaching for a
// name would pull @anthropic-ai/sdk and openai into the browser bundle. This
// file is data only and safe to import anywhere.
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  groq: "Groq",
}

export function providerDisplayName(slug: string): string {
  return PROVIDER_DISPLAY_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}
