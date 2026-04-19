"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function SiteHeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = String(searchParams.get("next") ?? "");
  const hideForPreview = pathname === "/preview";
  const hideForPublicDigitalPlaybill = pathname.startsWith("/p/") && searchParams.get("view") !== "flip";
  const hideForContributorTask =
    pathname.startsWith("/contribute") || (pathname === "/login" && next.startsWith("/contribute/"));

  if (hideForPreview || hideForPublicDigitalPlaybill || hideForContributorTask) {
    return null;
  }

  return <>{children}</>;
}
