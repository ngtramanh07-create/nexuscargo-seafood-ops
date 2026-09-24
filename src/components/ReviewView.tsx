"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DemoNotice } from "@/components/DemoNotice";
import { performReviewDecision, isMockWriteMode } from "@/lib/api/actions";
import { getReview, getShipment } from "@/lib/api/client";
import { previewReview, useMockRevision } from "@/lib/api/mock";
import { formatDateTime, numberVi } from "@/lib/format";
import { documentTypeLabels } from "@/lib/labels";
import type { ReviewDecisionRequest, ReviewItem } from "@/types/contracts";

type LoadState = { state: "loading" } | { state: "error"; message: string } | { state: "success"; items: ReviewItem[] };
const pageSize = 10;

async function fetchAllReviews(signal: AbortSignal): Promise<ReviewItem[]> {
  const first = await getReview(1, 50, signal);
  const pageCount = Math.ceil(first.total / 50);
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => getReview(index + 2, 50, signal)));
  return [first, ...rest].flatMap((page) => page.items);
}

export function ReviewView() {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState("");
  useMockRevision();

  useEffect(() => {
    const controller = new AbortController();
    fetchAllReviews(controller.signal).then(
      (items) => { if (!controller.signal.aborted) setLoad({ state: "success", items }); },
      (error: unknown) => { if (!controller.signal.aborted) setLoad({ state: "error", message: error instanceof Error ? error.message : "Không lấy được hàng chờ kiểm tra." }); },
    );
    return () => controller.abort();
  }, [reloadKey]);

  const items = load.state === "success" ? load.items.filter(previewReview) : [];
  const pages = Math.ceil(items.length / pageSize);
  const shownPage = Math.min(page, Math.max(1, pages));
  const visible = items.slice((shownPage - 1) * pageSize, shownPage * pageSize);

  return <AppShell>
    <div className="page-heading"><div><p className="eyebrow">KIỂM TRA CỦA NHÂN VIÊN</p><h1>Hàng chờ kiểm tra chứng từ<span className="title-period">.</span></h1>
      <p className="page-subtitle">Đối chiếu gợi ý dữ liệu mẫu, sửa giá trị khi cần rồi xác nhận chứng từ.</p></div>
      <span className="heading-note">{load.state === "success" ? `${numberVi.format(items.length)} chứng từ đang chờ` : "Đang lấy hàng chờ"}</span>
    </div>
    <DemoNotice />
    <div className="data-note"><span className="data-note-icon" aria-hidden="true">i</span><span>Độ tin cậy chỉ hỗ trợ kiểm tra, không bảo đảm dữ liệu đúng. Khung A mới có thông tin tệp, chưa có PDF/ảnh thật để đối chiếu.</span></div>
    {flash && <div className="workflow-flash" role="status">{flash}<button type="button" onClick={() => setFlash("")} aria-label="Đóng thông báo">×</button></div>}
    {load.state === "error" ? <div className="feedback-panel" role="alert"><span className="feedback-icon">!</span><h2>Chưa tải được hàng chờ</h2><p>{load.message}</p><button className="button button-outline" onClick={() => { setLoad({ state: "loading" }); setReloadKey((key) => key + 1); }}>Thử lại</button></div>
    : load.state === "loading" ? <div className="panel detail-loading"><div className="skeleton task-skeleton" /><div className="skeleton task-skeleton" /></div>
    : !visible.length ? <div className="feedback-panel"><span className="empty-icon">◫</span><h2>Không còn chứng từ chờ kiểm tra</h2><p>Hàng chờ của phiên hiện tại đang trống.</p></div>
    : <><div className="review-toolbar"><span>Hiển thị {(shownPage - 1) * pageSize + 1}–{Math.min(shownPage * pageSize, items.length)} / {numberVi.format(items.length)}</span><span>Trang {shownPage} / {pages}</span></div>
      <div className="review-list">{visible.map((item) => <ReviewCard key={item.id} item={item} onDone={(decision) => {
        setFlash(isMockWriteMode ? `Đã ${decision === "APPROVE" ? "duyệt" : "từ chối"} trong bản xem trước. Máy chủ chưa được cập nhật.` : "Đã gửi quyết định; dữ liệu đang được cập nhật.");
        if (!isMockWriteMode) { setLoad({ state: "loading" }); setReloadKey((key) => key + 1); }
      }} />)}</div>
      {items.length > pageSize && <div className="pagination review-pagination"><span>Trang {shownPage} / {pages}</span><div className="pagination-buttons"><button className="page-button" disabled={shownPage <= 1} onClick={() => setPage(shownPage - 1)}>← Trước</button><button className="page-button" disabled={shownPage >= pages} onClick={() => setPage(shownPage + 1)}>Sau →</button></div></div>}
    </>}
  </AppShell>;
}

function ReviewCard({ item, onDone }: { item: ReviewItem; onDone: (decision: "APPROVE" | "REJECT") => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(item.fields.map((field) => [field.key, field.confirmedValue ?? field.suggestedValue ?? ""])));
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true); setError("");
    try {
      const request: ReviewDecisionRequest = decision === "APPROVE" ? {
        decision,
        corrections: item.fields.filter((field) => values[field.key]?.trim() !== (field.suggestedValue ?? "").trim())
          .map((field) => ({ key: field.key, confirmedValue: values[field.key]?.trim() ?? "" })),
      } : { decision, note: rejectNote.trim() };
      const shipment = await getShipment(item.shipmentId);
      await performReviewDecision(item, request, shipment.status);
      onDone(decision);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xử lý chứng từ."); }
    finally { setBusy(false); }
  }

  return <article className="panel review-card"><div className="review-head"><div><span className="review-type">{documentTypeLabels[item.document.type]}</span><h2>{item.document.fileName}</h2>
      <p><Link href={`/shipments/${encodeURIComponent(item.shipmentId)}`}>{item.orderNo} ↗</Link> · Phiên bản {item.document.version} · Chờ từ {formatDateTime(item.createdAt)}</p></div>
      <span className="doc-chip doc-pending_review">Chờ nhân viên duyệt</span></div>
    <div className="review-fields"><div className="review-fields-head"><span>Trường AI gợi ý</span><span>Giá trị nhân viên xác nhận</span></div>
      {item.fields.map((field) => <div className="review-field" key={field.key}><div><strong>{field.label}</strong><span className="suggestion">Gợi ý: {field.suggestedValue ?? "Chưa trích xuất"}</span><small>Độ tin cậy: {field.confidence === null ? "Chưa có" : `${Math.round(field.confidence * 100)}%`} · Trang {field.sourcePage ?? "chưa rõ"}</small></div>
        <div><label htmlFor={`${item.id}-${field.key}`}>Xác nhận / sửa {field.label.toLowerCase()}</label><input id={`${item.id}-${field.key}`} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="Nhập giá trị đã kiểm tra" /></div>
      </div>)}</div>
    <div className="review-actions"><div><label htmlFor={`reject-${item.id}`}>Lý do từ chối (nếu từ chối)</label><input id={`reject-${item.id}`} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Ví dụ: chứng từ không thuộc booking" /></div>
      <div className="review-buttons"><button type="button" className="button button-danger" disabled={busy || !rejectNote.trim()} onClick={() => void decide("REJECT")}>Từ chối</button>
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void decide("APPROVE")}>{busy ? "Đang xử lý..." : isMockWriteMode ? "Duyệt bản xem trước" : "Xác nhận chứng từ"}</button></div></div>
    {error && <p className="form-notice error" role="alert">{error}</p>}
  </article>;
}
