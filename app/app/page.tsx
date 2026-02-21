import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/auth";

export default async function AdminRootPage() {
  const current = await getCurrentUserWithProfile();
  if (!current) {
    redirect("/app/login");
  }

  if (current.profile.platform_role === "contributor") {
    redirect("/contribute");
  }

  redirect("/app/shows");
}
