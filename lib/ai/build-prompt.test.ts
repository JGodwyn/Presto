import { describe, expect, it } from "vitest"
import type { ResolvedAttachment } from "@/lib/ai/attachments"
import { buildPostPrompt, buildPostPrompts } from "@/lib/ai/build-prompt"
import type { Instructions } from "@/types/instructions"

function makeInstructions(overrides: Partial<Instructions> = {}): Instructions {
  return {
    projectId: "test-project",
    singlePrompt: false,
    singlePromptText: "",
    tone: "",
    contentRules: "",
    postStructure: "",
    whatToAvoid: "",
    topics: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("buildPostPrompt", () => {
  it("includes tone/contentRules/postStructure/whatToAvoid when present", () => {
    const instructions = makeInstructions({
      tone: "Friendly and direct",
      contentRules: "Keep it under 200 words",
      postStructure: "Hook, body, call to action",
      whatToAvoid: "Corporate jargon",
    })

    const prompt = buildPostPrompt(instructions, { platform: "linkedin" })

    expect(prompt).toContain("Tone: Friendly and direct")
    expect(prompt).toContain("Content rules: Keep it under 200 words")
    expect(prompt).toContain("Post structure: Hook, body, call to action")
    expect(prompt).toContain("Do not: Corporate jargon")
  })

  it("omits blank fields instead of rendering empty sections", () => {
    const instructions = makeInstructions({ tone: "Friendly" })

    const prompt = buildPostPrompt(instructions, { platform: "linkedin" })

    expect(prompt).toContain("Tone: Friendly")
    expect(prompt).not.toContain("Content rules:")
    expect(prompt).not.toContain("Post structure:")
    expect(prompt).not.toContain("Do not:")
  })

  it("omits the topic line entirely when no topic is provided", () => {
    const prompt = buildPostPrompt(makeInstructions(), { platform: "linkedin" })

    expect(prompt).not.toContain("Topic:")
  })

  it("uses singlePromptText verbatim as the core content in single-prompt mode", () => {
    const instructions = makeInstructions({
      singlePrompt: true,
      singlePromptText: "Write a post about our new feature launch.",
    })

    const prompt = buildPostPrompt(instructions, { platform: "linkedin" })

    expect(prompt).toContain("Write a post about our new feature launch.")
    expect(prompt).not.toContain("Tone:")
  })

  it("adds a distinctness cue in single-prompt mode only when the batch has more than one post", () => {
    const instructions = makeInstructions({ singlePrompt: true, singlePromptText: "Write a post." })

    const single = buildPostPrompt(instructions, {
      platform: "linkedin",
      batchContext: { index: 0, total: 1 },
    })
    const batched = buildPostPrompt(instructions, {
      platform: "linkedin",
      batchContext: { index: 1, total: 3 },
    })

    expect(single).not.toContain("make it distinct")
    expect(batched).toContain("post 2 of 3")
    expect(batched).toContain("make it distinct")
  })

  it("inlines text-kind writing style/reference entries and omits sections when neither is given", () => {
    const withoutContext = buildPostPrompt(makeInstructions(), { platform: "linkedin" })
    expect(withoutContext).not.toContain("Writing style examples")
    expect(withoutContext).not.toContain("Reference material")

    const writingStyles: ResolvedAttachment[] = [{ kind: "text", text: "Always open with a bold claim." }]
    const references: ResolvedAttachment[] = [{ kind: "text", text: "Q3 revenue grew 40%." }]

    const prompt = buildPostPrompt(makeInstructions(), {
      platform: "linkedin",
      writingStyles,
      references,
    })

    expect(prompt).toContain("Writing style examples — match this tone and voice:")
    expect(prompt).toContain("- Always open with a bold claim.")
    expect(prompt).toContain("Reference material — use for context:")
    expect(prompt).toContain("- Q3 revenue grew 40%.")
  })

  it("describes url and file kinds without fetching or embedding raw file bytes", () => {
    const writingStyles: ResolvedAttachment[] = [
      { kind: "url", url: "https://example.com/voice-sample" },
      { kind: "file", fileName: "brand-voice.pdf", mediaType: "application/pdf", data: "base64==" },
    ]

    const prompt = buildPostPrompt(makeInstructions(), { platform: "linkedin", writingStyles })

    expect(prompt).toContain("Available at this URL: https://example.com/voice-sample")
    expect(prompt).toContain("(see attached file: brand-voice.pdf)")
    // The description references the file, but never inlines its payload —
    // that travels separately as a FilePart (lib/ai/generate.ts).
    expect(prompt).not.toContain("base64==")
  })

  it("layers writing style/reference sections into single-prompt mode too", () => {
    const instructions = makeInstructions({ singlePrompt: true, singlePromptText: "Write a post." })
    const writingStyles: ResolvedAttachment[] = [{ kind: "text", text: "Short, punchy sentences." }]

    const prompt = buildPostPrompt(instructions, { platform: "linkedin", writingStyles })

    expect(prompt).toContain("Write a post.")
    expect(prompt).toContain("Writing style examples — match this tone and voice:")
    expect(prompt).toContain("- Short, punchy sentences.")
  })
})

describe("buildPostPrompts", () => {
  it("round-robins topics across a count larger than the topic list", () => {
    const instructions = makeInstructions({ topics: ["Remote work", "Leadership"] })

    const prompts = buildPostPrompts(instructions, { platform: "linkedin", count: 5 })

    expect(prompts).toHaveLength(5)
    expect(prompts[0]).toContain("Topic: Remote work")
    expect(prompts[1]).toContain("Topic: Leadership")
    expect(prompts[2]).toContain("Topic: Remote work")
    expect(prompts[3]).toContain("Topic: Leadership")
    expect(prompts[4]).toContain("Topic: Remote work")
  })

  it("produces prompts with no topic line when topics is empty", () => {
    const prompts = buildPostPrompts(makeInstructions(), { platform: "linkedin", count: 3 })

    expect(prompts).toHaveLength(3)
    for (const prompt of prompts) {
      expect(prompt).not.toContain("Topic:")
    }
  })
})
