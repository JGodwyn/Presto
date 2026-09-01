import { describe, expect, it } from "vitest"

import {
  bareModelId,
  isGoogleWritingModel,
  isGroqTextModel,
  isOpenAiTextModel,
  openAiDisplayName,
  providerSlugOf,
} from "@/lib/ai/providers"

// OpenAI's /v1/models publishes no type field, so the chat-vs-everything-else
// split is done on the id alone (see the comment in providers.ts). These are
// real ids from OpenAI's catalog — the point is that the two rules stay correct
// for models that share a "gpt-" prefix but aren't text generators.
describe("isOpenAiTextModel", () => {
  it("keeps text-generation models", () => {
    for (const id of [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-5",
      "gpt-5-mini",
      "chatgpt-4o-latest",
      "o1",
      "o3-mini",
      "o4-mini",
      "codex-mini-latest",
    ]) {
      expect(isOpenAiTextModel(id), id).toBe(true)
    }
  })

  it("drops other modalities that share the gpt- prefix", () => {
    for (const id of [
      "gpt-4o-audio-preview",
      "gpt-4o-realtime-preview",
      "gpt-4o-transcribe",
      "gpt-4o-mini-tts",
      "gpt-image-1",
    ]) {
      expect(isOpenAiTextModel(id), id).toBe(false)
    }
  })

  it("drops non-chat families outright", () => {
    for (const id of [
      "text-embedding-3-small",
      "text-embedding-ada-002",
      "whisper-1",
      "tts-1-hd",
      "dall-e-3",
      "omni-moderation-latest",
      "sora-2",
      "davinci-002",
    ]) {
      expect(isOpenAiTextModel(id), id).toBe(false)
    }
  })
})

// Groq's list mixes speech and moderation models in with the text ones and
// publishes no type field, same as OpenAI's — but its non-text families are
// narrower, so a blocklist alone carries it.
// Google publishes a real capability field, so the only filtering left is
// dropping models that genuinely do generateContent but aren't writers.
describe("isGoogleWritingModel", () => {
  it("keeps the Gemini and Gemma models used for writing", () => {
    for (const id of [
      "models/gemini-3.6-flash",
      "models/gemini-2.5-flash-lite",
      "models/gemini-3.1-pro-preview",
      "models/gemma-4-31b-it",
    ]) {
      expect(isGoogleWritingModel(id), id).toBe(true)
    }
  })

  it("drops agentic and research models that can't write a post", () => {
    for (const id of [
      "models/deep-research-max-preview-04-2026",
      "models/gemini-2.5-computer-use-preview-10-2025",
      "models/antigravity-preview-05-2026",
      "models/gemini-robotics-er-2-preview",
      // Neither of these names its modality — the reason a blocklist has to be
      // maintained against the real catalog rather than inferred.
      "models/nano-banana-pro-preview",
      "models/lyria-3-pro-preview",
      "models/gemini-3.5-transcribe",
      "models/gemini-2.5-flash-preview-tts",
      "models/gemini-3.1-flash-image",
    ]) {
      expect(isGoogleWritingModel(id), id).toBe(false)
    }
  })
})

describe("isGroqTextModel", () => {
  it("keeps the text models Groq actually serves", () => {
    for (const id of [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "moonshotai/kimi-k2-instruct",
      "qwen/qwen3-32b",
      "deepseek-r1-distill-llama-70b",
      "gemma2-9b-it",
    ]) {
      expect(isGroqTextModel(id), id).toBe(true)
    }
  })

  it("drops speech and moderation models", () => {
    for (const id of [
      "whisper-large-v3",
      "whisper-large-v3-turbo",
      "playai-tts",
      "meta-llama/llama-guard-4-12b",
      "meta-llama/llama-prompt-guard-2-86m",
    ]) {
      expect(isGroqTextModel(id), id).toBe(false)
    }
  })
})

describe("openAiDisplayName", () => {
  it("cases the family the way OpenAI writes it, and changes nothing else", () => {
    expect(openAiDisplayName("gpt-5.2-mini")).toBe("GPT-5.2-mini")
    expect(openAiDisplayName("chatgpt-4o-latest")).toBe("ChatGPT-4o-latest")
    expect(openAiDisplayName("o3-pro")).toBe("o3-pro")
  })
})

describe("id helpers", () => {
  it("splits a prefixed id into provider and bare model", () => {
    expect(providerSlugOf("anthropic/claude-sonnet-5")).toBe("anthropic")
    expect(bareModelId("anthropic/claude-sonnet-5")).toBe("claude-sonnet-5")
    expect(bareModelId("openai/gpt-5")).toBe("gpt-5")
  })

  it("treats an unprefixed id as having no provider", () => {
    expect(providerSlugOf("claude-sonnet-5")).toBe("")
    expect(bareModelId("claude-sonnet-5")).toBe("claude-sonnet-5")
  })
})
