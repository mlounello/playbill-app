import type { Metadata } from "next";
import { Suspense } from "react";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { SiteHeaderShell } from "@/components/site-header-shell";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playbill Builder",
  description: "Create printable and online theatre programs."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Suspense fallback={null}>
          <SiteHeaderShell>
            <SiteHeader />
          </SiteHeaderShell>
        </Suspense>
        <Suspense fallback={null}>
          <GlobalLoadingOverlay />
        </Suspense>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
