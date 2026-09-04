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
import { useConnectionLivenessCheck } from "@/hooks/use-connection-liveness";
import { withNetworkStatus } from "@/lib/network-status";
import { connectionStatus, isConnectionDead } from "@/lib/format-date";
import { ConnectionCountBadge } from "@/components/shared/connection-count-badge"
import { cn } from "@/lib/utils";
import type { PostPlatform } from "@/types/post";
import type { ConnectedSocialAccount } from "@/types/social-account";

// Figma "Connect / Base" lists LinkedIn first, X second, and drew X as plain
// "Coming soon" text. It is back to that.
//
// **X connecting works — this is a decision, not missing work.** The whole
// flow is built and exercised (OAuth 2.0 + PKCE, rotating refresh tokens,
// disconnect with revocation), and none of it is deleted. But publishing to X
// costs money, metered per app across every user of Presto, and the owner's
// decision was not to pay (see PUBLISHABLE_PLATFORMS, lib/post-publish.ts), so
// there is nothing a member could do with an X connection they cannot already
// do without one. Offering it would be offering half a feature.
//
// Flipping this back to `true` is all it takes to re-open connecting.
//
// The export writes "Linkedin"; the rest of the app writes "LinkedIn", so the
// brand casing is corrected here the same way the Content page's "it's" typo
// was.
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
//
// LinkedInFailure and XFailure carry identical codes, so one table serves both
// with the provider's name filled in — the callback route says which provider
// it was via `connect_error_platform`, and an absent one reads as LinkedIn,
// which is the only value the LinkedIn route has ever sent.
const failureMessages = (
  provider: string,
): Partial<Record<LinkedInFailure, string>> => ({
  config: `${provider} isn't set up yet`,
  session: "You need to be signed in to connect an account",
  project: "Couldn't find that project",
  state: "That connection attempt expired. Please try again",
  exchange: `${provider} couldn't complete the connection`,
  profile: `Couldn't read your ${provider} profile`,
  save: "Couldn't save that connection. Please try again",
  network: `Couldn't reach ${provider}. Check your connection and try again`,
});

// The outcome the callback route reported in the URL, as a toast — or null
// when there's nothing to say.
//
// **Success is deliberately silent.** A connection that worked announces itself
// far better than a toast can: the row it just produced is right there, green,
// with the member's name and photo in it. The toast only ever restated what the
// page already showed, over the top of it.
function outcomeToast(
  connectError: string | null,
  provider: string,
): { message: string; variant: "danger" } | null {
  if (connectError) {
    const message = failureMessages(provider)[connectError as LinkedInFailure];
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
  connectErrorPlatform,
}: {
  projectId: string;
  accounts: ConnectedSocialAccount[];
  now: number;
  connected: string | null;
  connectError: string | null;
  connectErrorPlatform: string | null;
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
  const outcome = outcomeToast(
    connectError,
    // The label carries the brand the copy should name. PLATFORMS is the one
    // place those live, so the toast can't drift from the row above it.
    PLATFORMS.find(({ platform }) => platform === connectErrorPlatform)?.label ??
      "LinkedIn",
  );
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
    // Not router.push: the destination is a route handler that redirects to the
    // provider's consent screen, which is a document navigation the client
    // router can't own. The two providers have parallel route pairs rather than
    // one parameterized route — see lib/x/oauth.ts on why they aren't merged.
    window.location.assign(
      `/api/connections/${platform}/authorize?projectId=${projectId}`,
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

  // A revoked connection can't be discovered from the row itself — only by
  // using the token. This asks in the background after mount and flips the row
  // to the dead treatment if the answer comes back revoked; see
  // useConnectionLivenessCheck. Nothing else about the page waits on it.
  const handleRevoked = React.useCallback((accountId: string) => {
    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? { ...account, status: "revoked" as const }
          : account
      )
    );
  }, []);

  useConnectionLivenessCheck({ accounts, projectId, onRevoked: handleRevoked });

  const connectedCount = accounts.length;
  // "n connections active" must not count a revoked one either — it stopped
  // working the moment access was removed at LinkedIn, however many days its
  // token nominally has left.
  const activeCount = accounts.filter(
    (account) =>
      !isConnectionDead(
        connectionStatus(
          new Date(account.expiresAt),
          account.status === "revoked",
          new Date(now)
        )
      )
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
              // An account connected before its platform was withdrawn keeps
              // its row — hiding a live connection with a stored token would
              // make real state invisible — but loses every control that would
              // *make* a connection. Keep it or remove it; you cannot renew it.
              // Same reasoning as the missing Connect button above.
              canReconnect={available}
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
                <span className="text-body-lg text-text-subtle">
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

export { ConnectionsPanel };
