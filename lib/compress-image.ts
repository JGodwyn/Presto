"use client"

// Avatars are drawn at 56px on Profile and 28px in the navbar chip. Even at a
// 3× device pixel ratio that's 168px, so 512 leaves generous headroom for a
// larger frame later while putting a typical phone photo in the tens of KB
// rather than the megabytes it arrives as.
const MAX_DIMENSION = 512

// q80 is this project's existing house setting for raster assets — the Figma
// bridge converts exported PNGs to WebP at the same quality.
const QUALITY = 0.8

const PREFERRED_OUTPUT_TYPE = "image/webp"
const FALLBACK_OUTPUT_TYPE = "image/jpeg"

// Guards the *decode*, not the upload: a canvas has to hold the full bitmap in
// memory before it can be scaled down, so an absurd file is refused before it
// gets that far. The compressed result is what's actually uploaded, and lands
// far under the bucket's own 5MB ceiling.
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: string,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, QUALITY)
  })
}

// Mobile WebKit still does not expose createImageBitmap consistently for file
// inputs. Keep its faster, orientation-aware path where it works, but fall
// back to an object-URL Image so a valid phone JPEG never fails before upload.
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Fall through to the browser's <img> decoder below.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Image decoding failed"))
      image.src = objectUrl
    })
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(objectUrl),
  }
}

/**
 * Scales an image down to fit MAX_DIMENSION and re-encodes it as WebP, with a
 * JPEG fallback for mobile WebKit builds that cannot encode WebP.
 *
 * Two details that matter:
 *
 * - **EXIF orientation is honoured** (`imageOrientation: "from-image"`).
 *   Photos off a phone routinely carry a rotation flag rather than rotated
 *   pixels; drawing such a file to a canvas without this silently bakes in the
 *   *unrotated* pixels, so a portrait selfie uploads sideways.
 * - **An animated GIF becomes a still.** A canvas only ever sees one frame, so
 *   there's no way to keep the animation on this path — the first frame is
 *   what gets stored.
 *
 * Never upscales: an image already smaller than MAX_DIMENSION keeps its
 * dimensions and is only re-encoded.
 */
export async function compressImage(file: File): Promise<File> {
  const image = await decodeImage(file)

  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(image.width, image.height)
    )
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas 2D context unavailable")
    context.drawImage(image.source, 0, 0, width, height)

    // Older mobile WebKit can decode an image but either returns null for a
    // WebP canvas encode or silently substitutes PNG. Upload JPEG in both
    // cases: it is universally supported there and its type/extension remain
    // truthful for Storage and every avatar reader.
    let blob = await encodeCanvas(canvas, PREFERRED_OUTPUT_TYPE)
    let outputType = PREFERRED_OUTPUT_TYPE
    if (!blob || blob.type !== PREFERRED_OUTPUT_TYPE) {
      blob = await encodeCanvas(canvas, FALLBACK_OUTPUT_TYPE)
      outputType = FALLBACK_OUTPUT_TYPE
    }
    if (!blob) throw new Error("Image encoding failed")

    // The name is rebuilt from the output type rather than the input's: the
    // extension has to match what's actually in the bytes, or Storage stores a
    // WebP called .png and every consumer has to guess.
    const base = file.name.replace(/\.[^.]+$/, "") || "avatar"
    const extension = outputType === PREFERRED_OUTPUT_TYPE ? "webp" : "jpg"
    return new File([blob], `${base}.${extension}`, { type: outputType })
  } finally {
    // Frees the decoded bitmap immediately instead of waiting for GC — these
    // are full-resolution and can be tens of megabytes in memory.
    image.dispose()
  }
}
