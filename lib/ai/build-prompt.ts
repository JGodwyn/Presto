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
      // No fetch happens here — this just puts the URL in front of the
      // model; google.tools.urlContext() (wired in lib/ai/generate.ts,
      // enabled whenever any attachment is this kind) is what lets Gemini
      // actually read it.
      return `Available at this URL: ${attachment.url}`
    case "file":
      // The actual bytes travel separately as a FilePart (see
      // lib/ai/generate.ts) — this line just tells the model one exists and
      // what it's called.
      return `(see attached file: ${attachment.fileName})`
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
}

// Last section of the prompt when a post is being regenerated (see
// previousContent above) — deliberately at the very end, after the "write one
// post" instruction, so the constraint the user just asked for is the most
// recent thing the model reads.
function buildRegenerateSection(previousContent: string): string {
  return [
    "You already wrote the post below from this exact brief, and it was rejected.",
    "Write a different post: same instructions, same topic, same voice — but a new angle, a new opening line and a different structure. Do not reuse its phrasing or reorder the same points.",
    "",
    "Previous attempt:",
    '"""',
    previousContent.trim(),
    '"""',
  ].join("\n")
}

export function buildPostPrompt(instructions: Instructions, options: BuildPostPromptOptions): string {
  const { platform, topic, batchContext, writingStyles, references, previousContent } = options
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
    if (previousContent?.trim()) lines.push(buildRegenerateSection(previousContent))

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

  if (previousContent?.trim()) sections.push(buildRegenerateSection(previousContent))

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
