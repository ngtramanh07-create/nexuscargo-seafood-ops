import type { ApiErrorCode, Page } from "@/types/contracts";
import { isPublicDemoMode } from "@/lib/data-source";

export function error(code: ApiErrorCode, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Fixture writes stay limited to local development, even in public demo mode. */
export function developmentOnly(): Response | null {
  if (process.env.NODE_ENV === "development" && process.env.DEMO_API_ENABLED !== "false") return null;
  return error("FORBIDDEN", "API dữ liệu mẫu chỉ dùng khi phát triển cục bộ.", 403);
}

/** Only synthetic fixture reads are available without login in the public demo. */
export function fixtureReadAllowed(): Response | null {
  return isPublicDemoMode() ? null : developmentOnly();
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
