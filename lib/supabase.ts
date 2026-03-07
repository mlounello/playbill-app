import { createClient } from "@supabase/supabase-js";

export function getAppSchema() {
  return (
    process.env.APP_SCHEMA ||
    process.env.NEXT_PUBLIC_APP_SCHEMA ||
    process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA ||
    "app_playbill"
  );
}

export const APP_SCHEMA = getAppSchema();
export const APP_ID = process.env.APP_ID || "playbill";

export function getSupabaseProjectRef(url: string) {
  try {
    const hostname = new URL(url).hostname;
    const projectRef = hostname.split(".")[0]?.trim();
    if (!projectRef) {
      return null;
    }
    return projectRef;
  } catch {
    return null;
  }
}

export function getSupabaseAuthCookieName(url: string) {
  const projectRef = getSupabaseProjectRef(url);
  return projectRef ? `sb-${projectRef}-auth-token` : null;
}

export function getMissingSupabaseEnvVars() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  return required.filter((name) => !process.env[name]);
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseWriteClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
    db: { schema: APP_SCHEMA }
  });
}

export function getSupabaseReadClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
    db: { schema: APP_SCHEMA }
  });
}

export function getSupabaseWriteClientRaw() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
}

export function getSupabaseReadClientRaw() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false }
  });
}
