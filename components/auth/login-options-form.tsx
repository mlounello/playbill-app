"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function getCallbackUrl(nextPath: string) {
  const baseUrl = (window.location.origin || "").replace(/\/+$/, "");
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function LoginOptionsForm({ redirectTo }: { redirectTo: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onGoogle = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const callback = getCallbackUrl(redirectTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback }
      });
      if (error) {
        setMessage(error.message);
        setLoading(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in.");
      setLoading(false);
    }
  };

  return (
    <section className="card stack-sm auth-login-card">
      <h2 className="auth-login-title">Staff Sign In</h2>
      <p className="section-note">Playbill staff and admins sign in with Google using a pre-approved account.</p>

      <button type="button" onClick={onGoogle} disabled={loading}>
        {loading ? "Redirecting..." : "Continue with Google"}
      </button>

      {message ? <p className="section-note">{message}</p> : null}
    </section>
  );
}
