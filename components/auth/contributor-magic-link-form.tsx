"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function getCallbackUrl(nextPath: string) {
  const baseUrl = (window.location.origin || "").replace(/\/+$/, "");
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function ContributorMagicLinkForm({
  redirectTo,
  defaultEmail = ""
}: {
  redirectTo: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isDisabled = useMemo(() => loading || !email.trim(), [loading, email]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: getCallbackUrl(redirectTo) }
        }),
        15000,
        "Sending the magic link took too long. Please try again."
      );
      setMessage(error ? error.message : "Check your email. Your sign-in link is on the way.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send your sign-in link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card stack-sm auth-login-card contributor-entry-card">
      <h2 className="auth-login-title">Continue To Your Submission</h2>
      <p className="section-note">
        Enter the email address this request was assigned to. We&apos;ll send a sign-in link that brings you right back here.
      </p>
      <form className="stack-sm" onSubmit={onSubmit}>
        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@siena.edu"
            disabled={loading}
          />
        </label>
        <button type="submit" disabled={isDisabled}>
          {loading ? "Sending..." : "Email Me My Submission Link"}
        </button>
      </form>
      {message ? <p className="section-note">{message}</p> : null}
    </section>
  );
}
