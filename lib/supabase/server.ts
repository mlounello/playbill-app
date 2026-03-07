import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAppSchema } from "@/lib/supabase";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // setAll can be called from Server Component contexts where cookie writes are disallowed.
          // Middleware refresh covers session propagation for those requests.
        }
      }
    }
  });
}

export async function createSupabaseServerDbClient() {
  const supabase = await createSupabaseServerClient();
  const schema = getAppSchema();
  return { supabase, db: supabase.schema(schema), schema };
}
