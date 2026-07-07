import type { Metadata } from "next";
import { Geist_Mono, Phudu } from "next/font/google";
import localFont from "next/font/local";
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
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Presto",
  description: "Generate, organize, and schedule social media posts.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
