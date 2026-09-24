"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DemoNotice } from "@/components/DemoNotice";
import { PriorityBadge } from "@/components/StatusBadge";
import { performTaskUpdate, isMockWriteMode } from "@/lib/api/actions";
import { getAssignees, getShipment, getTasks } from "@/lib/api/client";
import { previewShipment, previewTask, useMockRevision } from "@/lib/api/mock";
import { formatDateTime, numberVi } from "@/lib/format";
import { documentTypeLabels, taskStatusLabels } from "@/lib/labels";
import type { AssigneeOption, ShipmentDetail, Task, TaskStatus } from "@/types/contracts";

type LoadState = { state: "loading" } | { state: "error"; message: string } | { state: "success"; tasks: Task[]; assignees: AssigneeOption[] };
type FilterStatus = TaskStatus | "ALL";
const pageSize = 10;

async function fetchAllTasks(signal: AbortSignal): Promise<Task[]> {
  const first = await getTasks({ page: 1, pageSize: 50 }, signal);
  const pageCount = Math.ceil(first.total / 50);
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => getTasks({ page: index + 2, pageSize: 50 }, signal)));
  return [first, ...rest].flatMap((page) => page.items);
}

export function TasksView() {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  useMockRevision();

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchAllTasks(controller.signal), getAssignees(controller.signal)]).then(
      ([tasks, assignees]) => { if (!controller.signal.aborted) setLoad({ state: "success", tasks, assignees }); },
      (error: unknown) => { if (!controller.signal.aborted) setLoad({ state: "error", message: error instanceof Error ? error.message : "Không tải được công việc." }); },
    );
    return () => controller.abort();
  }, [reloadKey]);

  const allTasks = load.state === "success" ? load.tasks.map(previewTask) : [];
  const counts = { ALL: allTasks.length, OPEN: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const task of allTasks) counts[task.status] += 1;
  const filtered = allTasks.filter((task) => (statusFilter === "ALL" || task.status === statusFilter) && (!assigneeFilter || task.assigneeId === assigneeFilter));
  const pages = Math.ceil(filtered.length / pageSize);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function changeStatus(status: FilterStatus) { setStatusFilter(status); setPage(1); setSelectedTaskId(null); }

  return <AppShell>
    <div className="page-heading"><div><p className="eyebrow">ĐIỀU PHỐI HÀNH ĐỘNG</p><h1>Công việc<span className="title-period">.</span></h1>
      <p className="page-subtitle">Theo dõi bộ phận xử lý, hạn công việc và chứng từ làm bằng chứng.</p></div>
      <Link href="/shipments" className="button button-outline">Xem lô hàng ↗</Link>
    </div>
    <DemoNotice />
    {load.state === "error" ? <div className="feedback-panel" role="alert"><span className="feedback-icon">!</span><h2>Chưa tải được công việc</h2><p>{load.message}</p><button className="button button-outline" onClick={() => { setLoad({ state: "loading" }); setReloadKey((key) => key + 1); }}>Thử lại</button></div>
    : load.state === "loading" ? <div className="panel detail-loading"><div className="skeleton task-skeleton" /><div className="skeleton task-skeleton" /><div className="skeleton task-skeleton" /></div>
    : <>
      <div className="workflow-stats"><div><strong>{numberVi.format(counts.ALL)}</strong><span>Tổng công việc</span></div><div><strong>{numberVi.format(counts.OPEN)}</strong><span>Chưa làm</span></div><div><strong>{numberVi.format(counts.IN_PROGRESS)}</strong><span>Đang xử lý</span></div><div><strong>{numberVi.format(counts.DONE)}</strong><span>Đã hoàn tất</span></div></div>
      <section className="panel workflow-panel"><div className="workflow-toolbar"><div className="tabs" role="group" aria-label="Lọc trạng thái công việc">
        {(["ALL", "OPEN", "IN_PROGRESS", "DONE"] as FilterStatus[]).map((status) => <button key={status} type="button" className={`tab ${statusFilter === status ? "selected" : ""}`} aria-pressed={statusFilter === status} onClick={() => changeStatus(status)}>{status === "ALL" ? "Tất cả" : taskStatusLabels[status]} <span>{counts[status]}</span></button>)}
        </div><div className="workflow-filter"><label htmlFor="assignee-filter">Bộ phận xử lý</label><select id="assignee-filter" value={assigneeFilter} onChange={(event) => { setAssigneeFilter(event.target.value); setPage(1); setSelectedTaskId(null); }}><option value="">Tất cả bộ phận</option>{load.assignees.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div></div>
        <div className="workflow-count">Hiển thị {filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}` : "0"} / {numberVi.format(filtered.length)} công việc</div>
        {visible.length ? <div className="work-items">{visible.map((task) => <article className="work-item" key={task.id}>
          <div className="work-head"><div><Link className="work-order" href={`/shipments/${encodeURIComponent(task.shipmentId)}`}>{task.orderNo} ↗</Link><h2>{task.title}</h2></div><div className="work-badges"><span className={`task-chip task-${task.status.toLowerCase()}`}>{taskStatusLabels[task.status]}</span><PriorityBadge priority={task.priority} /></div></div>
          <p className="work-description">{task.description}</p>
          <div className="work-meta"><span><b>Bộ phận xử lý</b>{task.assigneeName ?? "Chưa giao"}</span><span><b>Bắt đầu muộn nhất</b>{formatDateTime(task.latestStartAt)}</span><span><b>Hạn xử lý</b>{formatDateTime(task.dueAt)}</span><span><b>Kiểm tra nguồn</b>{task.sourceCheckCode}</span></div>
          {task.status !== "DONE" && task.latestStartAt && <p className="evidence-line"><strong>{task.dueAt && Date.parse(task.dueAt) < Date.parse("2026-10-06T02:00:00.000Z") ? "Đã quá hạn xử lý" : Date.parse(task.latestStartAt) < Date.parse("2026-10-06T02:00:00.000Z") ? "Đã quá giờ bắt đầu muộn nhất" : Date.parse(task.latestStartAt) < Date.parse("2026-10-07T02:00:00.000Z") ? "Sắp đến giờ bắt đầu muộn nhất" : "Còn thời gian chuẩn bị"}</strong> · theo mốc dữ liệu demo 06/10/2026, 09:00 (giờ Việt Nam)</p>}
          {task.status === "DONE" && <p className="evidence-line">Bằng chứng: {task.evidenceDocumentId ?? "Chưa có"}{task.completionNote ? ` · ${task.completionNote}` : ""}</p>}
          <div className="work-footer"><span>Phiên bản {task.version} · Cập nhật {formatDateTime(task.updatedAt)}</span><button type="button" className="text-link" aria-expanded={selectedTaskId === task.id} onClick={() => setSelectedTaskId((current) => current === task.id ? null : task.id)}>{selectedTaskId === task.id ? "Đóng thao tác ↑" : "Xử lý công việc ↓"}</button></div>
          {selectedTaskId === task.id && <TaskActionPanel task={task} assignees={load.assignees} onUpdated={(updated) => {
            setStatusFilter(updated.status); setAssigneeFilter(""); setPage(1);
            if (!isMockWriteMode) { setLoad({ state: "loading" }); setReloadKey((key) => key + 1); }
          }} />}
        </article>)}</div>
        : <div className="feedback-panel in-panel"><span className="empty-icon">☷</span><h3>Chưa có công việc phù hợp</h3><p>Thử chọn trạng thái hoặc người phụ trách khác.</p><button className="button button-outline" onClick={() => { setStatusFilter("ALL"); setAssigneeFilter(""); setPage(1); }}>Xem tất cả</button></div>}
        {filtered.length > pageSize && <div className="pagination"><span>Trang {page} / {pages}</span><div className="pagination-buttons"><button className="page-button" disabled={page <= 1} onClick={() => { setPage(page - 1); setSelectedTaskId(null); }}>← Trước</button><button className="page-button" disabled={page >= pages} onClick={() => { setPage(page + 1); setSelectedTaskId(null); }}>Sau →</button></div></div>}
      </section>
    </>}
  </AppShell>;
}

function TaskActionPanel({ task, assignees, onUpdated }: { task: Task; assignees: AssigneeOption[]; onUpdated: (task: Task) => void }) {
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [evidenceId, setEvidenceId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useMockRevision();

  useEffect(() => {
    const controller = new AbortController();
    getShipment(task.shipmentId, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setDetail(data); },
      (error: unknown) => { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "Không tải được chứng từ."); },
    );
    return () => controller.abort();
  }, [task.shipmentId]);

  const shipment = detail && previewShipment(detail);
  const evidenceOptions = shipment?.documents.filter((doc) => doc.status === "VERIFIED") ?? [];

  async function act(action: "ASSIGN" | "START" | "COMPLETE") {
    if (!shipment) return;
    setBusy(true); setMessage("");
    try {
      const request = action === "ASSIGN" ? { action, expectedVersion: task.version, assigneeId } as const
        : action === "START" ? { action, expectedVersion: task.version } as const
        : { action, expectedVersion: task.version, evidenceDocumentId: evidenceId, note } as const;
      const result = await performTaskUpdate(task, request, assignees, shipment.documents, shipment.status);
      setMessage(isMockWriteMode ? "Đã đổi bản xem trước; chưa lưu trên máy chủ." : "Đã cập nhật công việc.");
      onUpdated(result.task);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể xử lý công việc."); }
    finally { setBusy(false); }
  }

  return <div className="action-panel"><h3>{isMockWriteMode ? "Thử thao tác công việc" : "Cập nhật công việc"}</h3>
    {detailError ? <p className="form-notice" role="alert">{detailError}</p> : !shipment ? <p className="section-context">Đang lấy chứng từ của lô...</p> : <>
      <div className="action-columns"><div><label htmlFor={`assign-${task.id}`}>Giao cho bộ phận</label><div className="action-inline"><select id={`assign-${task.id}`} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Chọn bộ phận</option>{assignees.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><button className="button button-outline" disabled={busy || !assigneeId || assigneeId === task.assigneeId || task.status === "DONE"} onClick={() => void act("ASSIGN")}>Giao việc</button></div></div>
        <div><label>Tiến độ</label><button className="button button-outline" disabled={busy || task.status !== "OPEN"} onClick={() => void act("START")}>Bắt đầu xử lý</button></div></div>
      {task.status === "IN_PROGRESS" && <div className="complete-form"><label htmlFor={`evidence-${task.id}`}>Chứng từ đã xác nhận làm bằng chứng</label><select id={`evidence-${task.id}`} value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}><option value="">Chọn chứng từ</option>{evidenceOptions.map((doc) => <option key={doc.id} value={doc.id}>{documentTypeLabels[doc.type]} · {doc.fileName}</option>)}</select>
        <label htmlFor={`note-${task.id}`}>Ghi chú hoàn tất (không bắt buộc)</label><textarea id={`note-${task.id}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Đã đối chiếu với chứng từ..." />
        <button className="button button-primary" disabled={busy || !evidenceId} onClick={() => void act("COMPLETE")}>Hoàn tất với bằng chứng</button>
        {!evidenceOptions.length && <p className="section-context">Chưa có chứng từ đã xác nhận trong lô này.</p>}</div>}
      {task.status === "DONE" && <p className="section-context">Đã lưu kết quả; mở lô để xem trạng thái được tính lại.</p>}
    </>}
    {message && <p className="form-notice" role="status">{message}</p>}
  </div>;
}
