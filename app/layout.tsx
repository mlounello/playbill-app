import type { Metadata } from "next";
import { Suspense } from "react";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { SiteHeaderShell } from "@/components/site-header-shell";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbillapp.mlounello.com"),
  title: "Playbill App",
  applicationName: "Playbill App",
  description: "Create polished printable and online theatre programs.",
  icons: {
    icon: [{ url: "/brand/playbill-app-icon.png", type: "image/png" }],
    shortcut: "/brand/playbill-app-icon.png",
    apple: "/brand/playbill-app-icon.png"
  },
  openGraph: {
    title: "Playbill App",
    description: "Create polished printable and online theatre programs.",
    images: [
      {
        url: "/brand/playbill-app-square.png",
        width: 1200,
        height: 1200,
        alt: "Playbill App"
      }
    ]
  }
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
