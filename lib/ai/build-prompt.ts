import type { ResolvedAttachment } from "@/lib/ai/attachments"
import type { Instructions } from "@/types/instructions"
import type { PostPlatform } from "@/types/post"

const PLATFORM_LABELS: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X (formerly Twitter)",
}

function describeAttachment(attachment: ResolvedAttachment): string {
  switch (attachment.kind) {
    case "text":
      return attachment.text
    case "url":
      // The content is fetched server-side (lib/ai/fetch-url.ts) and inlined
      // here, so this reads the same to every provider. When the fetch failed
      // the URL is still named rather than dropped — it's often descriptive on
      // its own — but the model is told plainly that the page wasn't read, so
      // it can't treat the address as though it had seen the contents.
      return attachment.text
        ? `From ${attachment.url}:\n${attachment.text}`
        : `(couldn't read ${attachment.url} — don't assume anything about its contents)`
    case "file":
      // The document's text is extracted server-side (lib/ai/extract-file-text.ts)
      // and inlined, so every provider reads the same words. As with a URL, a
      // file that couldn't be read is named and disclaimed rather than dropped
      // or quietly presented as though it had been read.
      return attachment.text
        ? `From ${attachment.fileName}:\n${attachment.text}`
        : `(couldn't read ${attachment.fileName} — don't assume anything about its contents)`
  }
}

function buildAttachmentSection(
  heading: string,
  attachments: ResolvedAttachment[] | undefined,
): string | undefined {
  if (!attachments || attachments.length === 0) return undefined
  return [heading, ...attachments.map((a) => `- ${describeAttachment(a)}`)].join("\n")
}

export interface BuildPostPromptOptions {
  platform: PostPlatform
  topic?: string
  batchContext?: { index: number; total: number }
  // "My writing style" / "References" entries (Instructions page) — resolved
  // ahead of time (lib/ai/attachments.ts) since resolving a "file" kind
  // needs an async Storage download this function can't do (it stays pure).
  writingStyles?: ResolvedAttachment[]
  references?: ResolvedAttachment[]
  // Set when the Regenerate button on a generated card is what triggered this
  // call: everything above stays identical (that's the point — same brief,
  // same voice, same topic), and this appends the post being replaced so the
  // model can deliberately write something *else* rather than re-rolling the
  // same prompt and landing somewhere near the same answer.
  previousContent?: string
  // The regenerate modal's own optional note (design-sync/regeneratemodal)
  // on what this specific rewrite should do differently — additional to the
  // project's Instructions, not a replacement for them, so it's appended
  // after every other section rather than folded into tone/rules/etc.
  guidance?: string
}

// Fallback for guidance with no previousContent to react to — not a path
// anything currently exercises (guidance only ever arrives alongside a post
// being regenerated), kept so a future caller that passes guidance alone
// still gets it acted on.
function buildGuidanceSection(guidance: string): string {
  return `For this specific rewrite, the user also asked for: ${guidance.trim()}`
}

// Last section of the prompt when a post is being regenerated (see
// previousContent above) — deliberately at the very end, after the "write one
// post" instruction, so this is the most recent thing the model reads.
//
// This used to always append the "be different" instruction, then a
// separate section for the user's own guidance after it — two instructions
// that actively compete when both are present ("do what the guidance says"
// vs. "make it broadly different"), and a flash-tier model would often
// over-weight the earlier, more forceful "be different" framing over one
// trailing guidance sentence, drifting from what was actually asked. When
// guidance is given it's now the only instruction: it says what to change
// and implicitly permits keeping everything else, so there's nothing left
// competing with it. "Be different" is the fallback for a bare "Just
// regenerate" with no guidance at all, where it's the only available signal
// to keep a reroll from landing near the same answer.
function buildRegenerateSection(previousContent: string, guidance?: string): string {
  const trimmedGuidance = guidance?.trim()
  const instruction = trimmedGuidance
    ? `For this rewrite, the specific request below is the priority. Follow it exactly, even if that means keeping the same angle, opening line, or structure as the previous attempt — only change what the request actually asks you to change.\n\nSpecific request: ${trimmedGuidance}`
    : "Write a different post: same instructions, same topic, same voice — but a new angle, a new opening line and a different structure. Do not reuse its phrasing or reorder the same points."

  return [
    "You already wrote the post below from this exact brief, and it was rejected.",
    instruction,
    "",
    "Previous attempt:",
    '"""',
    previousContent.trim(),
    '"""',
  ].join("\n")
}

