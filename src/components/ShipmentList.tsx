"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { getShipments, type ShipmentFilters } from "@/lib/api/client";
import { formatDateTime, numberVi } from "@/lib/format";
import type { Page, ShipmentListItem } from "@/types/contracts";

type LoadState = { state: "loading" } | { state: "error"; message: string } | { state: "success"; data: Page<ShipmentListItem> };

const defaultFilters: ShipmentFilters = { search: "", product: "", status: "", sort: "urgency", page: 1, pageSize: 20 };

export function ShipmentList({ initialFilters }: { initialFilters: ShipmentFilters }) {
  const [filters, setFilters] = useState<ShipmentFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [result, setResult] = useState<LoadState>({ state: "loading" });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (filters.search !== searchInput.trim()) {
        setResult({ state: "loading" });
        setFilters({ ...filters, search: searchInput.trim(), page: 1 });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters]);

  useEffect(() => {
    const controller = new AbortController();
    getShipments(filters, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ state: "success", data }); },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ state: "error", message: error instanceof Error ? error.message : "Không thể lấy dữ liệu." });
      },
    );
    return () => controller.abort();
  }, [filters, requestKey]);

  const data = result.state === "success" ? result.data : null;
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const hasFilters = Boolean(filters.search || filters.product || filters.status || filters.sort !== "urgency");

  function updateFilter(patch: Partial<ShipmentFilters>) {
    setResult({ state: "loading" });
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  }

  function clearFilters() {
    setResult({ state: "loading" });
    setSearchInput("");
    setFilters(defaultFilters);
  }

  function goToPage(page: number) {
    setResult({ state: "loading" });
    setFilters((current) => ({ ...current, page }));
  }

  return (
    <AppShell>
      <div className="page-heading list-heading"><div><p className="eyebrow">QUẢN LÝ XUẤT KHẨU</p>
        <h1>Danh sách lô hàng<span className="title-period">.</span></h1>
        <p className="page-subtitle">Tra cứu đơn, theo dõi mốc SI, CY và lý do cần xử lý.</p>
      </div><span className="heading-note">Dữ liệu giả lập · Tôm & cá tra</span></div>

      <section className="panel filter-panel" aria-label="Tìm kiếm và bộ lọc lô hàng">
        <div className="search-wrap"><label htmlFor="shipment-search">Tìm mã đơn hoặc booking</label>
          <div className="input-with-icon"><span aria-hidden="true">⌕</span><input id="shipment-search" type="search" placeholder="Ví dụ: EXP-2026-0001, BK-SF-0001" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
        </div>
        <div className="select-wrap"><label htmlFor="product-filter">Nhóm hàng</label><select id="product-filter" value={filters.product} onChange={(event) => updateFilter({ product: event.target.value as ShipmentFilters["product"] })}>
            <option value="">Tất cả nhóm hàng</option><option value="SHRIMP">Tôm đông lạnh</option><option value="PANGASIUS">Cá tra đông lạnh</option></select></div>
        <div className="select-wrap"><label htmlFor="status-filter">Trạng thái</label><select id="status-filter" value={filters.status} onChange={(event) => updateFilter({ status: event.target.value as ShipmentFilters["status"] })}>
            <option value="">Tất cả trạng thái</option><option value="BLOCKED">Cần xử lý</option><option value="AT_RISK">Có nguy cơ trễ</option><option value="READY">Sẵn sàng</option><option value="COMPLETED">Đã hoàn tất</option></select></div>
        <div className="select-wrap"><label htmlFor="sort-filter">Sắp xếp</label><select id="sort-filter" value={filters.sort} onChange={(event) => updateFilter({ sort: event.target.value as ShipmentFilters["sort"] })}>
            <option value="urgency">Ưu tiên xử lý</option><option value="etd">Ngày tàu chạy (ETD)</option></select></div>
        {hasFilters && <button className="clear-button" type="button" onClick={clearFilters}>Xóa bộ lọc</button>}
      </section>

      <section className="panel list-panel" aria-labelledby="list-title" aria-busy={result.state === "loading"}>
        <div className="list-toolbar"><div><p className="eyebrow">DANH SÁCH TỪ API</p><h2 id="list-title">Các lô hàng <span className="total-pill">{data ? numberVi.format(data.total) : "…"}</span></h2></div>
          <span className="list-range">{data && data.total ? `Hiển thị ${numberVi.format((data.page - 1) * data.pageSize + 1)}–${numberVi.format((data.page - 1) * data.pageSize + data.items.length)} / ${numberVi.format(data.total)}` : "20 lô mỗi trang"}</span>
        </div>

        {result.state === "error" ? <div className="feedback-panel in-panel" role="alert"><span className="feedback-icon">!</span><h3>Chưa tải được danh sách</h3><p>{result.message}</p>
          <button className="button button-outline" onClick={() => { setResult({ state: "loading" }); setRequestKey((key) => key + 1); }}>Thử lại</button></div>
        : result.state === "loading" ? <div className="table-loading" aria-label="Đang tải lô hàng">{[1, 2, 3, 4, 5].map((key) => <div className="skeleton table-skeleton" key={key} />)}</div>
        : !data?.items.length ? <div className="feedback-panel in-panel"><span className="empty-icon" aria-hidden="true">⌕</span><h3>Không tìm thấy lô hàng</h3>
            <p>Thử mã đơn hoặc booking khác, hoặc bỏ bớt bộ lọc.</p><button className="button button-outline" onClick={clearFilters}>Xóa bộ lọc</button></div>
        : <div className="table-scroll"><table className="shipment-table"><thead><tr><th scope="col">Mã đơn / Booking</th><th scope="col">Hàng & điểm đến</th><th scope="col">Trạng thái</th><th scope="col">Lý do cần chú ý</th><th scope="col">Cutoff SI / CY</th><th scope="col">Bộ phận xử lý</th></tr></thead>
            <tbody>{data.items.map((shipment) => (
              <tr key={shipment.id}>
                <td data-label="Mã đơn / Booking"><Link className="order-code" href={`/shipments/${encodeURIComponent(shipment.id)}`}>{shipment.orderNo} ↗</Link><span className="minor-line">{shipment.bookingNo ?? "Chưa có booking"} · {shipment.containerCount} container</span></td>
                <td data-label="Hàng & điểm đến"><strong>{shipment.product === "SHRIMP" ? "Tôm đông lạnh" : "Cá tra đông lạnh"}</strong><span className="minor-line">{shipment.destination ?? "Chưa có thông tin"}</span></td>
                <td data-label="Trạng thái"><StatusBadge status={shipment.status} /><span className="priority-line"><PriorityBadge priority={shipment.priority} /></span></td>
                <td data-label="Lý do cần chú ý" className="risk-cell">{shipment.riskReasons.length ? <><span>{shipment.riskReasons[0]}</span>{shipment.riskReasons.length > 1 && <span className="minor-line">+{shipment.riskReasons.length - 1} lý do khác</span>}</> : <span className="quiet-text">Không có cảnh báo</span>}</td>
                <td data-label="Cutoff SI / CY"><span className="date-line"><b>SI</b> {formatDateTime(shipment.cutoffs.si)}</span><span className="date-line"><b>CY</b> {formatDateTime(shipment.cutoffs.cy)}</span></td>
                <td data-label="Bộ phận xử lý">{shipment.assigneeName ?? <span className="quiet-text">Không có việc đang mở</span>}</td>
              </tr>
            ))}</tbody></table></div>}

        {data && data.total > 0 && <div className="pagination"><span>Trang {numberVi.format(data.page)} / {numberVi.format(pages)}</span><div className="pagination-buttons">
          <button type="button" className="page-button" disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>← Trước</button>
          <button type="button" className="page-button" disabled={data.page >= pages} onClick={() => goToPage(data.page + 1)}>Sau →</button>
        </div></div>}
      </section>
    </AppShell>
  );
}
