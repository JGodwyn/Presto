"use client";

import * as React from "react";
import { Plugs } from "@phosphor-icons/react";

import { ConnectedAccountRow } from "@/components/connections/connected-account-row";
import { PlatformRow } from "@/components/connections/platform-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { PostPlatform } from "@/types/post";
import type { ConnectedSocialAccount } from "@/types/social-account";

// Figma "Connect / Base" lists LinkedIn first with a Connect button and X as
// plain "Coming soon" text — one row per platform, in that order. The export
// writes "Linkedin"; the rest of the app writes "LinkedIn", so the brand
// casing is corrected here the same way the Content page's "it's" typo was.
const PLATFORMS: {
  platform: PostPlatform;
  label: string;
  available: boolean;
}[] = [
  { platform: "linkedin", label: "LinkedIn", available: true },
  { platform: "x", label: "X (Twitter)", available: false },
];

// LinkedIn access tokens run ~60 days and a standard app can't silently
// refresh them, which is the whole reason the connected row shows an expiry.
// Preview-only: the real value comes from the token response's `expires_in`.
const PREVIEW_EXPIRY_DAYS = 60;
const MS_PER_DAY = 86_400_000;

// UI only, by request — **nothing here talks to LinkedIn and nothing is
// persisted**. "Connect" fills in a local placeholder account so the connected
// row can be seen; a reload clears it. When the real OAuth flow lands, this
// state comes from a social_accounts row and "Connect" becomes a redirect to
// LinkedIn's consent screen (which means it will also need the app's standard
// pending-state feedback — the click leaves the page, so the button should
// show it's working before the browser goes).
//
// Presto must not publish or schedule to a live account (AGENTS.md, "Hard
// constraint — publishing"), and nothing in this file does.
function ConnectionsPanel({ now }: { now: number }) {
  const [accounts, setAccounts] = React.useState<ConnectedSocialAccount[]>([]);

  const connectedFor = (platform: PostPlatform) =>
    accounts.find((account) => account.platform === platform);

  const handleConnect = (platform: PostPlatform) => {
    const connectedAt = new Date();
    setAccounts((prev) => [
      ...prev,
      {
        platform,
        accountName: "Godwin John",
        connectedAt: connectedAt.toISOString(),
        expiresAt: new Date(
          connectedAt.getTime() + PREVIEW_EXPIRY_DAYS * MS_PER_DAY,
        ).toISOString(),
      },
    ]);
  };

  const handleDisconnect = (platform: PostPlatform) => {
    setAccounts((prev) =>
      prev.filter((account) => account.platform !== platform),
    );
  };

  // 312px in the export — wider than the 272px empty-state text above it, so
  // the rows keep their own width rather than inheriting the copy's measure.
  const rows = (
    <div className="flex w-78 flex-col gap-dist-md">
      {PLATFORMS.map(({ platform, label, available }) => {
        const account = connectedFor(platform);

        if (account) {
          return (
            <ConnectedAccountRow
              key={platform}
              account={account}
              label={label}
              now={new Date(now)}
              onDisconnect={() => handleDisconnect(platform)}
            />
          );
        }

        return (
          <PlatformRow
            key={platform}
            platform={platform}
            label={label}
            action={
              available ? (
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => handleConnect(platform)}
                  aria-label={`Connect ${label}`}
                >
                  Connect
                </Button>
              ) : (
                <span className="text-body-md text-text-subtle">
                  Coming soon
                </span>
              )
            }
          />
        );
      })}
    </div>
  );

  // The export only covers the empty state, so the icon/caption/title come off
  // once something is connected rather than being rewritten into copy nobody
  // designed — the rows stay put and the header above them goes.
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Plugs}
        caption="No connections yet"
        title="Presto can post directly to your social account. Start by connecting one"
        action={rows}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      {rows}
    </div>
  );
}

export { ConnectionsPanel };
