import { describe, expect, it } from "vitest"

import { fetchUrlText, htmlToText, truncateForPrompt } from "@/lib/ai/fetch-url"

describe("htmlToText", () => {
  it("drops script and style content rather than reading it as prose", () => {
    const text = htmlToText(
      "<p>Real copy.</p><script>var a = 1</script><style>.x{color:red}</style>"
    )
    expect(text).toContain("Real copy.")
    expect(text).not.toContain("var a")
    expect(text).not.toContain("color:red")
  })

  it("keeps block boundaries so paragraphs don't run together", () => {
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\nTwo")
    expect(htmlToText("First<br>Second")).toBe("First\nSecond")
  })

  it("decodes the entities that actually show up in prose", () => {
    expect(htmlToText("<p>Tom &amp; Jerry &quot;show&quot;</p>")).toBe('Tom & Jerry "show"')
  })

  it("collapses runs of whitespace left behind by stripped markup", () => {
    expect(htmlToText("<div>  a   <span>b</span>   c  </div>")).toBe("a b c")
  })
})

describe("truncateForPrompt", () => {
  it("leaves short text alone", () => {
    expect(truncateForPrompt("short", 100)).toBe("short")
  })

  it("marks truncation so the model knows the tail is missing", () => {
    const out = truncateForPrompt("abcdefghij", 5)
    expect(out.startsWith("abcde")).toBe(true)
    expect(out).toContain("[truncated]")
  })
})

describe("fetchUrlText", () => {
  // Returning null rather than throwing is the contract: a reference that
  // can't be read is supplementary context and must never fail a generation.
  it("refuses non-http schemes without attempting a request", async () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com/x", "not a url"]) {
      expect(await fetchUrlText(url), url).toBeNull()
    }
  })

  it("refuses hosts inside this server's own network", async () => {
    for (const url of [
      "http://localhost:3000/admin",
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://192.168.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://172.16.0.9/",
    ]) {
      expect(await fetchUrlText(url), url).toBeNull()
    }
  })

  it("allows a public host through the guard", async () => {
    // Only the guard and the text pipeline are under test — the request is
    // stubbed, since a real network call would make this suite slow and flaky.
    const original = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response("<p>Hello</p>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch

    try {
      expect(await fetchUrlText("https://example.com/post")).toBe("Hello")
    } finally {
      globalThis.fetch = original
    }
  })

  // The bypass this guards: PRIVATE_HOST used to be checked only against the
  // URL the user typed, while fetch followed redirects on its own — so a public
  // address that 302s inward was fetched and inlined, guard unseen.
  it("refuses a redirect into private space, however public the first hop is", async () => {
    const original = globalThis.fetch
    const seen: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seen.push(String(input))
      if (String(input).includes("example.com")) {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        })
      }
      return new Response("SECRET", { status: 200, headers: { "content-type": "text/plain" } })
    }) as typeof fetch

    try {
      expect(await fetchUrlText("https://example.com/redirects-inward")).toBeNull()
      // The decisive assertion: the metadata address was never requested.
      expect(seen.some((u) => u.includes("169.254.169.254"))).toBe(false)
    } finally {
      globalThis.fetch = original
    }
  })

  it("follows an ordinary public redirect", async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/old")) {
        return new Response(null, { status: 301, headers: { location: "https://example.com/new" } })
      }
      return new Response("<p>Moved here</p>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    }) as typeof fetch

    try {
      expect(await fetchUrlText("https://example.com/old")).toBe("Moved here")
    } finally {
      globalThis.fetch = original
    }
  })

  it("gives up rather than following a redirect loop forever", async () => {
    const original = globalThis.fetch
    let hops = 0
    globalThis.fetch = (async () => {
      hops++
      return new Response(null, { status: 302, headers: { location: "https://example.com/loop" } })
    }) as typeof fetch

    try {
      expect(await fetchUrlText("https://example.com/loop")).toBeNull()
      expect(hops).toBeLessThanOrEqual(6)
    } finally {
      globalThis.fetch = original
    }
  })

  it("returns null for a non-text response instead of feeding bytes to the model", async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(" ", {
        status: 200,
        headers: { "content-type": "image/png" },
      })) as typeof fetch

    try {
      expect(await fetchUrlText("https://example.com/logo.png")).toBeNull()
    } finally {
      globalThis.fetch = original
    }
  })
})
