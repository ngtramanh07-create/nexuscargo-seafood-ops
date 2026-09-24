import type { CheckStatus, DocumentStatus, DocumentType, TaskStatus } from "@/types/contracts";

export const documentTypeLabels: Record<DocumentType, string> = {
  BOOKING: "Booking", SI: "Chỉ dẫn giao hàng (SI)", VGM: "Xác nhận khối lượng (VGM)",
  HEALTH_CERTIFICATE: "Chứng thư", CUSTOMS_RELEASE: "Thông quan", GATE_IN_RECEIPT: "Phiếu vào bãi", OTHER: "Khác",
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  PROCESSING: "Đang xử lý", PENDING_REVIEW: "Chờ kiểm tra", VERIFIED: "Đã xác nhận", STALE: "Cần xem lại",
  REJECTED: "Đã từ chối", FAILED: "Xử lý lỗi",
};

export const checkStatusLabels: Record<CheckStatus, string> = {
  PASS: "Đạt", MISSING: "Thiếu", MISMATCH: "Không khớp", PENDING_REVIEW: "Chờ kiểm tra", STALE: "Cần kiểm tra lại",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  OPEN: "Chưa làm", IN_PROGRESS: "Đang xử lý", DONE: "Đã hoàn tất",
};
