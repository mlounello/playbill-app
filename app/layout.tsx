import type { Metadata } from "next";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
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
        <SiteHeader />
        <GlobalLoadingOverlay />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
