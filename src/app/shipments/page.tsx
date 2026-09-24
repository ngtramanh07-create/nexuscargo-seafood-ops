import { ShipmentList } from "@/components/ShipmentList";
import type { ShipmentFilters } from "@/lib/api/client";
import type { Product, ShipmentStatus } from "@/types/contracts";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ShipmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const product = first(query.product);
  const status = first(query.status);
  const sort = first(query.sort);
  const page = Number(first(query.page));
  const initialFilters: ShipmentFilters = {
    search: first(query.search),
    product: (["SHRIMP", "PANGASIUS"] as string[]).includes(product) ? product as Product : "",
    status: (["READY", "AT_RISK", "BLOCKED", "COMPLETED"] as string[]).includes(status) ? status as ShipmentStatus : "",
    sort: sort === "etd" ? "etd" : "urgency",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 20,
  };
  return <ShipmentList key={JSON.stringify(initialFilters)} initialFilters={initialFilters} />;
}
