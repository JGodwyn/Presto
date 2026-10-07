import type { Metadata } from "next";
import { Geist_Mono, Phudu } from "next/font/google";
import localFont from "next/font/local";
import { Agentation } from "agentation";
import { NetworkStatus } from "@/components/shared/network-status";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const openRunde = localFont({
  variable: "--font-open-runde",
  src: [
    {
      path: "./fonts/open-runde/OpenRunde-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/open-runde/OpenRunde-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/open-runde/OpenRunde-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const phudu = Phudu({
  variable: "--font-phudu",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// Icons and the social card are code-generated from the brand tokens:
// app/icon.tsx, app/apple-icon.tsx, app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openRunde.variable} ${geistMono.variable} ${phudu.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Every tooltip in the app hangs off this one Provider: without it
            Base UI resolves a trigger against its own 600ms default, and the
            app's delay lives in components/ui/tooltip.tsx. A nested Provider
            still overrides it for one group. */}
        <TooltipProvider>{children}</TooltipProvider>
        {/* Global: watches connectivity and shows the disconnected toast on
            any screen, signed in or out. */}
        <NetworkStatus />
        {process.env.NODE_ENV === "development" && (
          // Without `endpoint`, the toolbar silently falls back to
          // browser-local storage and never syncs to agentation-mcp — the
          // MCP server on this port is how the coding agent reads/resolves
          // annotations.
          <Agentation endpoint="http://localhost:4747" />
        )}
      </body>
    </html>
  );
}
