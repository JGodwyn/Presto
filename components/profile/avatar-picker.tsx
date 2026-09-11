"use client";

import * as React from "react";
import { PencilSimple, SpinnerGap } from "@phosphor-icons/react";

import { GradientAvatar } from "@/components/shared/gradient-avatar";
import { AvatarGradientPopover } from "@/components/profile/avatar-gradient-popover";
import { Toast } from "@/components/ui/toast";
import { ToastSlot } from "@/components/shared/toast-slot";
import {
  setAvatarGradientOverride,
  setAvatarOverride,
} from "@/lib/avatar-store";
import { MAX_SOURCE_BYTES, compressImage } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { isNetworkError } from "@/lib/network-error";
import { reportNetworkIssue } from "@/lib/network-status";
import { profileMetadataKeys } from "@/lib/user-profile-metadata";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// **The upload goes browser → Storage directly, not through a Server Action.**
// Next's Server Actions cap a request body at exactly 1MB (see AGENTS.md's
// note on the writing-style uploads, where that ceiling bit silently), which
// most photos straight off a phone exceed. The Supabase JS client talks to
// the Storage endpoint itself, so that limit never applies; the bucket's own
// 5MB limit is the real one.
export function AvatarPicker({
  userId,
  initialUrl,
  initialGradientId,
  size = 40,
  mobileSize,
}: {
  userId: string;
  initialUrl: string | null;
  initialGradientId: string | null;
  size?: number;
  mobileSize?: number;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState(initialUrl);
  const [gradientId, setGradientId] = React.useState(initialGradientId);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [toastOpen, setToastOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState("");

  const fail = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  };

  // Optimistic per AGENTS.md's feedback convention: the swatch takes effect on
  // the click and the save runs behind it. A gradient is a two-field write —
  // set the pick, clear the photo — because the photo is what outranks it, so
  // leaving it behind would make the choice look ignored.
  const handlePickGradient = async (id: string) => {
    const previousUrl = url;
    const previousGradient = gradientId;

    setGradientId(id);
    setUrl(null);
    setAvatarGradientOverride(id);
    setAvatarOverride(null);
    setPickerOpen(false);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        [profileMetadataKeys.avatarGradient]: id,
        [profileMetadataKeys.avatarUrl]: null,
        [profileMetadataKeys.avatarPhotoCleared]: true,
      },
    });

    if (error) {
      setGradientId(previousGradient);
      setUrl(previousUrl);
      setAvatarGradientOverride(previousGradient);
      setAvatarOverride(previousUrl);
      if (isNetworkError(error)) reportNetworkIssue();
      else fail("Couldn't change your picture");
      return;
    }

    // Only once the swap is saved: the old file is no longer referenced by
    // anything. Best-effort, same as on replace — an orphan isn't the user's
    // problem to hear about.
    if (previousUrl) {
      const oldPath = previousUrl.split("/avatars/")[1];
      if (oldPath) void supabase.storage.from("avatars").remove([oldPath]);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the *same* file again still fires a change
    // event — without this, re-choosing a rejected file does nothing.
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      fail("That file isn't an image Presto can use");
      return;
    }
    // Deliberately generous, because nothing this size is ever *stored* — it
    // only has to be decodable (see MAX_SOURCE_BYTES). Pick a 12MB photo and
    // it just works.
    if (file.size > MAX_SOURCE_BYTES) {
      fail("That image is too large to process");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    try {
      // **Always compressed before it leaves the browser.** An avatar is drawn
      // at 56px; storing the multi-megabyte original a phone hands over is
      // wasted bytes on every single page render. This resizes to 512px and
      // re-encodes as WebP, which is also why the extension below comes from
      // the *result* rather than what was picked.
      const compressed = await compressImage(file);

      // Owner-scoped path: the bucket's RLS requires the first segment to be
      // the caller's own uid. A phone commonly reaches the dev server through
      // an insecure HTTP LAN origin, where randomUUID is unavailable even
      // though desktop localhost is treated as secure. The timestamp/random
      // fallback preserves unique, cache-busting paths in that environment.
      const uploadId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const extension = compressed.name.split(".").pop() || "webp";
      const path = `${userId}/${uploadId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { contentType: compressed.type });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      // The URL lives in auth user_metadata rather than a table of ours: it
      // belongs to the person, not a project, and it rides along on the
      // session every page already reads.
      const previous = url;
      const { error: saveError } = await supabase.auth.updateUser({
        data: {
          [profileMetadataKeys.avatarUrl]: publicUrl,
          [profileMetadataKeys.avatarPhotoCleared]: false,
        },
      });
      if (saveError) throw saveError;

      setUrl(publicUrl);
      // Every other avatar in the app renders from a server component reading
      // user_metadata, which has no idea this just happened — publishing here
      // is what updates the navbar chip without a reload. See
      // lib/avatar-store.ts.
      setAvatarOverride(publicUrl);

      // Best-effort tidy-up so the bucket doesn't accumulate every picture a
      // user has ever had. A failure here is invisible on purpose — the new
      // avatar is already saved, and an orphaned file is not the user's
      // problem to hear about.
      if (previous) {
        const oldPath = previous.split("/avatars/")[1];
        if (oldPath) void supabase.storage.from("avatars").remove([oldPath]);
      }
    } catch (error) {
      if (isNetworkError(error)) reportNetworkIssue();
      else fail("Couldn't update your picture");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Portalled out of this card: the card carries a squircle clip-path,
          which would otherwise both position and crop this fixed toast to the
          card itself — see components/shared/toast-slot.tsx. */}
      <ToastSlot>
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="danger"
          direction="top"
          showIcon={false}
        >
          {toastMessage}
        </Toast>
      </ToastSlot>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={handleFile}
        className="hidden"
      />

      {/* The avatar is the popover's trigger, so tapping it opens the
          picker rather than jumping straight to the file dialog — uploading
          is now one option among the gradients, not the only one. */}
      <AvatarGradientPopover
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedGradientId={gradientId}
        hasPhoto={!!url}
        onPickGradient={(id) => void handlePickGradient(id)}
        onPickUpload={() => {
          setPickerOpen(false);
          inputRef.current?.click();
        }}
      >
        <button
          type="button"
          disabled={uploading}
          aria-label="Change your profile picture"
          style={
            {
              "--avatar-size": `${size}px`,
              "--avatar-mobile-size": `${mobileSize ?? size}px`,
            } as React.CSSProperties
          }
          className="group/avatar relative size-[var(--avatar-size)] shrink-0 cursor-pointer overflow-hidden rounded-full transition-[scale] duration-150 ease-out active:scale-[0.95] disabled:cursor-default max-md:size-[var(--avatar-mobile-size)]"
        >
          {url ? (
            // object-cover + a fixed square box is what centres any aspect ratio
            // in the circle: the image fills the frame and the overflow is
            // cropped equally on both sides rather than squashed.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="size-full object-cover object-center"
            />
          ) : (
            <GradientAvatar
              seed={userId}
              gradientId={gradientId}
              size={size}
              className="size-full"
            />
          )}

          {/* One overlay, shown on hover/focus and pinned on while an upload
            is in flight — the spinner has to stay visible after the pointer
            leaves. Opacity only, so there's nothing to get stuck in a
            half-state on touch. */}
          <span
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-inverse/60 text-text-inverse transition-opacity duration-150 ease",
              uploading
                ? "opacity-100"
                : "opacity-0 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100",
            )}
          >
            {uploading ? (
              <SpinnerGap weight="bold" className="size-1/2 animate-spin" />
            ) : (
              <PencilSimple weight="bold" className="size-1/2" />
            )}
          </span>
        </button>
      </AvatarGradientPopover>
    </>
  );
}
