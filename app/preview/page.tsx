import type { Metadata } from "next";
import { HomeLanding } from "@/components/home-landing";

export const metadata: Metadata = {
  title: "Playbill Builder Preview",
  description: "Public homepage preview for embedding."
};

export default function PreviewPage() {
  return <HomeLanding />;
}
