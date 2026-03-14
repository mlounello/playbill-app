"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function getCallbackUrl(nextPath: string) {
  const baseUrl = (window.location.origin || "").replace(/\/+$/, "");
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
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
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getCallbackUrl(redirectTo) }
      });
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
