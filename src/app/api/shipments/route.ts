import { developmentOnly, error, ok, pagination } from "@/lib/api-fixture";
import { paginate, shipments, sortShipments, toListItem } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbShipments } from "@/lib/db-read";
import type { Product, ShipmentStatus } from "@/types/contracts";

const products: Product[] = ["SHRIMP", "PANGASIUS"];
const statuses: ShipmentStatus[] = ["READY", "AT_RISK", "BLOCKED", "COMPLETED"];

export async function GET(request: Request): Promise<Response> {
  if (!isFixtureMode()) return dbShipments(request);
  const denied = developmentOnly();
  if (denied) return denied;
  const url = new URL(request.url);
  const params = pagination(url);
  if (params instanceof Response) return params;
  const product = url.searchParams.get("product");
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort") ?? "urgency";
  if (product && !products.includes(product as Product)) return error("VALIDATION_ERROR", "product không hợp lệ.", 400);
  if (status && !statuses.includes(status as ShipmentStatus)) return error("VALIDATION_ERROR", "status không hợp lệ.", 400);
  if (sort !== "urgency" && sort !== "etd") return error("VALIDATION_ERROR", "sort không hợp lệ.", 400);
  const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("vi-VN");
  const filtered = shipments.filter(
    (item) =>
      (!product || item.product === product) &&
      (!status || item.status === status) &&
      (!search || item.orderNo.toLocaleLowerCase("vi-VN").includes(search) || item.bookingNo?.toLocaleLowerCase("vi-VN").includes(search)),
  );
  return ok(paginate(sortShipments(filtered, sort).map(toListItem), params.page, params.pageSize));
}
