import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

// Users' provider API keys (Google/OpenAI/Anthropic) are stored in
// public.user_ai_models and forwarded to the AI Gateway per request. They're
// encrypted at rest with AES-256-GCM so a database leak on its own — a dump, a
// backup, a stolen service-role key — yields nothing usable without the
// separately-held MODEL_KEY_ENCRYPTION_KEY. GCM (not CBC) so tampering with a
// stored value fails loudly at decrypt time instead of silently producing
// garbage that we'd then send to a provider as if it were a real key.
//
// node:crypto only — no package needed for any of this.

const ALGORITHM = "aes-256-gcm"
const KEY_BYTES = 32
// 96 bits is GCM's standard IV length: the only size the spec lets the
// counter be used directly, so any other length triggers an extra hashing
// step for no benefit.
const IV_BYTES = 12
// Version tag on every stored value so the key can be rotated later (write
// "v2." with a new key, keep reading "v1." until everything's migrated)
// without having to guess a format from the ciphertext itself.
const FORMAT_VERSION = "v1"

function getEncryptionKey(): Buffer {
  const raw = process.env.MODEL_KEY_ENCRYPTION_KEY

  // Deliberately fatal rather than falling back to a derived or empty key:
  // a silent fallback here would write "encrypted" values that anyone could
  // reverse, and nothing downstream would ever notice.
  if (!raw) {
    throw new Error(
      "MODEL_KEY_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    )
  }

  const key = Buffer.from(raw, "base64")
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `MODEL_KEY_ENCRYPTION_KEY must be ${KEY_BYTES} base64-encoded bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
    )
  }

  return key
}

export function encryptApiKey(plain: string): string {
  if (!plain) {
    throw new Error("Cannot encrypt an empty API key.")
  }

  // A fresh IV per call — reusing one across two keys under the same
  // encryption key is the one thing that actually breaks GCM.
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".")
}

// Throws on any tampering, truncation, or wrong-key decrypt — callers treat a
// throw as "this key is unusable", never as an empty string.
export function decryptApiKey(stored: string): string {
  const parts = stored.split(".")
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Stored API key is not in the expected format.")
  }

  const [, ivPart, tagPart, ciphertextPart] = parts
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivPart, "base64")
  )
  decipher.setAuthTag(Buffer.from(tagPart, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

// What the Connections list shows in place of the key itself — the key is
// never sent back to the browser, so this is stored as its own column at
// insert time rather than derived from the ciphertext later.
export function lastFourOfKey(plain: string): string {
  return plain.slice(-4)
}
