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
    ],
  },
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
