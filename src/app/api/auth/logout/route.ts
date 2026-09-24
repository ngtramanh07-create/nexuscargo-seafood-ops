import { error, ok } from "@/lib/api-fixture";
import { hasSupabaseConfig } from "@/lib/data-source";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(): Promise<Response> {
  if (!hasSupabaseConfig()) return error("INTERNAL_ERROR", "Supabase chưa được cấu hình.", 503);
  try {
    const client = await createUserClient();
    const { error: authError } = await client.auth.signOut();
    return authError ? error("INTERNAL_ERROR", "Không thể đăng xuất lúc này.", 500) : ok({ success: true });
  } catch {
    return error("INTERNAL_ERROR", "Không thể đăng xuất lúc này.", 500);
  }
}
