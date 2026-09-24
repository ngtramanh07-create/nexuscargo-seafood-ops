# Demo lô sai seal và giới hạn vận hành

Bản mẫu dùng đồng hồ nghiệp vụ **06/10/2026 09:00, giờ Việt Nam**. Hạn việc được ước tính bằng hạn cutoff trừ thời gian thao tác và khoảng dự phòng riêng theo loại việc. Ví dụ: sửa seal SI 3+1 giờ; VGM 5+2 giờ; chứng thư 8+4 giờ; kiểm nghiệm dư lượng 24+8 giờ. Đây là **giả định để trình diễn**, cần đo thời gian thực tế trước khi dùng điều phối.

## Luồng trình diễn

1. Chạy `npm ci` rồi `npm run dev` và mở `/shipments/SHP-0006`. Lô này bắt đầu ở trạng thái **Bị chặn**: seal trên SI là `SL-OLD-0006`, trên container là `SL-000006`.
2. Mở `/tasks`, tìm `EXP-2026-0006`, nhấn **Bắt đầu xử lý**. Tải lại trang: việc vẫn là **Đang xử lý**.
3. Trở lại lô và nhập `SL-000006` ở ô **Số seal trên SI đã đối chiếu**. Bản mẫu lưu giá trị này và để phép kiểm tra ở trạng thái **Chờ đối chiếu**, chưa tự coi là đã hoàn tất.
4. Trở lại công việc, chọn SI `DOC-0006-1` đã xác nhận làm bằng chứng, nhấn **Hoàn tất với bằng chứng**. Tải lại lô: kiểm tra seal đạt, lô chuyển **Sẵn sàng**, nhật ký ghi thao tác.
5. Nếu lô còn lỗi kiểm tra khác, trạng thái vẫn có rủi ro hoặc bị chặn. Không suy ra đã xuất khẩu chỉ vì đã sửa seal.

API cục bộ lưu phần thay đổi vào `.nexuscargo-demo/state.json` trên **máy chủ phát triển**, nên tải lại trình duyệt hoặc khởi động lại server vẫn còn. Muốn bắt đầu demo từ đầu, dừng server và xóa riêng thư mục `.nexuscargo-demo` (giữ nguyên `data/shipments.json`). Dữ liệu mẫu gốc 500 lô không bị sửa.

## Ranh giới

- **Chế độ Supabase hiện chỉ đọc.** Các API ghi trong gói này chỉ bật ở chế độ dữ liệu giả lập khi chạy `npm run dev`; không nhận ghi từ người dùng không xác thực trên môi trường production. Cần triển khai giao dịch có phân quyền và tính lại trạng thái trong database trước khi sử dụng Supabase để ghi.
- Ô seal lưu **giá trị đã được nhân viên xác nhận trong mô phỏng**, không chỉnh PDF SI gốc. Chứng từ hiện chỉ có metadata. Nút thêm file vẫn là xem trước, không lưu file. Dữ liệu mẫu và thời lượng xử lý không phải số liệu từ doanh nghiệp.
- Mỗi lô tính lại theo **toàn bộ** phép kiểm tra còn lỗi; một nhiệm vụ có bằng chứng đúng loại mới được đánh dấu hoàn tất. Lô có biên nhận vào bãi được gắn nhãn Hoàn tất theo định nghĩa của bản demo, không hàm ý đã lên tàu.
