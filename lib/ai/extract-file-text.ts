import mammoth from "mammoth"
import { extractText, getDocumentProxy } from "unpdf"

import { truncateForPrompt } from "@/lib/ai/fetch-url"

// Turns an uploaded writing-style/reference file into plain text for the
// prompt.
//
// Same reasoning as lib/ai/fetch-url.ts, and the other half of making
// Instructions work on every model. File bytes used to be sent inline as
// FileParts and left to the provider to interpret, which meant support varied:
// Gemini reads PDF and DOCX natively, Anthropic reads PDF, OpenAI differs
// again. Extracting here means each provider receives the same words, and
// nothing about a writing sample depends on which model is selected.
//
// It's also cheaper. A base64 PDF is far more tokens than the prose inside it,
// and for a *writing sample* the prose is the entire point — layout and images
// contribute nothing to tone, structure or vocabulary.

// Legacy binary .doc is deliberately not handled: it's a pre-XML OLE format
// that mammoth doesn't read and that would need its own parser for a format
// Word hasn't defaulted to since 2007. Such a file resolves to null and is
// reported as unreadable rather than silently contributing nothing.
export const EXTRACTABLE_MEDIA_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
])

// Null rather than throwing, matching resolveAttachment's existing contract: a
// reference that can't be read is supplementary context and must never take a
// whole generation down with it.
export async function extractFileText(
  mediaType: string,
  bytes: ArrayBuffer
): Promise<string | null> {
  try {
    const text = await extractByType(mediaType, bytes)
    if (!text) return null

    const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim()
    return cleaned.length > 0 ? truncateForPrompt(cleaned) : null
  } catch {
    return null
  }
}

async function extractByType(mediaType: string, bytes: ArrayBuffer): Promise<string | null> {
  if (mediaType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const { text } = await extractText(pdf, { mergePages: true })
    return Array.isArray(text) ? text.join("\n") : text
  }

  if (
    mediaType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return value
  }

  if (mediaType === "text/plain") {
    return new TextDecoder().decode(bytes)
  }

  return null
}
