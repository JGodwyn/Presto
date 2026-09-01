// Fetches a "url" kind writing-style/reference entry and reduces it to plain
// text for the prompt.
//
// This exists because the alternative was provider-specific. URL entries used
// to be handed to the model as a bare "Available at this URL: …" line, with
// Google's provider-executed `url_context` tool doing the actual fetching —
// which meant the feature silently did nothing on any other provider, and
// worse, still *told* the model a URL was available. Fetching here makes the
// content identical for every model, present and future, and removes the one
// place a capability depended on which provider was selected.

const FETCH_TIMEOUT_MS = 10_000
// Redirects are followed by hand (see fetchUrlText) so every hop can be
// re-checked. Enough for the http→https and apex→www hops real sites use.
const MAX_REDIRECTS = 5
// Enough for a long article; past this the tail is rarely the part that
// characterises someone's writing, and it's prompt budget spent on nothing.
const MAX_TEXT_LENGTH = 20_000
const MAX_BYTES = 2_000_000

// Hostnames that resolve inside the network this server runs on.
//
// This is checked on **every hop**, not just the URL the user typed. Following
// redirects automatically made the guard worse than useless: a public URL that
// 302s to http://169.254.169.254/ (cloud metadata) or to localhost was fetched
// and inlined into the prompt, and the guard never saw the final hop — a bypass
// needing no DNS control at all.
//
// It is still not a complete SSRF defence: a hostname that *resolves* to a
// private address passes, because that needs DNS-level checks. What it does
// cover is the whole redirect chain, which is what makes it worth having.
const PRIVATE_HOST = /^(localhost$|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1$|\[::1\]$|172\.(1[6-9]|2\d|3[01])\.)/i

function isFetchableUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (PRIVATE_HOST.test(url.hostname)) return null
  return url
}

// Deliberately not a parser dependency. Articles are the realistic input, and
// dropping script/style then unwrapping tags gets their prose out intact;
// anything needing a real DOM (a JS-rendered app) wouldn't survive a plain
// fetch anyway, parser or not.
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Keep block boundaries as line breaks so paragraphs don't run together.
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
}

export function truncateForPrompt(text: string, max = MAX_TEXT_LENGTH): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}\n\n[truncated]`
}

// Returns null rather than throwing: a reference that can't be read is
// supplementary context, and losing it should never take the whole generation
// down — the same contract resolveAttachment already uses for a file whose
// Storage download fails.
export async function fetchUrlText(raw: string): Promise<string | null> {
  const url = isFetchableUrl(raw)
  if (!url) return null

  try {
    // One deadline across the whole chain, so a redirect loop can't buy extra
    // time by resetting the clock on each hop.
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
    let current = url
    let response: Response | null = null

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const hopResponse = await fetch(current, {
        // Manual, so each Location can be re-checked before it is fetched.
        redirect: "manual",
        signal,
        headers: {
          // Some sites serve a bot-blocking page to an unfamiliar agent, and an
          // Accept header keeps them from returning an API/JSON variant.
          "user-agent": "PrestoBot/1.0 (+https://presto.app)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      })

      if (hopResponse.status < 300 || hopResponse.status >= 400) {
        response = hopResponse
        break
      }

      const location = hopResponse.headers.get("location")
      if (!location) return null

      // Resolved against the current URL so a relative Location works.
      const next = isFetchableUrl(new URL(location, current).href)
      if (!next) return null
      current = next
    }

    if (!response) return null
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") ?? ""
    if (!/text\/html|text\/plain|application\/xhtml|application\/json/i.test(contentType)) {
      return null
    }

    // Guard before reading the body, then again after: Content-Length is
    // absent on a chunked response, which is exactly when a huge body would
    // slip through.
    const declared = Number(response.headers.get("content-length") ?? 0)
    if (declared > MAX_BYTES) return null

    const body = await response.text()
    if (body.length > MAX_BYTES) return null

    const text = /html|xhtml/i.test(contentType) ? htmlToText(body) : body.trim()
    return text.length > 0 ? truncateForPrompt(text) : null
  } catch {
    return null
  }
}
