/** Root Next.js layout: fonts, global CSS, and document shell. */
import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AssistantStartup } from "@/components/AssistantStartup";
import { MarketplaceRefreshOnLaunch } from "@/components/MarketplaceRefreshOnLaunch";

import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AthanorIDE",
  description:
    "Visual workbench for sandboxed agents, harnesses, and MCP servers — typed graphs, validation, and export.",
  applicationName: "AthanorIDE",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "AthanorIDE",
    description:
      "Visual workbench for sandboxed agents, harnesses, and MCP servers — typed graphs, validation, and export.",
    images: [{ url: "/logo.jpg", width: 1024, height: 1024, alt: "AthanorIDE" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} antialiased font-[family-name:var(--font-sans)]`}>
        <MarketplaceRefreshOnLaunch />
        <AssistantStartup>{children}</AssistantStartup>
      </body>
    </html>
  );
}
