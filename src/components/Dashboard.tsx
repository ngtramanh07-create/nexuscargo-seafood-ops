"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PriorityBadge, statusLabels } from "@/components/StatusBadge";
import { getDashboard } from "@/lib/api/client";
import { formatDateTime, numberVi } from "@/lib/format";
import type { DashboardSummary, ShipmentStatus } from "@/types/contracts";

type LoadState = { state: "loading" } | { state: "error"; message: string } | { state: "success"; data: DashboardSummary };

const statuses: { key: ShipmentStatus; color: string; description: string }[] = [
  { key: "BLOCKED", color: "red", description: "Thiếu hoặc sai dữ liệu" },
  { key: "AT_RISK", color: "amber", description: "Cần theo dõi hạn chót" },
  { key: "READY", color: "teal", description: "Đủ điều kiện tiếp tục" },
  { key: "COMPLETED", color: "slate", description: "Đã hoàn tất" },
];

export function Dashboard() {
  const [requestKey, setRequestKey] = useState(0);
  const [result, setResult] = useState<LoadState>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getDashboard(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ state: "success", data }); },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ state: "error", message: error instanceof Error ? error.message : "Không thể lấy dữ liệu." });
      },
    );
    return () => controller.abort();
  }, [requestKey]);

  const data = result.state === "success" ? result.data : null;

  return (
    <AppShell>
      <div className="page-heading">
        <div><p className="eyebrow">TRUNG TÂM ĐIỀU PHỐI</p><h1>Tổng quan vận hành<span className="title-period">.</span></h1>
          <p className="page-subtitle">Nắm ngay lô nào cần chú ý và công việc nào phải xử lý trước.</p>
        </div>
        <Link href="/shipments" className="button button-primary">Xem danh sách lô <span aria-hidden="true">↗</span></Link>
      </div>

      {result.state === "error" ? (
        <div className="feedback-panel" role="alert"><span className="feedback-icon">!</span><h2>Chưa tải được số liệu</h2>
          <p>{result.message}</p><button className="button button-outline" onClick={() => { setResult({ state: "loading" }); setRequestKey((key) => key + 1); }}>Thử lại</button>
        </div>
      ) : (
        <>
          <div className="data-note"><span className="data-note-icon" aria-hidden="true">i</span>
            <span>{data ? `Dữ liệu giả lập tại ${formatDateTime(data.asOf)} (giờ Việt Nam).` : "Đang lấy dữ liệu giả lập..."} Các số liệu được lấy trực tiếp từ API mẫu.</span>
          </div>

          <div className="stats-grid" aria-busy={result.state === "loading"}>
            <div className="stat-card stat-main"><div className="stat-top"><span>Tổng đơn xuất khẩu</span><span className="stat-icon" aria-hidden="true">▦</span></div>
              {data ? <strong>{numberVi.format(data.totalOrders)}</strong> : <div className="skeleton skeleton-number" />}
              <span className="stat-foot">Tôm và cá tra đông lạnh</span></div>
            {statuses.slice(0, 3).map(({ key, color }) => (
              <Link href={`/shipments?status=${key}`} className={`stat-card stat-${color}`} key={key}>
                <div className="stat-top"><span>{statusLabels[key]}</span><span aria-hidden="true" className="stat-arrow">↗</span></div>
                {data ? <strong>{numberVi.format(data.statusCounts[key])}</strong> : <div className="skeleton skeleton-number" />}
                <span className="stat-foot">Xem các lô hàng <span aria-hidden="true">→</span></span>
              </Link>
            ))}
          </div>

          <div className="dashboard-grid">
            <section className="panel urgent-panel" aria-labelledby="urgent-title">
              <div className="panel-heading"><div><p className="eyebrow">CẦN HÀNH ĐỘNG</p><h2 id="urgent-title">Việc ưu tiên</h2></div>
                <span className="count-pill">{data ? numberVi.format(data.tasksDueSoon) : "…"} việc sắp đến mốc bắt đầu</span></div>
              <p className="panel-intro">Mốc “bắt đầu muộn nhất” và mức ưu tiên do hệ thống trả về. Danh sách có thể gồm cả việc đã quá hạn.</p>
              {result.state === "loading" ? (
                <div className="task-loading" aria-label="Đang tải công việc">{[1, 2, 3].map((key) => <div className="skeleton task-skeleton" key={key} />)}</div>
              ) : data?.urgentTasks.length ? (
                <div className="task-list">{data.urgentTasks.map((task, index) => (
                  <article className="task-row" key={task.id}>
                    <span className="task-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="task-body"><div className="task-title-line"><strong>{task.title}</strong><PriorityBadge priority={task.priority} /></div>
                      <p className="task-reason">{task.description}</p>
                      <div className="task-meta"><Link href={`/shipments/${encodeURIComponent(task.shipmentId)}`}>{task.orderNo} <span aria-hidden="true">↗</span></Link><span>·</span><span>Bắt đầu muộn nhất: {formatDateTime(task.latestStartAt)}</span><span>·</span><span>{task.assigneeName ?? "Chưa giao bộ phận"}</span></div>
                    </div>
                  </article>
                ))}</div>
              ) : <div className="empty-inline">Chưa có việc ưu tiên trong dữ liệu hiện tại.</div>}
            </section>

            <section className="panel status-panel" aria-labelledby="status-title">
              <div className="panel-heading"><div><p className="eyebrow">TÌNH HÌNH LÔ HÀNG</p><h2 id="status-title">Theo trạng thái</h2></div></div>
              <p className="panel-intro">Phân bố trạng thái của toàn bộ đơn xuất khẩu.</p>
              {data ? (
                <><div className="stacked-bar" aria-label="Tỉ lệ lô theo trạng thái">
                    {statuses.map(({ key, color }) => data.statusCounts[key] > 0 && <span key={key} className={`bar-${color}`} style={{ width: `${(data.statusCounts[key] / Math.max(data.totalOrders, 1)) * 100}%` }} title={`${statusLabels[key]}: ${data.statusCounts[key]}`} />)}
                  </div>
                  <div className="status-breakdown">{statuses.map(({ key, color, description }) => (
                    <Link href={`/shipments?status=${key}`} className="breakdown-row" key={key}>
                      <span className={`legend-dot dot-${color}`} /><span className="breakdown-label"><strong>{statusLabels[key]}</strong><small>{description}</small></span><strong className="breakdown-count">{numberVi.format(data.statusCounts[key])}</strong><span className="breakdown-arrow" aria-hidden="true">↗</span>
                    </Link>
                  ))}</div>
                  <div className="status-footer"><span>Tổng cộng</span><strong>{numberVi.format(data.totalOrders)} đơn</strong></div>
                </>
              ) : <><div className="skeleton skeleton-bar" />{[1, 2, 3, 4].map((key) => <div className="skeleton skeleton-breakdown" key={key} />)}</>}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
