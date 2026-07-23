import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
