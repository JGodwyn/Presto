"use client";

import * as React from "react";
import { Plugs, PlugsConnected, SpinnerGap } from "@phosphor-icons/react";

import { disconnectSocialAccount } from "@/app/projects/[projectId]/connections/actions";
import { ConnectedAccountRow } from "@/components/connections/connected-account-row";
import { PlatformRow } from "@/components/connections/platform-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Toast } from "@/components/ui/toast";
import type { LinkedInFailure } from "@/lib/linkedin/oauth";
import { withNetworkStatus } from "@/lib/network-status";
import { expiryStatus } from "@/lib/format-date";
import { cn } from "@/lib/utils";
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

// What the callback's `connect_error` codes say to the user. Nothing from
// LinkedIn's own error response reaches this — the codes are ours, so the copy
// can be specific about what to do without leaking protocol detail.
//
// "denied" is deliberately absent: cancelling on LinkedIn's consent screen is
// a decision, not a failure, and gets no toast.
const FAILURE_MESSAGES: Partial<Record<LinkedInFailure, string>> = {
  config: "LinkedIn isn't set up yet",
  session: "You need to be signed in to connect an account",
  project: "Couldn't find that project",
  state: "That connection attempt expired. Please try again",
  exchange: "LinkedIn couldn't complete the connection",
  profile: "Couldn't read your LinkedIn profile",
  save: "Couldn't save that connection. Please try again",
  network: "Couldn't reach LinkedIn. Check your connection and try again",
};

// The outcome the callback route reported in the URL, as a toast — or null
// when there's nothing to say.
//
// **Success is deliberately silent.** A connection that worked announces itself
// far better than a toast can: the row it just produced is right there, green,
// with the member's name and photo in it. The toast only ever restated what the
// page already showed, over the top of it.
function outcomeToast(
  connectError: string | null,
): { message: string; variant: "danger" } | null {
  if (connectError) {
    const message = FAILURE_MESSAGES[connectError as LinkedInFailure];
    if (message) return { message, variant: "danger" };
  }
  return null;
}

