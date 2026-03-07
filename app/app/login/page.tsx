import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginOptionsForm } from "@/components/auth/login-options-form";
import { getCurrentUserWithProfile } from "@/lib/auth";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
        {error ? <div className="card card-error">{decodeURIComponent(error)}</div> : null}
        <LoginOptionsForm redirectTo="/app/shows" />
        <div className="top-actions">
          <Link href="/">Back Home</Link>
        </div>
      </div>
    </main>
  );
}
