import type { Priority, ShipmentStatus } from "@/types/contracts";

export const statusLabels: Record<ShipmentStatus, string> = {
  READY: "Sẵn sàng",
  AT_RISK: "Có nguy cơ trễ",
  BLOCKED: "Cần xử lý",
  COMPLETED: "Đã hoàn tất",
};

export const priorityLabels: Record<Priority, string> = {
  CRITICAL: "Rất khẩn",
  HIGH: "Ưu tiên cao",
  NORMAL: "Thông thường",
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority-badge priority-${priority.toLowerCase()}`}>{priorityLabels[priority]}</span>;
}
