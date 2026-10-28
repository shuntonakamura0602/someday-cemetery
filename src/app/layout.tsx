import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { RuntimeConfigProvider, type RuntimeConfig } from "@/components/runtime-config";
import { CemeteryProvider } from "@/components/cemetery-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publicRuntimeConfig } from "@/server/env";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || "http://127.0.0.1:3000"),
  title: {
    default: "Someday Cemetery — A resting place for unfinished things",
    template: "%s — Someday Cemetery",
  },
  description: "Choose a spot, write a few parting words, and lay an unfinished project to rest.",
  applicationName: "Someday Cemetery",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#111918",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const config = publicRuntimeConfig() as RuntimeConfig;
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <RuntimeConfigProvider value={config}>
          <CemeteryProvider>
            <div className="site-frame">
              <SiteHeader />
              <main id="main-content">{children}</main>
              <SiteFooter config={config} />
            </div>
          </CemeteryProvider>
        </RuntimeConfigProvider>
      </body>
    </html>
  );
}
