import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playbill Builder",
  description: "Create printable and online theatre programs."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
