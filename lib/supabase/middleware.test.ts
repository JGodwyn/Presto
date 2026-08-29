import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { updateSession } from "@/lib/supabase/middleware"

// No cookies at all: getUser() resolves to no user without touching the
// network, which is the branch these assertions are about.
function request(url: string, method = "GET") {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method })
}

describe("updateSession", () => {
  it("sends a signed-out navigation to /login", async () => {
    const response = await updateSession(request("/projects/abc/profile"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("leaves an unprotected route alone", async () => {
    const response = await updateSession(request("/signup"))

    expect(response.status).toBe(200)
  })

  // A Server Action is a POST to the page's own URL. Redirecting one strands
  // the caller: the browser follows the 307 with its `Next-Action` header
  // still attached and gets a 404 that React can't read as an action result,
  // so the promise never settles — which is how logging out with an expired
  // session left the button spinning forever without ever signing anyone out.
  it("lets a server action through rather than redirecting it", async () => {
    const response = await updateSession(request("/projects/abc/profile", "POST"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })
})