// Connecting is a full-page redirect out to LinkedIn's consent screen and back
// through the callback route, so it can't be a server action and there's no
// promise to await — the button's pending state ends when the browser leaves.
//
// Presto must not publish or schedule to a live account (AGENTS.md, "Hard
// constraint — publishing"), and nothing in this file or the routes behind it
// does: the token is requested with sign-in scopes only.
function ConnectionsPanel({
  projectId,
  accounts: initialAccounts,
  now,
  connected,
  connectError,
}: {
  projectId: string;
  accounts: ConnectedSocialAccount[];
  now: number;
  connected: string | null;
  connectError: string | null;
}) {
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [connecting, setConnecting] = React.useState<PostPlatform | null>(null);
  // The account the user has asked to disconnect but not yet confirmed. Holding
  // the account itself (not a boolean) means the modal can name it, and the
  // confirm handler can't act on a row that changed underneath it.
  const [pendingDisconnect, setPendingDisconnect] =
    React.useState<ConnectedSocialAccount | null>(null);
  // The callback route reports a failure in the URL, since a redirect is the
  // only channel it has — so the toast is *seeded from props at mount* rather
  // than raised by an effect. Arriving back from LinkedIn is always a fresh
  // document load, so mount is exactly when there is something to report, and
  // reading it here keeps the effect below to its one legitimate job (telling
  // an external system — the router — to drop the query params).
  const outcome = outcomeToast(connectError);
  // Split from the toast's own open/close lifecycle so the message doesn't
  // blank out mid-exit-animation — same reason as writing-style-card.tsx.
  const [toastOpen, setToastOpen] = React.useState(() => outcome !== null);
  const [toastMessage, setToastMessage] = React.useState(
    () => outcome?.message ?? "",
  );
  // Every toast this page raises is a failure — see outcomeToast.
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  };

  // Strip `?connected=` / `?connect_error=` once reported, so a reload (or a
  // shared link) doesn't raise the same toast forever. The state above already
  // holds what it needs, so losing the params costs nothing.
  //
  // `window.history.replaceState` rather than `router.replace`: both work
  // (checked — the toast survives either, since it's held in state rather than
  // read from the URL), but router.replace re-runs the server component and
  // refetches the whole segment purely to drop two query params. The native
  // call is supported by the App Router and syncs usePathname/useSearchParams
  // — see node_modules/next/dist/docs/01-app/01-getting-started/
  // 04-linking-and-navigating.md — with no round trip at all.
  React.useEffect(() => {
    if (!connected && !connectError) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [connected, connectError]);

  const connectedFor = (platform: PostPlatform) =>
    accounts.find((account) => account.platform === platform);

  const handleConnect = (platform: PostPlatform) => {
    setConnecting(platform);
    // Not router.push: the destination is a route handler that redirects to
    // linkedin.com, which is a document navigation the client router can't own.
    window.location.assign(
      `/api/connections/linkedin/authorize?projectId=${projectId}`,
    );
  };

  // Optimistic, per AGENTS.md's feedback convention: the row goes the instant
  // the disconnect is *confirmed* and comes back only if the delete actually
  // failed. The confirmation step doesn't change that — it moves the moment of
  // intent, not the moment of feedback, so there's still no spinner to show.
  const handleDisconnect = (account: ConnectedSocialAccount) => {
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));

    void withNetworkStatus(
      disconnectSocialAccount({ projectId, id: account.id }),
    ).then((result) => {
      if (result === null) {
        // The disconnected toast already explains this one; a second toast
        // would just be noise.
        setAccounts((prev) => [...prev, account]);
        return;
      }
      if ("error" in result) {
        setAccounts((prev) => [...prev, account]);
        showToast("Couldn't disconnect that account");
      }
    });
  };

  const pendingLabel =
    PLATFORMS.find(({ platform }) => platform === pendingDisconnect?.platform)
      ?.label ?? "account";

  const connectedCount = accounts.length;
  const activeCount = accounts.filter(
    (account) => expiryStatus(new Date(account.expiresAt), new Date(now)) !== "expired"
  ).length;

  // 312px in the export — wider than the 272px empty-state text above it, so
  // the rows keep their own width rather than inheriting the copy's measure.
  // The two exports space the list differently: dist-md with plain rows,
  // dist-lg once one of them is the taller connected block (green strip plus
  // its own expiry line below), which needs the extra air to read as one unit.
  const rows = (
    <div
      className={cn(
        "flex w-78 flex-col",
        connectedCount > 0 ? "gap-dist-lg" : "gap-dist-md",
      )}
    >
      {PLATFORMS.map(({ platform, label, available }) => {
        const account = connectedFor(platform);

        if (account) {
          return (
            <ConnectedAccountRow
              key={platform}
              account={account}
              label={label}
              now={new Date(now)}
              pending={connecting === platform}
              onDisconnect={() => setPendingDisconnect(account)}
              // Renewing *is* connecting: same authorize redirect, and
              // LinkedIn decides on its own whether to show the consent
              // screen (it skips it while the current token is still alive).
              // The callback's upsert replaces the row in place.
              onReconnect={() => handleConnect(platform)}
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
                  // Stays pending until the browser leaves for LinkedIn —
                  // there's no completion to wait for on this side.
                  disabled={connecting === platform}
                  onClick={() => handleConnect(platform)}
                  aria-label={`Connect ${label}`}
                >
                  {connecting === platform ? (
                    <SpinnerGap weight="bold" className="animate-spin" />
                  ) : (
                    "Connect"
                  )}
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

  return (
    <>
      {/* Same fixed top-center slot as the create-project/My-voice toasts. */}
      <div className="pointer-events-none fixed inset-x-0 top-pad-2xl z-50 flex justify-center">
        <Toast
          open={toastOpen}
          onOpenChange={setToastOpen}
          variant="danger"
          direction="top"
        >
          {toastMessage}
        </Toast>
      </div>

      <ConfirmationModal
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnect(null);
        }}
        // Plugs, not PlugsConnected: the icon should show the state the button
        // leads to, the way the Trash icon does on the delete-post modal.
        icon={<Plugs weight="bold" className="size-12 text-icon-minimal" />}
        // Copy per the copy-editor pass. "until you reconnect it" is doing the
        // job "You can't undo this" does on the delete-post modal, pointed the
        // opposite way: it states the reversibility as fact rather than
        // reassurance. The second sentence stays because "disconnect" beside a
        // red button is exactly where people fear for their content.
        title={`Disconnect ${pendingLabel}`}
        description="Presto will lose access to this account until you reconnect it. Your posts and drafts aren't affected."
        // Deliberately not repeating the title, unlike the delete-post modal:
        // in a card with one button and an X there's nothing to disambiguate,
        // and the shorter label keeps the button from reading heavier than the
        // act it performs.
        actionLabel="Disconnect"
        onConfirm={() => {
          if (pendingDisconnect) handleDisconnect(pendingDisconnect);
          setPendingDisconnect(null);
        }}
      />

      {/* Both exports draw the same three-part EmptyState layout — only the
          icon, the caption and the title change once something is connected
          ("Connect / Base" uses Plugs and a plain grey line; "Connection -
          connected" uses PlugsConnected and the green status pill). */}
      {connectedCount === 0 ? (
        <EmptyState
          icon={Plugs}
          caption="No connections yet"
          title="Presto can post directly to your social account. Start by connecting one"
          action={rows}
        />
      ) : (
        <EmptyState
          icon={PlugsConnected}
          caption={<ConnectionCountBadge count={activeCount} />}
          title="Presto can post directly to your social media account."
          action={rows}
        />
      )}
    </>
  );
}

// The export's "n connection(s) active" pill. Fully rounded (rad-rd), so it
// deliberately skips the squircle clip for the same reason toast.tsx does —
// corner smoothing needs a straight edge to blend into, and there isn't one.
//
// **It counts live connections, not rows.** The Expired frame still shows the
// green "1 connection active" pill over a red "Connection expired" strip,
// which is a leftover from duplicating the connected frame — an expired token
// is precisely what Presto *can't* use. At zero the pill keeps its shape and
// drops to the subtle palette rather than disappearing, so the page doesn't
// reflow between states.
function ConnectionCountBadge({ count }: { count: number }) {
  const none = count === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-dist-sm rounded-full px-pad-sm py-pad-2xs text-body-md-bold",
        none
          ? "bg-surface-2 text-text-subtle"
          : "bg-surface-success-light text-text-success"
      )}
    >
      {/* The export's 12px dot is a 3px *inside* stroke over a solid fill, so
          it reads as a ring: border-success-focused outside, surface-success
          in the middle. 3px is the one value here with no stroke token
          (foundations.json stops at 2px) — it's the export's literal weight. */}
      <span
        className={cn(
          "size-3 shrink-0 rounded-full border-[3px]",
          none
            ? "border-border-bold bg-icon-subtle"
            : "border-border-success-focused bg-surface-success"
        )}
      />
      {none
        ? "No connections active"
        : `${count} ${count === 1 ? "connection" : "connections"} active`}
    </span>
  );
}

export { ConnectionsPanel };
