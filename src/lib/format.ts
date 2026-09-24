export const numberVi = new Intl.NumberFormat("vi-VN");

const dateTimeVi = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

const dateVi = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatDateTime(value: string | null): string {
  return value ? dateTimeVi.format(new Date(value)) : "Chưa có thông tin";
}

export function formatDate(value: string | null): string {
  return value ? dateVi.format(new Date(value)) : "Chưa có thông tin";
}
