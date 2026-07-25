import type { Instructions } from "@/types/instructions"
import type { PostPlatform } from "@/types/post"

const PLATFORM_LABELS: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X (formerly Twitter)",
}

export interface BuildPostPromptOptions {
  platform: PostPlatform
  topic?: string
  batchContext?: { index: number; total: number }
}

export function buildPostPrompt(instructions: Instructions, options: BuildPostPromptOptions): string {
  const { platform, topic, batchContext } = options
  const platformLabel = PLATFORM_LABELS[platform]

  if (instructions.singlePrompt) {
    const lines = [instructions.singlePromptText.trim()]

    if (topic) lines.push(`Topic for this post: ${topic}`)
    if (batchContext && batchContext.total > 1) {
      lines.push(
        `This is post ${batchContext.index + 1} of ${batchContext.total} in this batch — make it distinct from the others.`,
      )
    }

    return lines.join("\n\n")
  }

  const sections = [`You are writing a social media post for ${platformLabel}.`]

  if (instructions.tone.trim()) sections.push(`Tone: ${instructions.tone.trim()}`)
  if (instructions.contentRules.trim()) sections.push(`Content rules: ${instructions.contentRules.trim()}`)
  if (instructions.postStructure.trim()) sections.push(`Post structure: ${instructions.postStructure.trim()}`)
  if (instructions.whatToAvoid.trim()) sections.push(`Do not: ${instructions.whatToAvoid.trim()}`)
  if (topic) sections.push(`Topic: ${topic}`)

  sections.push("Write one complete, ready-to-publish post following the above.")

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
}

export function buildPostPrompts(instructions: Instructions, options: BuildPostPromptsOptions): string[] {
  const { platform, count } = options

  return Array.from({ length: count }, (_, index) =>
    buildPostPrompt(instructions, {
      platform,
      topic: pickTopicForIndex(instructions.topics, index),
      batchContext: { index, total: count },
    }),
  )
}
