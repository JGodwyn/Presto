import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Every server write that changes a post's *content* must carry the lock, or a
// post can be rewritten after it has gone out.
//
// This reads source rather than exercising the code, and that is deliberate.
// The two things that could be tested instead are both worse here: a
// row-matching Supabase fake re-implements PostgREST in JavaScript and has
// already, in this repo, disagreed with the real thing and hidden a bug that
// disabled publishing outright (LEARNINGS.md); and asserting on the filter
// constant's own text only fails when you are editing the test anyway.
//
// What actually went wrong twice was a *call site* missing a filter — checked
// above, written below, with a model call in between. That is a property of
// the source, so the source is what is checked. Deleting
// `.is("published_at", null)` from any of these writes fails this test, and
// nothing else in the suite does.
const WRITES = [
  {
    file: "app/projects/[projectId]/generate/post-actions.ts",
    label: "updatePost's edit",
    anchor: ".update(update)",
  },
  {
    file: "app/projects/[projectId]/generate/post-actions.ts",
    label: "regeneratePost's write-back",
    anchor: ".update({ content })",
  },
  {
    file: "app/api/regenerate-post/route.ts",
    label: "the TasteTest write-back",
    anchor: ".update({ content, ...topicsUpdate })",
  },
  {
    file: "app/api/regenerate-post/route.ts",
    label: "the streamed write-back",
    anchor: ".update({ content: end.content, ...topicsUpdate })",
  },
]

// The chained calls between `.update(...)` and the statement's end.
function filtersFor(source: string, anchor: string): string {
  const start = source.indexOf(anchor)
  expect(start, `anchor not found: ${anchor}`).toBeGreaterThan(-1)
  const rest = source.slice(start)
  // Statements here end at the first line that closes the chain.
  const end = rest.search(/\n\n|\n\s*(if|const|return|revalidatePath)\b/)
  return end === -1 ? rest : rest.slice(0, end)
}

describe("every post-content write carries the publish lock", () => {
  for (const { file, label, anchor } of WRITES) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8")

    it(`${label} refuses a published post`, () => {
      const filters = filtersFor(source, anchor)
      expect(filters).toContain('.is("published_at", null)')
    })

    it(`${label} refuses a post that went out but could not be recorded`, () => {
      const filters = filtersFor(source, anchor)
      expect(filters).toContain("UNLOCKED_PUBLISH_ERROR_FILTER")
    })

    // RLS scopes to the user, but one person owns several projects — so `id`
    // alone lets one project's page rewrite another's post. Closed on
    // publishPost and updatePost already; pinned here so it stays closed.
    it(`${label} is scoped to its project`, () => {
      const filters = filtersFor(source, anchor)
      expect(filters).toContain('.eq("project_id"')
    })
  }
})
