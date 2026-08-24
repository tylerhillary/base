import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/server/session";
import { themeBootstrapScript } from "@/providers/theme-provider";

import "./globals.css";

/*
 * Fonts are fetched by `next/font` at compile time and cached under
 * `.next/cache`. Explicit fallbacks mean that if a fetch ever fails, text still
 * renders in a comparable system face instead of an arbitrary default —
 * `adjustFontFallback` (on by default) matches the metrics to limit layout shift.
 */
const bodyFont = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"]
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"]
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"]
});

/*
 * Every route in this app reads the session cookie in the root layout, so none
 * of them can be prerendered — the build output already marks them all dynamic.
 * Saying so explicitly stops Next attempting to collect page data for routes it
 * generates itself (notably /_not-found), which otherwise renders this layout
 * at build time on a machine that has no Firebase credentials.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "BASE-0 · Pickup sports, organised",
    template: "%s · BASE-0"
  },
  description:
    "Propose a game, let the community vote, and show up to a full roster. BASE-0 is community-run coordination for local pickup sports.",
  applicationName: "BASE-0",
  keywords: ["pickup sports", "local games", "football", "basketball", "community", "scheduling"],
  openGraph: {
    type: "website",
    siteName: "BASE-0",
    title: "BASE-0 · Pickup sports, organised",
    description:
      "Propose a game, let the community vote, and show up to a full roster."
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07080e" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" }
  ]
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Verified from the session cookie, so the first paint already knows who is
  // signed in — no auth flash and no client-side redirect on load.
  const user = await getCurrentUser();

  return (
    // The font variables live on <html> so `:root` can resolve them; on <body>
    // they would be out of scope for the token declarations in tokens.css.
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
      // Opts into Next's smooth-scroll handling for the rule set in base.css.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <a href="#main-content" className="u-visually-hidden">
          Skip to main content
        </a>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
