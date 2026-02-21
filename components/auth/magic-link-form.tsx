"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function MagicLinkForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callback
        }
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Magic link sent. Check your email.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card grid" onSubmit={onSubmit}>
      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@siena.edu"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send Magic Link"}
      </button>

      {message ? <p style={{ margin: 0 }}>{message}</p> : null}
    </form>
  );
}
