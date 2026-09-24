import { developmentOnly, ok, pagination } from "@/lib/api-fixture";
import { getReviews, paginate } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbReviews } from "@/lib/db-read";

export async function GET(request: Request): Promise<Response> {
  if (!isFixtureMode()) return dbReviews(request);
  const denied = developmentOnly();
  if (denied) return denied;
  const params = pagination(new URL(request.url));
  if (params instanceof Response) return params;
  return ok(paginate(getReviews(), params.page, params.pageSize));
}
