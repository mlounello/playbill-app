import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseWriteClient } from "@/lib/supabase";

export type PlatformRole = "owner" | "admin" | "editor" | "contributor";

type UserProfile = {
  user_id: string;
  email: string;
  platform_role: PlatformRole;
};

async function ensureProfile(userId: string, email: string): Promise<UserProfile> {
  const adminClient = getSupabaseWriteClient();

  const { data: existing, error: existingError } = await adminClient
    .from("user_profiles")
    .select("user_id, email, platform_role")
    .eq("user_id", userId)
    .single();

  if (!existingError && existing) {
    return {
      user_id: String(existing.user_id),
      email: String(existing.email),
      platform_role: String(existing.platform_role) as PlatformRole
    };
  }

  const { count: totalProfiles } = await adminClient.from("user_profiles").select("user_id", { count: "exact", head: true });
  const initialRole: PlatformRole = (totalProfiles ?? 0) === 0 ? "owner" : "contributor";

  const { data: inserted, error: insertError } = await adminClient
    .from("user_profiles")
    .insert({ user_id: userId, email, platform_role: initialRole })
    .select("user_id, email, platform_role")
    .single();

  if (insertError || !inserted) {
    return { user_id: userId, email, platform_role: initialRole };
  }

  return {
    user_id: String(inserted.user_id),
    email: String(inserted.email),
    platform_role: String(inserted.platform_role) as PlatformRole
  };
}

export async function getCurrentUserWithProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const profile = await ensureProfile(user.id, user.email);
  return { user, profile };
}

export async function requireRole(allowed: PlatformRole[]) {
  const current = await getCurrentUserWithProfile();
  if (!current) {
    redirect("/app/login");
  }

  if (!allowed.includes(current.profile.platform_role)) {
    redirect("/app/unauthorized");
  }

  return current;
}
