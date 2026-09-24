import rawShipments from "../../data/shipments.json";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AssigneeOption,
  DashboardSummary,
  Page,
  ReviewItem,
  ShipmentDetail,
  ShipmentListItem,
  Task,
} from "@/types/contracts";

/** Development-only server state, persisted outside the packaged seed. */
export const fixtureAsOf = "2026-10-06T02:00:00.000Z";
const stateDir = path.join(process.cwd(), ".nexuscargo-demo");
const statePath = path.join(stateDir, "state.json");
const original = rawShipments as ShipmentDetail[];
const stored = (() => { try { return existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) as Record<string, ShipmentDetail> : {}; } catch { return {}; } })();
export const shipments = original.map((row) => stored[row.id] ?? structuredClone(row));

export function saveFixture(): void {
  mkdirSync(stateDir, { recursive: true });
  const changed = Object.fromEntries(shipments.filter((row, index) => JSON.stringify(row) !== JSON.stringify(original[index])).map((row) => [row.id, row]));
  const temp = path.join(stateDir, `state-${process.pid}.tmp`);
  writeFileSync(temp, JSON.stringify(changed));
  renameSync(temp, statePath);
}

export function recalculateShipment(shipment: ShipmentDetail): void {
  const active = shipment.checks.filter((check) => check.status !== "PASS");
  const blockingCodes = new Set(["LOT_TRACE", "LAB_RESIDUE", "CARGO_TEMP"]);
  shipment.status = active.some((check) => check.status === "MISMATCH" || check.status === "MISSING" && blockingCodes.has(check.code))
    ? "BLOCKED" : active.length ? "AT_RISK"
      : shipment.documents.some((doc) => doc.type === "GATE_IN_RECEIPT" && doc.status === "VERIFIED") ? "COMPLETED" : "READY";
  shipment.priority = shipment.status === "BLOCKED" ? "CRITICAL" : shipment.status === "AT_RISK" ? "HIGH" : "NORMAL";
  shipment.riskReasons = active.map((check) => check.message);
  shipment.assigneeName = shipment.tasks.find((task) => task.status !== "DONE")?.assigneeName ?? null;
  shipment.updatedAt = new Date().toISOString();
}

export const assignees: AssigneeOption[] = [
  { id: "USR-001", name: "Bộ phận Chứng từ", role: "DOCUMENT_STAFF" },
  { id: "USR-002", name: "Bộ phận Vận tải / Hiện trường", role: "OPERATOR" },
  { id: "USR-003", name: "Bộ phận Kiểm soát chất lượng", role: "OPERATOR" },
];

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

const priorityRank = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };

export function getAllTasks(): Task[] {
  return shipments.flatMap((item) => item.tasks);
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status === "DONE" && b.status !== "DONE") return 1;
    if (b.status === "DONE" && a.status !== "DONE") return -1;
    // The earliest latest-start point gets attention first; a blocked shipment
    // is the tie breaker when two tasks have the same operational window.
    const startA = a.latestStartAt ? Date.parse(a.latestStartAt) : Number.MAX_SAFE_INTEGER;
    const startB = b.latestStartAt ? Date.parse(b.latestStartAt) : Number.MAX_SAFE_INTEGER;
    if (startA !== startB) return startA - startB;
    const priority = priorityRank[a.priority] - priorityRank[b.priority];
    if (priority) return priority;
    return a.id.localeCompare(b.id);
  });
}

export function sortShipments(rows: ShipmentDetail[], sort: "urgency" | "etd"): ShipmentDetail[] {
  return [...rows].sort((a, b) => {
    if (sort === "etd") {
      return (
        (a.etd ? Date.parse(a.etd) : Number.MAX_SAFE_INTEGER) -
          (b.etd ? Date.parse(b.etd) : Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id)
      );
    }
    if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
    if (b.status === "COMPLETED" && a.status !== "COMPLETED") return -1;
    const priority = priorityRank[a.priority] - priorityRank[b.priority];
    if (priority) return priority;
    const earliestA = sortTasks(a.tasks).find((task) => task.status !== "DONE")?.latestStartAt ?? a.cutoffs.si ?? a.etd;
    const earliestB = sortTasks(b.tasks).find((task) => task.status !== "DONE")?.latestStartAt ?? b.cutoffs.si ?? b.etd;
    const timeA = earliestA ? Date.parse(earliestA) : Number.MAX_SAFE_INTEGER;
    const timeB = earliestB ? Date.parse(earliestB) : Number.MAX_SAFE_INTEGER;
    return timeA - timeB || a.id.localeCompare(b.id);
  });
}

export function toListItem({
  requiredSetPointCelsius: _requiredSetPointCelsius,
  containers: _containers,
  documents: _documents,
  checks: _checks,
  tasks: _tasks,
  auditEvents: _auditEvents,
  ...row
}: ShipmentDetail): ShipmentListItem {
  // Explicitly select the public summary shape so the list does not send full details.
  void [_requiredSetPointCelsius, _containers, _documents, _checks, _tasks, _auditEvents];
  return row;
}

export function getDashboard(): DashboardSummary {
  const statusCounts = { READY: 0, AT_RISK: 0, BLOCKED: 0, COMPLETED: 0 };
  for (const shipment of shipments) statusCounts[shipment.status] += 1;
  const horizon = Date.parse(fixtureAsOf) + 24 * 60 * 60 * 1000;
  const urgent = sortTasks(
    getAllTasks().filter(
      (task) => task.status !== "DONE" && task.latestStartAt && Date.parse(task.latestStartAt) <= horizon,
    ),
  );
  return {
    totalOrders: shipments.length,
    statusCounts,
    tasksDueSoon: urgent.filter((task) => task.latestStartAt && Date.parse(task.latestStartAt) >= Date.parse(fixtureAsOf)).length,
    urgentTasks: urgent.slice(0, 5),
    asOf: fixtureAsOf,
  };
}

export function getReviews(): ReviewItem[] {
  return shipments.flatMap((shipment) =>
    shipment.documents
      .filter((document) => document.status === "PENDING_REVIEW")
      .map((document) => ({
        id: `REV-${document.id}`,
        shipmentId: shipment.id,
        orderNo: shipment.orderNo,
        document,
        fields: [
          {
            key: document.type === "SI" ? "sealNo" : "certificateNo",
            label: document.type === "SI" ? "Số seal" : "Số chứng thư",
            suggestedValue: document.type === "SI" ? shipment.containers[0]?.sealNo ?? null : `HC-${shipment.id}`,
            confirmedValue: null,
            confidence: document.type === "SI" ? 0.91 : 0.73,
            sourcePage: 1,
            needsReview: true,
          },
        ],
        createdAt: document.uploadedAt,
      })),
  );
}
