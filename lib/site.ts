// The one place the product's public name, pitch and origin live — read by
// the root layout's metadata and by the generated social card
// (app/opengraph-image.tsx), so a link preview can't drift from the tab title.
export const SITE_NAME = "Presto"
export const SITE_DESCRIPTION =
  "Generate, organize, and schedule your social media posts."

// metadataBase needs an absolute origin to turn the generated image routes
// into the fully-qualified URLs social crawlers require. Production is the
// custom domain (see AGENTS.md "Current status"); Vercel previews and local
// dev fall back to their own origins.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "production"
    ? "https://presto.godwinjohn.com"
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT ?? 3000}`)
