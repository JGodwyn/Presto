import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Every server write that changes a post's *content* must carry the lock, or a
// post can be rewritten after it has gone out.
//
// **This discovers the writes rather than listing them, and that is the whole
// point.** The first version of this test named four call sites by an anchor
// string. A brand-new route doing `.from("posts").update({ content })` with no
// filters at all passed it green — which is precisely the defect that has now
// bitten twice. An allowlist cannot catch the case it was never told about.
//
// It reads source rather than exercising the code, also deliberately. A
// row-matching Supabase fake re-implements PostgREST in JavaScript, and one in
// this repo already disagreed with the real thing and hid a bug that disabled
// publishing outright (LEARNINGS.md). What broke was never the SQL semantics —
// it was a call site missing a filter, which is a property of the source.

const ROOTS = ["app", "lib", "components"]

// Mutations of `posts` that deliberately do not carry the lock, each with its
// reason. **Everything not listed here must carry all three filters** — the
// requirement is on every update and delete, not on the ones that look like
// they touch content.
//
// Detecting "writes content" was tried and is not sound: `updatePost` passes a
// built object (`.update(update)`), so a content check reading the call site
// misses it entirely. Requiring the lock by default and naming the exceptions
// cannot be fooled that way, and it makes each exception a visible decision
// rather than an omission.
const EXEMPT: { match: RegExp; why: string }[] = [
  {
    match: /^lib\/publish-runner\.ts$/,
    why: "the publishing machinery itself — it sets published_at/publish_error and claims rows, so locking it out would stop publishing working",
  },
  {
    match: /^app\/api\/cron\/publish\/route\.ts$/,
    why: "the scheduler's own bookkeeping, same reason as publish-runner",
  },
]

// deletePost is exempt by a deliberate product decision, not an oversight:
// whether removing a post that is live on LinkedIn should be refused is parked
// in FOLLOWUPS. It still must be project-scoped, which is asserted separately.
const DELETE_EXEMPT = /\.delete\(\)/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

interface PostsWrite {
  file: string
  chain: string
}

// A real boundary rather than a keyword guess: the chain ends at the first line
// that is not another `.call()`. The previous version stopped at `\n\n` or a
// line starting if/const/return/revalidatePath, so a chain followed by `let`,
// `await`, `}` or a comment ran on into the next statement — and filters
// belonging to a *later* write counted as this one's.
function postsWrites(file: string): PostsWrite[] {
  const source = fs.readFileSync(file, "utf8")
  const writes: PostsWrite[] = []

  for (const match of source.matchAll(/\.from\("posts"\)/g)) {
    const lines = source.slice(match.index).split("\n")
    const chain: string[] = [lines[0]]
    for (const line of lines.slice(1)) {
      if (!/^\s*\.[A-Za-z]/.test(line)) break
      chain.push(line)
    }
    writes.push({ file, chain: chain.join("\n") })
  }

  return writes
}

// A write that sets `content` is one that can overwrite what was published.
// Anything else on `posts` — status bookkeeping, claims, markers — is not this
// test's business.
function mutates(chain: string): boolean {
  return /\.(update|delete)\(/.test(chain)
}

const REQUIRED: { label: string; pattern: RegExp }[] = [
  { label: '.eq("project_id", …)', pattern: /\.eq\("project_id"/ },
  { label: '.is("published_at", null)', pattern: /\.is\("published_at", null\)/ },
  { label: "UNLOCKED_PUBLISH_ERROR_FILTER", pattern: /UNLOCKED_PUBLISH_ERROR_FILTER/ },
]

const allWrites = ROOTS.filter((root) => fs.existsSync(root))
  .flatMap((root) => sourceFiles(root))
  .flatMap((file) => postsWrites(file))

const guarded = allWrites.filter(
  ({ file, chain }) =>
    mutates(chain) &&
    !DELETE_EXEMPT.test(chain) &&
    !EXEMPT.some(({ match }) => match.test(file))
)

describe("every post-content write carries the publish lock", () => {
  // If this ever reads 0, the discovery has broken and every case below would
  // vacuously pass — the exact way a source-reading test rots into noise.
  it("finds the writes at all", () => {
    expect(guarded.length).toBeGreaterThanOrEqual(4)
  })

  for (const { label, pattern } of REQUIRED) {
    it(`carries ${label}`, () => {
      const missing = guarded
        .filter(({ chain }) => !pattern.test(chain))
        .map(({ file, chain }) => `${file}: ${chain.split("\n")[1]?.trim() ?? chain}`)

      expect(missing, `missing ${label}`).toEqual([])
    })
  }
})

// The one exempt mutation still owes the project scoping, which is about whose
// post it is rather than whether it has gone out.
describe("the delete exemption is still project-scoped", () => {
  it("scopes deletes by project", () => {
    const deletes = allWrites.filter(
      ({ file, chain }) =>
        DELETE_EXEMPT.test(chain) && !EXEMPT.some(({ match }) => match.test(file))
    )

    expect(deletes.length).toBeGreaterThan(0)
    for (const { file, chain } of deletes) {
      expect(chain, `${file} deletes without a project scope`).toMatch(
        /\.eq\("project_id"/
      )
    }
  })
})
