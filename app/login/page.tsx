import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginOptionsForm } from "@/components/auth/login-options-form";
import { getCurrentUserWithProfile } from "@/lib/auth";

function sanitizeNextPath(rawNext: string | undefined) {
  const next = String(rawNext ?? "").trim();
  if (!next.startsWith("/")) {
    return "";
  }
  if (next.startsWith("//")) {
    return "";
  }
  return next;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; code?: string; next?: string }>;
}) {
  const { error, success, code, next } = await searchParams;
  const nextPath = sanitizeNextPath(next);

  if (code) {
    const callbackTarget = new URLSearchParams({ code });
    if (nextPath) {
      callbackTarget.set("next", nextPath);
    }
    redirect(`/auth/callback?${callbackTarget.toString()}`);
  }

  const current = await getCurrentUserWithProfile();

  if (current) {
    if (nextPath) {
      redirect(nextPath);
    }
    if (current.profile.platform_role === "contributor") {
      redirect("/contribute");
    }
    redirect("/app/shows");
  }

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Login</h1>
        {error ? <div className="card card-error">{decodeURIComponent(error)}</div> : null}
        {success ? <div className="card card-success">{decodeURIComponent(success)}</div> : null}
        <LoginOptionsForm redirectTo={nextPath || "/app/shows"} />
        <div className="top-actions">
          <Link href="/">Back Home</Link>
        </div>
      </div>
    </main>
  );
}
