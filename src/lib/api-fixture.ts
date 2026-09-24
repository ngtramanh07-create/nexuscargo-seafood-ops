import type { ApiErrorCode, Page } from "@/types/contracts";

export function error(code: ApiErrorCode, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Never expose the unauthenticated teaching fixture on Vercel/production. */
export function developmentOnly(): Response | null {
  if (process.env.NODE_ENV === "development" && process.env.DEMO_API_ENABLED !== "false") return null;
  return error("FORBIDDEN", "API dữ liệu mẫu chỉ dùng khi phát triển cục bộ.", 403);
}

export function pagination(url: URL): { page: number; pageSize: number } | Response {
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return error("VALIDATION_ERROR", "page phải >= 1 và pageSize phải từ 1 đến 50.", 400);
  }
  return { page, pageSize };
}

export function ok<T>(data: T | Page<T>): Response {
  return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
}
