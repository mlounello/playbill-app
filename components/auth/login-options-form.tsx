"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PasswordMode = "signin" | "signup";

function getCallbackUrl(nextPath: string) {
  const baseUrl = (window.location.origin || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function LoginOptionsForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("signin");
  const [loadingMethod, setLoadingMethod] = useState<"magic" | "password" | "google" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isLoading = useMemo(() => loadingMethod !== null, [loadingMethod]);

  const onMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMethod("magic");
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getCallbackUrl(redirectTo) }
      });
      setMessage(error ? error.message : "Magic link sent. Check your email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send magic link.");
    } finally {
      setLoadingMethod(null);
    }
  };

  const onPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMethod("password");
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (passwordMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getCallbackUrl(redirectTo) }
        });
        setMessage(
          error ? error.message : "Account created. Check your email if confirmation is required, then sign in."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(error.message);
          setLoadingMethod(null);
          return;
        }
        window.location.assign(redirectTo);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not authenticate with email/password.");
    } finally {
      setLoadingMethod(null);
    }
  };

  const onGoogle = async () => {
    setLoadingMethod("google");
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
        setLoadingMethod(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in.");
      setLoadingMethod(null);
    }
  };

  return (
    <section className="card stack-sm auth-login-card">
      <h2 className="auth-login-title">Sign In</h2>
      <p className="section-note">Use magic link, password sign-in, or Google.</p>

      <form className="stack-sm" onSubmit={onMagicLink}>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@siena.edu"
            disabled={isLoading}
          />
        </label>
        <button type="submit" disabled={isLoading || !email.trim()}>
          {loadingMethod === "magic" ? "Sending..." : "Send Magic Link"}
        </button>
      </form>

      <div className="auth-divider" aria-hidden="true">
        <span>or</span>
      </div>

      <form className="stack-sm" onSubmit={onPassword}>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete={passwordMode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            minLength={6}
            disabled={isLoading}
          />
        </label>
        <div className="top-actions">
          <button
            type="button"
            className={`button-link${passwordMode === "signin" ? " is-active" : ""}`}
            onClick={() => setPasswordMode("signin")}
            disabled={isLoading}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`button-link${passwordMode === "signup" ? " is-active" : ""}`}
            onClick={() => setPasswordMode("signup")}
            disabled={isLoading}
          >
            Create Account
          </button>
        </div>
        <button type="submit" disabled={isLoading || !email.trim() || !password.trim()}>
          {loadingMethod === "password"
            ? "Working..."
            : passwordMode === "signup"
              ? "Create Account"
              : "Sign In with Password"}
        </button>
      </form>

      <button type="button" onClick={onGoogle} disabled={isLoading}>
        {loadingMethod === "google" ? "Redirecting..." : "Continue with Google"}
      </button>

      {message ? <p className="section-note">{message}</p> : null}
    </section>
  );
}
