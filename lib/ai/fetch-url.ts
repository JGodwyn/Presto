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

// Address ranges that land inside the network this server runs on. Written as
// a predicate rather than one regex because the literal forms of a private
// address are genuinely varied — the first version of this covered only the
// IPv4 spellings, and let `[fd00:ec2::254]` (EC2's IPv6 metadata address),
// `localhost.` and `[::ffff:a9fe:a9fe]` (v4-mapped 169.254.169.254) straight
// through while claiming to block exactly those hosts.
//
// This is checked on **every hop**, not just the URL the user typed. Following
// redirects automatically made the guard worse than useless: a public URL that
// 302s to http://169.254.169.254/ (cloud metadata) or to localhost was fetched
// and inlined into the prompt, and the guard never saw the final hop — a bypass
// needing no DNS control at all.
//
// It is still not a complete SSRF defence: a hostname that *resolves* to a
// private address passes, because that needs DNS-level checks. What it does
// cover is every private-address *literal*, on every hop of the chain.

// Leading-octet match, so it over-blocks a public hostname that happens to
// start "10." — deliberate. Refusing to read someone's URL entry is a far
// cheaper mistake here than fetching the metadata endpoint.
const PRIVATE_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/

// `[::1]` arrives from URL parsing with its brackets still attached, and a
// trailing dot is a legal fully-qualified spelling that still resolves — so
// `localhost.` reaches 127.0.0.1 while `^localhost$` misses it.
function normalizeHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.+$/, "")
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host
}

// An IPv6 literal can carry an IPv4 address inside it, dotted (::ffff:127.0.0.1)
// or as the final two hextets (::ffff:7f00:1). Both need testing as the IPv4
// address they actually reach.
function embeddedIpv4(host: string): string | null {
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host)
  if (dotted) return dotted[1]

  const hextets = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host)
  if (!hextets) return null

  const high = parseInt(hextets[1], 16)
  const low = parseInt(hextets[2], 16)
  return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`
}

function isPrivateIpv6(host: string): boolean {
  if (host === "::" || host === "::1") return true

  const mapped = embeddedIpv4(host)
  if (mapped && PRIVATE_IPV4.test(mapped)) return true

  // The first hextet decides the range, but it has to be padded to its full
  // four digits first: `fd00::1` is unique-local, `fd::1` (hextet 0x00fd) is
  // not, and comparing the written prefix alone can't tell them apart.
  const written = host.startsWith("::") ? "0" : host.split(":")[0]
  const hextet = parseInt(written.padStart(4, "0"), 16)
  if (Number.isNaN(hextet)) return true

  if (hextet >>> 8 === 0xfc || hextet >>> 8 === 0xfd) return true // fc00::/7
  return (hextet & 0xffc0) === 0xfe80 // fe80::/10
}

// Exported for its own test: the failure mode here is a spelling nobody
// thought of, which is a table of literals to check, not a fetch to stub.
export function isPrivateHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  if (host === "") return true
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (PRIVATE_IPV4.test(host)) return true
  return host.includes(":") ? isPrivateIpv6(host) : false
}

function isFetchableUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (isPrivateHost(url.hostname)) return null
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
