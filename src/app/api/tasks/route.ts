import { developmentOnly, error, ok, pagination } from "@/lib/api-fixture";
import { getAllTasks, paginate, sortTasks } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbTasks } from "@/lib/db-read";
import type { TaskStatus } from "@/types/contracts";

const statuses: TaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

export async function GET(request: Request): Promise<Response> {
  if (!isFixtureMode()) return dbTasks(request);
  const denied = developmentOnly();
  if (denied) return denied;
  const url = new URL(request.url);
  const params = pagination(url);
  if (params instanceof Response) return params;
  const status = url.searchParams.get("status");
  const assigneeId = url.searchParams.get("assigneeId");
  if (status && !statuses.includes(status as TaskStatus)) return error("VALIDATION_ERROR", "status không hợp lệ.", 400);
  const filtered = getAllTasks().filter((item) => (!status || item.status === status) && (!assigneeId || item.assigneeId === assigneeId));
  return ok(paginate(sortTasks(filtered), params.page, params.pageSize));
}