export function buildPostPrompt(instructions: Instructions, options: BuildPostPromptOptions): string {
  const { platform, topic, batchContext, writingStyles, references, previousContent, guidance } =
    options
  const platformLabel = PLATFORM_LABELS[platform]

  const writingStyleSection = buildAttachmentSection(
    "Writing style examples — match this tone and voice:",
    writingStyles,
  )
  const referenceSection = buildAttachmentSection("Reference material — use for context:", references)

  if (instructions.singlePrompt) {
    const lines = [instructions.singlePromptText.trim()]

    // Layered in even though singlePromptText already overrides the
    // structured tone/rules/structure/avoid fields (per direct confirmation)
    // — writing style/reference entries are supplementary context, not a
    // "voice" field being overridden, same reasoning already applied to
    // topic/batch-distinctness below.
    if (writingStyleSection) lines.push(writingStyleSection)
    if (referenceSection) lines.push(referenceSection)
    if (topic) lines.push(`Topic for this post: ${topic}`)
    if (batchContext && batchContext.total > 1) {
      lines.push(
        `This is post ${batchContext.index + 1} of ${batchContext.total} in this batch — make it distinct from the others.`,
      )
    }
    if (previousContent?.trim()) {
      lines.push(buildRegenerateSection(previousContent, guidance))
    } else if (guidance?.trim()) {
      lines.push(buildGuidanceSection(guidance))
    }

    return lines.join("\n\n")
  }

  const sections = [`You are writing a social media post for ${platformLabel}.`]

  if (instructions.tone.trim()) sections.push(`Tone: ${instructions.tone.trim()}`)
  if (instructions.contentRules.trim()) sections.push(`Content rules: ${instructions.contentRules.trim()}`)
  if (instructions.postStructure.trim()) sections.push(`Post structure: ${instructions.postStructure.trim()}`)
  if (instructions.whatToAvoid.trim()) sections.push(`Do not: ${instructions.whatToAvoid.trim()}`)
  if (writingStyleSection) sections.push(writingStyleSection)
  if (referenceSection) sections.push(referenceSection)
  if (topic) sections.push(`Topic: ${topic}`)

  sections.push("Write one complete, ready-to-publish post following the above.")

  if (previousContent?.trim()) {
    sections.push(buildRegenerateSection(previousContent, guidance))
  } else if (guidance?.trim()) {
    sections.push(buildGuidanceSection(guidance))
  }

  return sections.join("\n\n")
}

// Round-robins topics across a batch by index, e.g. for a generation run of
// N posts. Shared by buildPostPrompts and callers that generate posts one at
// a time (post-actions.ts), so both stay in sync on the same assignment.
export function pickTopicForIndex(topics: string[], index: number): string | undefined {
  return topics.length > 0 ? topics[index % topics.length] : undefined
}

export interface BuildPostPromptsOptions {
  platform: PostPlatform
  count: number
  writingStyles?: ResolvedAttachment[]
  references?: ResolvedAttachment[]
}

export function buildPostPrompts(instructions: Instructions, options: BuildPostPromptsOptions): string[] {
  const { platform, count, writingStyles, references } = options

  return Array.from({ length: count }, (_, index) =>
    buildPostPrompt(instructions, {
      platform,
      topic: pickTopicForIndex(instructions.topics, index),
      batchContext: { index, total: count },
      writingStyles,
      references,
    }),
  )
}
