"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DemoNotice } from "@/components/DemoNotice";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { performUpload, isMockWriteMode } from "@/lib/api/actions";
import { getShipment } from "@/lib/api/client";
import { previewShipment, useMockRevision } from "@/lib/api/mock";
import { formatDateTime } from "@/lib/format";
import { checkStatusLabels, documentStatusLabels, documentTypeLabels, taskStatusLabels } from "@/lib/labels";
import type { DocumentType, ShipmentDetail } from "@/types/contracts";

type LoadState = { state: "loading" } | { state: "error"; message: string } | { state: "success"; data: ShipmentDetail };

const selectableDocumentTypes: DocumentType[] = ["SI", "VGM", "HEALTH_CERTIFICATE", "CUSTOMS_RELEASE", "GATE_IN_RECEIPT", "OTHER"];

export function ShipmentDetailView({ id }: { id: string }) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [type, setType] = useState<DocumentType>("SI");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [siSealInput, setSiSealInput] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useMockRevision();

  useEffect(() => {
    const controller = new AbortController();
    getShipment(id, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setLoad({ state: "success", data }); },
      (error: unknown) => { if (!controller.signal.aborted) setLoad({ state: "error", message: error instanceof Error ? error.message : "Không thể lấy lô hàng." }); },
    );
    return () => controller.abort();
  }, [id, reloadKey]);

  const shipment = load.state === "success" ? previewShipment(load.data) : null;

  async function saveSeal() {
    if (!shipment) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/shipments/${encodeURIComponent(shipment.id)}/seal`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sealNo: siSealInput.trim().toUpperCase() }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error?.message ?? "Không cập nhật được seal."); }
      setNotice("Đã lưu seal trên SI. Hoàn tất việc đối chiếu tại trang Công việc để hệ thống kiểm tra lại lô.");
      setReloadKey((key) => key + 1);
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không cập nhật được seal."); }
    finally { setBusy(false); }
  }

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !shipment) { setNotice("Hãy chọn một tệp để thử thao tác."); return; }
    setBusy(true);
    setNotice("");
    try {
      await performUpload(shipment.id, file, type);
      setNotice("Chỉ xem trước thông tin tệp trong phiên này; tệp chưa được tải lên máy chủ.");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      if (!isMockWriteMode) setReloadKey((key) => key + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xử lý tệp.");
    } finally { setBusy(false); }
  }

  return <AppShell>
    <nav className="breadcrumb" aria-label="Đường dẫn"><Link href="/shipments">Lô hàng</Link><span>›</span><span>{shipment?.orderNo ?? id}</span></nav>
    {load.state === "loading" ? <div className="panel detail-loading" aria-label="Đang tải chi tiết lô"><div className="skeleton skeleton-breakdown" /><div className="skeleton task-skeleton" /><div className="skeleton task-skeleton" /></div>
    : load.state === "error" ? <div className="feedback-panel" role="alert"><span className="feedback-icon">!</span><h2>Không mở được lô hàng</h2><p>{load.message}</p><button className="button button-outline" onClick={() => { setLoad({ state: "loading" }); setReloadKey((key) => key + 1); }}>Thử lại</button></div>
    : shipment && <>
      <div className="page-heading detail-heading"><div><p className="eyebrow">HỒ SƠ LÔ HÀNG · {shipment.id}</p><h1>{shipment.orderNo}<span className="title-period">.</span></h1>
        <p className="page-subtitle">{shipment.product === "SHRIMP" ? "Tôm đông lạnh" : "Cá tra đông lạnh"} · {shipment.customerName} · {shipment.destination ?? "Chưa có điểm đến"}</p></div>
        <div className="detail-badges"><StatusBadge status={shipment.status} /><PriorityBadge priority={shipment.priority} /></div>
      </div>
      <DemoNotice />
      {shipment.riskReasons.length > 0 && <section className="risk-alert" aria-label="Lý do rủi ro"><strong>Lý do cần chú ý</strong><ul>{shipment.riskReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></section>}

      <div className="detail-main-grid">
        <div className="detail-left">
          {shipment.seafoodProfile && <section className="panel detail-panel seafood-panel"><div className="panel-heading"><div><p className="eyebrow">THỦY SẢN · TRUY XUẤT</p><h2>Quy cách và mã lô</h2></div></div>
            <p className="section-context">Điều kiện thị trường và các ngưỡng dưới đây là <strong>ví dụ theo booking / hợp đồng giả lập</strong>. Nhân viên phải đối chiếu yêu cầu hiện hành trước khi dùng thực tế.</p>
            <dl className="info-grid">
              <div><dt>Thị trường</dt><dd>{shipment.seafoodProfile.marketCode}</dd></div>
              <div><dt>Dạng sản phẩm / cỡ</dt><dd>{shipment.seafoodProfile.productForm} · {shipment.seafoodProfile.sizeGrade}</dd></div>
              <div><dt>Quy cách đóng gói</dt><dd>{shipment.seafoodProfile.packaging}</dd></div>
              <div><dt>Khối lượng tịnh</dt><dd>{shipment.seafoodProfile.netWeightKg.toLocaleString("vi-VN")} kg</dd></div>
              <div><dt>Mã lô sản xuất</dt><dd>{shipment.seafoodProfile.lotCode ?? "Chưa có"}</dd></div>
              <div><dt>Mã lô trên packing list</dt><dd>{shipment.seafoodProfile.packingListLotCode ?? "Chưa có"}</dd></div>
              <div><dt>Ngày sản xuất</dt><dd>{shipment.seafoodProfile.productionDate}</dd></div>
              <div><dt>Nhà máy</dt><dd>{shipment.seafoodProfile.factoryName} · {shipment.seafoodProfile.factoryCode}</dd></div>
              <div><dt>Tham chiếu hồ sơ nhà máy</dt><dd>{shipment.seafoodProfile.factoryApprovalRef ?? "Chưa cung cấp"}</dd></div>
              {shipment.product === "PANGASIUS" && <div><dt>Mạ băng / giới hạn hợp đồng</dt><dd>{shipment.seafoodProfile.glazePercent ?? "Chưa có"}% / {shipment.seafoodProfile.customerSpec.maxGlazePercent ?? "Chưa có"}%</dd></div>}
            </dl>
            <h3 className="seafood-subheading">Kiểm nghiệm liên kết với mã lô</h3>
            <div className="seafood-lab-list">{shipment.seafoodProfile.labResults.map((test) => <div className="seafood-lab-row" key={test.kind}><strong>{({ RESIDUE: "Dư lượng", SULFITE: "Sulfite của tôm", MICROBIOLOGY: "Vi sinh" } as Record<string, string>)[test.kind] ?? test.kind}</strong><span>{test.reportNo} · Mẫu {test.testedLotCode}</span><span className={`check-chip check-${test.status === "FAIL" ? "mismatch" : test.status === "PENDING" ? "pending_review" : "pass"}`}>{test.status === "PASS" ? "Đã xác nhận" : test.status === "PENDING" ? "Chờ đối chiếu" : "Không đạt điều kiện mẫu"}</span></div>)}</div>
          </section>}
          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">THÔNG TIN LÔ</p><h2>Hành trình & booking</h2></div></div>
            <dl className="info-grid"><div><dt>Booking</dt><dd>{shipment.bookingNo ?? "Chưa có thông tin"} <small>· Phiên bản {shipment.bookingVersion}</small></dd></div>
              <div><dt>Bộ phận xử lý</dt><dd>{shipment.assigneeName ?? "Không có việc đang mở"}</dd></div>
              <div><dt>Tàu / Chuyến</dt><dd>{shipment.vesselName ?? "Chưa có thông tin"} · {shipment.voyageNo ?? "Chưa có thông tin"}</dd></div>
              <div><dt>Ngày tàu chạy (ETD)</dt><dd>{formatDateTime(shipment.etd)}</dd></div>
              <div><dt>Số container</dt><dd>{shipment.containerCount}</dd></div><div><dt>Cập nhật</dt><dd>{formatDateTime(shipment.updatedAt)}</dd></div>
            </dl>
          </section>

          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">MỐC THỜI GIAN</p><h2>Cutoff của booking</h2></div></div>
            <div className="cutoff-grid"><div><span>SI</span><strong>{formatDateTime(shipment.cutoffs.si)}</strong><small>Chỉ dẫn giao hàng</small></div>
              <div><span>VGM</span><strong>{formatDateTime(shipment.cutoffs.vgm)}</strong><small>Khối lượng xác nhận</small></div>
              <div><span>CY</span><strong>{formatDateTime(shipment.cutoffs.cy)}</strong><small>Container vào bãi</small></div></div>
          </section>

          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">HÀNG LẠNH</p><h2>Container & nhiệt độ</h2></div></div>
            <p className="section-context">Nhiệt độ yêu cầu theo booking: <strong>{shipment.requiredSetPointCelsius === null ? "Chưa xác nhận" : `${shipment.requiredSetPointCelsius}°C`}</strong></p>
            {shipment.seafoodProfile && <p className="section-context">Giới hạn nhiệt độ hàng trong hợp đồng mẫu: <strong>{shipment.seafoodProfile.customerSpec.maxCargoTempCelsius}°C</strong>. Số cài đặt và khí hồi <strong>không thay thế</strong> số đo đầu dò hàng; nếu thiếu đầu dò, web báo thiếu bằng chứng.</p>}
            {shipment.containers.length ? <div className="card-list">{shipment.containers.map((container) => <div className="container-row" key={container.id}>
              <strong>{container.containerNo ?? "Chưa có số container"}</strong><span>Seal: {container.sealNo ?? "Chưa xác nhận"}</span>
              <span>Cài đặt: {container.setPointCelsius === null ? "Chưa xác nhận" : `${container.setPointCelsius}°C`}</span>
              <span className={container.reeferConnectionConfirmed ? "signal-good" : "signal-warn"}>Kết nối điện: {container.reeferConnectionConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}</span>
              {!!container.temperatureReadings?.length && <details className="temperature-history"><summary>Lịch sử nhiệt độ ({container.temperatureReadings.length} bản ghi)</summary><div className="temperature-reading-list">{container.temperatureReadings.map((reading, position) => <div key={`${reading.sensorId}-${reading.observedAt}-${position}`}><time>{formatDateTime(reading.observedAt)}</time><span>{reading.source === "CARGO_PROBE" ? "Đầu dò hàng" : "Khí hồi"}</span><strong>{reading.celsius}°C</strong></div>)}</div></details>}
            </div>)}</div> : <p className="section-context">Chưa có container.</p>}
          </section>

          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">ĐỐI CHIẾU</p><h2>Kết quả kiểm tra</h2></div><span className="total-pill">{shipment.checks.length}</span></div>
            {!isMockWriteMode && shipment.checks.some((check) => check.code === "SEAL_SI_MATCH" && check.status !== "PASS") && <div className="action-panel"><h3>Đối chiếu số seal trên SI</h3><p className="section-context">SI hiện ghi: <strong>{shipment.siSealNo ?? "Chưa có"}</strong> · Container ghi: <strong>{shipment.containers[0]?.sealNo ?? "Chưa có"}</strong>. Chỉ nhập giá trị sau khi đã xác minh SI với bộ phận Chứng từ.</p><label htmlFor="si-seal-correction">Số seal trên SI đã đối chiếu</label><div className="action-inline"><input id="si-seal-correction" value={siSealInput} onChange={(event) => setSiSealInput(event.target.value)} placeholder={shipment.containers[0]?.sealNo ?? "Nhập số seal"} /><button className="button button-outline" disabled={busy || !siSealInput.trim()} onClick={() => void saveSeal()}>Lưu seal trên SI</button></div></div>}
            <div className="card-list">{shipment.checks.map((check) => <article className="check-row" key={check.code}>
              <div><strong>{check.title}</strong><span className={`check-chip check-${check.status.toLowerCase()}`}>{checkStatusLabels[check.status]}</span></div>
              <p>{check.message}</p><small>Cần trước: {formatDateTime(check.requiredBy)} · {check.relatedDocumentIds.length ? `Chứng từ: ${check.relatedDocumentIds.join(", ")}` : "Không gắn chứng từ"}</small>
            </article>)}</div>
          </section>
        </div>

        <div className="detail-right">
          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">HỒ SƠ</p><h2>Chứng từ</h2></div><span className="total-pill">{shipment.documents.length}</span></div>
            <p className="section-context">Chứng từ gốc trong dữ liệu mẫu chỉ có thông tin tệp; chưa có PDF/ảnh thật. Nút thêm chứng từ chỉ xem trước trong phiên.</p>
            <div className="card-list">{shipment.documents.map((doc) => <div className="document-row" key={doc.id}>
              <div><strong>{documentTypeLabels[doc.type]}</strong><span className={`doc-chip doc-${doc.status.toLowerCase()}`}>{documentStatusLabels[doc.status]}</span></div>
              <span className="file-name">{doc.fileName} {doc.id.startsWith("DEMO-") && <em>· bản xem trước</em>}</span>
              <small>Phiên bản {doc.version} · {formatDateTime(doc.uploadedAt)}</small>
            </div>)}</div>
            <form className="upload-preview" onSubmit={submitUpload}><h3>Thử thêm chứng từ (chỉ xem trước)</h3>
              <label htmlFor="doc-type">Loại chứng từ</label><select id="doc-type" value={type} onChange={(event) => setType(event.target.value as DocumentType)}>{selectableDocumentTypes.map((value) => <option key={value} value={value}>{documentTypeLabels[value]}</option>)}</select>
              <label htmlFor="doc-file">Tệp PDF hoặc ảnh</label><input id="doc-file" ref={fileInput} type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang xử lý..." : "Xem trước thao tác"}</button>
              {notice && <p className="form-notice" role="status">{notice}</p>}
            </form>
          </section>

          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">CẦN LÀM</p><h2>Công việc</h2></div><Link href="/tasks" className="text-link">Mở trang công việc ↗</Link></div>
            {shipment.tasks.length ? <div className="card-list">{shipment.tasks.map((task) => <div className="detail-task" key={task.id}>
              <div><strong>{task.title}</strong><span className={`task-chip task-${task.status.toLowerCase()}`}>{taskStatusLabels[task.status]}</span></div>
              <p>{task.description}</p><small>Bắt đầu muộn nhất: {formatDateTime(task.latestStartAt)}<br />Hạn: {formatDateTime(task.dueAt)} · Bộ phận: {task.assigneeName ?? "Chưa giao"}</small>
            </div>)}</div> : <p className="section-context">Không có công việc đang theo dõi.</p>}
          </section>

          <section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">LỊCH SỬ</p><h2>Hoạt động</h2></div></div>
            {shipment.auditEvents.length ? <ol className="audit-list">{shipment.auditEvents.map((event) => <li key={event.id}><strong>{event.description}</strong><small>{event.actorName} · {formatDateTime(event.createdAt)}</small></li>)}</ol>
            : <p className="section-context">Chưa có hoạt động.</p>}
            {isMockWriteMode && <p className="section-context">Thao tác mô phỏng không tạo nhật ký phía máy chủ.</p>}
          </section>
        </div>
      </div>
    </>}
  </AppShell>;
}
