import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { RuntimeConfigProvider, type RuntimeConfig } from "@/components/runtime-config";
import { CemeteryProvider } from "@/components/cemetery-provider";
import { LanguageProvider } from "@/components/language-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { t } from "@/domain/copy";
import { getServerLocale } from "@/i18n/server";
import { publicRuntimeConfig } from "@/server/env";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    metadataBase: new URL(process.env.APP_BASE_URL || "http://127.0.0.1:3000"),
    title: {
      default: `Someday Cemetery — ${t("home.tagline", locale)}`,
      template: "%s — Someday Cemetery",
    },
    description: locale === "ja"
      ? "場所を選び、短い別れの言葉を書いて、未完成のプロジェクトを静かに眠らせる場所。"
      : "Choose a spot, write a few parting words, and lay an unfinished project to rest.",
    applicationName: "Someday Cemetery",
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#111918",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getServerLocale();
  const config = publicRuntimeConfig() as RuntimeConfig;
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <LanguageProvider locale={locale}>
          <RuntimeConfigProvider value={config}>
            <CemeteryProvider>
              <div className="site-frame">
                <SiteHeader />
                <main id="main-content">{children}</main>
                <SiteFooter config={config} />
              </div>
            </CemeteryProvider>
          </RuntimeConfigProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
