import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { decryptApiKey, encryptApiKey, lastFourOfKey } from "@/lib/ai/key-crypto"

// A fixed 32-byte key so these tests never depend on the developer's real
// .env.local. key-crypto.ts reads process.env at call time (not at module
// load) specifically so it can be swapped like this.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64")
const SAMPLE_KEY = "AIzaSyD-fake-google-key-for-tests-only-3f2k"

let originalKey: string | undefined

beforeEach(() => {
  originalKey = process.env.MODEL_KEY_ENCRYPTION_KEY
  process.env.MODEL_KEY_ENCRYPTION_KEY = TEST_KEY
})

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.MODEL_KEY_ENCRYPTION_KEY
  } else {
    process.env.MODEL_KEY_ENCRYPTION_KEY = originalKey
  }
})

describe("encryptApiKey / decryptApiKey", () => {
  it("round-trips a key", () => {
    expect(decryptApiKey(encryptApiKey(SAMPLE_KEY))).toBe(SAMPLE_KEY)
  })

  it("produces a versioned four-part value that doesn't contain the plaintext", () => {
    const stored = encryptApiKey(SAMPLE_KEY)

    expect(stored.split(".")).toHaveLength(4)
    expect(stored.startsWith("v1.")).toBe(true)
    expect(stored).not.toContain(SAMPLE_KEY)
    expect(stored).not.toContain("3f2k")
  })

  it("uses a fresh IV per call, so the same key never encrypts to the same value", () => {
    expect(encryptApiKey(SAMPLE_KEY)).not.toBe(encryptApiKey(SAMPLE_KEY))
  })

  it("rejects an empty key", () => {
    expect(() => encryptApiKey("")).toThrow(/empty/i)
  })

  it("throws when the ciphertext has been tampered with", () => {
    const [version, iv, tag, ciphertext] = encryptApiKey(SAMPLE_KEY).split(".")
    const flipped = Buffer.from(ciphertext, "base64")
    flipped[0] ^= 0xff

    expect(() =>
      decryptApiKey([version, iv, tag, flipped.toString("base64")].join("."))
    ).toThrow()
  })

  it("throws when the auth tag has been tampered with", () => {
    const [version, iv, tag, ciphertext] = encryptApiKey(SAMPLE_KEY).split(".")
    const flipped = Buffer.from(tag, "base64")
    flipped[0] ^= 0xff

    expect(() =>
      decryptApiKey([version, iv, flipped.toString("base64"), ciphertext].join("."))
    ).toThrow()
  })

  it("throws on a malformed or unversioned stored value", () => {
    expect(() => decryptApiKey("not-encrypted-at-all")).toThrow(/expected format/i)
    expect(() => decryptApiKey("v2.a.b.c")).toThrow(/expected format/i)
  })

  it("throws when decrypting with a different encryption key", () => {
    const stored = encryptApiKey(SAMPLE_KEY)
    process.env.MODEL_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64")

    expect(() => decryptApiKey(stored)).toThrow()
  })
})

describe("getEncryptionKey (via encryptApiKey)", () => {
  it("throws a helpful error when the env var is missing", () => {
    delete process.env.MODEL_KEY_ENCRYPTION_KEY

    expect(() => encryptApiKey(SAMPLE_KEY)).toThrow(/MODEL_KEY_ENCRYPTION_KEY is not set/)
  })

  it("throws when the env var decodes to the wrong length", () => {
    process.env.MODEL_KEY_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64")

    expect(() => encryptApiKey(SAMPLE_KEY)).toThrow(/must be 32 base64-encoded bytes \(got 16\)/)
  })
})

describe("lastFourOfKey", () => {
  it("returns the last four characters", () => {
    expect(lastFourOfKey(SAMPLE_KEY)).toBe("3f2k")
  })
})
