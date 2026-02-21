import { requireRole } from "@/lib/auth";

export default async function ContributorLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["owner", "admin", "editor", "contributor"]);
  return <>{children}</>;
}
