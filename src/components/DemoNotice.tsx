export function DemoNotice() {
  return <div className="demo-notice" role="note"><strong>Dữ liệu giả lập.</strong> {process.env.NEXT_PUBLIC_NEXUSCARGO_PUBLIC_DEMO === "true" ? "Các thao tác chỉ là bản xem trước trong trình duyệt; tải lại trang sẽ trở về dữ liệu mẫu ban đầu." : "Khi chạy cục bộ, công việc và quyết định chứng từ được lưu trên máy chạy web."} Hồ sơ PDF và cảm biến thật chưa kết nối.</div>;
}
