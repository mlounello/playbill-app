"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = String(searchParams.get("next") ?? "");
  const mode = String(searchParams.get("mode") ?? "");
  const hideForContributorTask =
    pathname.startsWith("/contribute") || (pathname === "/login" && next.startsWith("/contribute/"));
  const hideForContributorPreview = pathname.startsWith("/programs/") && mode === "contributor-preview";

  if (hideForContributorTask || hideForContributorPreview) {
    return null;
  }

  return <>{children}</>;
}
