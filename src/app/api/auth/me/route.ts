import { error, ok } from "@/lib/api-fixture";
import { requireReader } from "@/lib/db-read";

export async function GET(): Promise<Response> {
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { data: current, error: authError } = await context.db.auth.getUser();
  if (authError || !current.user) return error("UNAUTHENTICATED", "Vui lòng đăng nhập.", 401);
  const { data: membership, error: memberError } = await context.db.from("memberships")
    .select("role").eq("user_id", current.user.id).maybeSingle();
  if (memberError || !membership) return error("FORBIDDEN", "Tài khoản chưa được phân vào tổ chức.", 403);
  return ok({ id: current.user.id, email: current.user.email, role: membership.role });
}
