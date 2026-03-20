"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = String(searchParams.get("next") ?? "");
  const hideForContributorTask =
    pathname.startsWith("/contribute") || (pathname === "/login" && next.startsWith("/contribute/"));

  if (hideForContributorTask) {
    return null;
  }

  return <>{children}</>;
}
