import { error, ok } from "@/lib/api-fixture";
import { hasSupabaseConfig } from "@/lib/data-source";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<Response> {
  if (!hasSupabaseConfig()) return error("INTERNAL_ERROR", "Supabase chưa được cấu hình.", 503);
  let input: unknown;
  try { input = await request.json(); }
  catch { return error("VALIDATION_ERROR", "Body phải là JSON hợp lệ.", 400); }
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email.includes("@") || !body.password) {
    return error("VALIDATION_ERROR", "Cần email và mật khẩu hợp lệ.", 400);
  }
  try {
    const client = await createUserClient();
    const { data, error: authError } = await client.auth.signInWithPassword({ email: body.email, password: body.password });
    if (authError || !data.user) return error("UNAUTHENTICATED", "Email hoặc mật khẩu không đúng.", 401);
    const { data: membership, error: memberError } = await client.from("memberships")
      .select("org_id, role").eq("user_id", data.user.id).maybeSingle();
    if (memberError) return error("INTERNAL_ERROR", "Không kiểm tra được quyền truy cập.", 500);
    if (!membership) {
      await client.auth.signOut();
      return error("FORBIDDEN", "Tài khoản chưa được phân vào tổ chức.", 403);
    }
    return ok({ id: data.user.id, email: data.user.email, role: membership.role });
  } catch {
    return error("INTERNAL_ERROR", "Không thể đăng nhập lúc này.", 500);
  }
}
