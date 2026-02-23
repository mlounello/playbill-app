import Link from "next/link";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { getCurrentUserWithProfile } from "@/lib/auth";

export default async function AdminLoginPage() {
  const current = await getCurrentUserWithProfile();
  if (current) {
    if (current.profile.platform_role === "contributor") {
      redirect("/contribute");
    }
    redirect("/app/shows");
  }

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Admin Login</h1>
        <MagicLinkForm redirectTo="/app/shows" />
        <div className="top-actions">
          <Link href="/">Back Home</Link>
        </div>
      </div>
    </main>
  );
}
