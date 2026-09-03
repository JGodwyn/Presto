import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // LinkedIn profile pictures (the OIDC `picture` claim), shown on the
      // connected account row. next/image refuses any remote host that isn't
      // listed here, so without this the connected row 400s on its avatar.
      //
      // **Both hosts are required.** LinkedIn's own Sign In with OpenID
      // Connect docs return the sample `picture` from media.licdn-ei.com,
      // while the rest of its media docs use media.licdn.com — so which one a
      // given member's photo comes back on is not ours to predict. Listing
      // only the second would have 400'd for an unlucky half of members.
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "media.licdn-ei.com" },
      // X's `profile_image_url`. Uploaded avatars come from pbs.twimg.com;
      // accounts that never set one fall back to X's default image on
      // abs.twimg.com, so both are needed for the same reason LinkedIn needs
      // two — which host a given member's photo is on is not ours to predict.
      //
      // An unlisted host is not a broken image: next/image *throws*, which
      // takes the whole server render down to the error boundary. That is how
      // this was found — a successful X connection rendered
      // "We couldn't load this page" while the row sat correctly in the
      // database.
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
    ],
  },
  // Next blocks cross-origin requests to dev-only assets by default, allowing
  // only the hostname the dev server was initialised with — `localhost`. The X
  // OAuth flow has to be exercised on 127.0.0.1, because X's console refuses to
  // register a callback on the hostname `localhost` at all (see LEARNINGS.md),
  // and without this the loopback IP loads a page whose images, client chunks
  // and dev toolbars are all silently refused: it renders, but nothing works.
  //
  // Development only — the option has no effect on a production build.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Powers the blur transition between the Generate page and the
    // Generating page (React's <ViewTransition>, used in
    // generate/page.tsx + generate/generating/page.tsx) — Next aliases in
    // the matching React/React DOM builds itself, no separate package
    // install needed. See node_modules/next/dist/docs/01-app/02-guides/
    // view-transitions.md.
    viewTransition: true,
  },
};

export default nextConfig;
