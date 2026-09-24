# NexusCargo — B bàn giao đợt 2 (gồm cả đợt 1)

## Đã hoàn thành

1. `/`: Dashboard đọc `GET /api/dashboard`, số liệu và việc khẩn do API trả.
2. `/shipments`: tìm kiếm mã đơn/booking, lọc tôm/cá tra/trạng thái, sắp xếp, phân trang bằng `GET /api/shipments`.
3. `/shipments/[id]`: booking, SI/VGM/CY, container, seal, nhiệt độ, chứng từ, kiểm tra, việc và lịch sử từ `GET /api/shipments/{id}`; có giao diện thử thêm chứng từ.
4. `/tasks`: đọc công việc và người phụ trách từ `GET /api/tasks`, `GET /api/users/assignees`; lọc theo trạng thái/người, xem hạn và chứng từ; giao, bắt đầu, hoàn tất bằng chứng ở bản mô phỏng.
5. `/review`: đọc `GET /api/review`, hiển thị gợi ý, độ tin cậy, trang nguồn; sửa giá trị rồi duyệt hoặc ghi lý do từ chối ở bản mô phỏng.

Các màn hình có trạng thái tải, lỗi, rỗng; hiển thị thời gian theo giờ Việt Nam và dùng được trên điện thoại. Trạng thái lô, mức ưu tiên, lý do rủi ro, kết quả kiểm tra và `latestStartAt` đều lấy từ API; frontend không tính lại quy tắc vận hành.

## File B bàn giao

ZIP `NexusCargo_B_dot2_frontend.zip` là **bản cộng dồn từ khung A**: nếu A chưa ghép đợt 1 vẫn chép một lần được. Nó chứa `HANDOFF.md`, ảnh trong `screenshots/` và các file frontend:

- `src/app/page.tsx`, `src/app/shipments/page.tsx`, `src/app/shipments/[id]/page.tsx`, `src/app/tasks/page.tsx`, `src/app/review/page.tsx`, `src/app/globals.css`
- `src/components/AppShell.tsx`, `Dashboard.tsx`, `ShipmentList.tsx`, `ShipmentDetailView.tsx`, `TasksView.tsx`, `ReviewView.tsx`, `StatusBadge.tsx`, `DemoNotice.tsx`
- `src/lib/api/client.ts`, `src/lib/api/actions.ts`, `src/lib/api/mock.ts`, `src/lib/format.ts`, `src/lib/labels.ts`

Chép đúng đường dẫn trên vào repository của A. Không sửa hay ghi đè `src/types/contracts.ts`, `docs/api-contract.md`, `src/app/api/**`, dữ liệu fixture, `src/app/layout.tsx` hoặc cấu hình A. Không thêm dependency mới.

## Cách chạy

Từ dự án đầy đủ của A (hoặc ZIP demo đã ghép sẵn):

```bash
npm ci
npm run dev
```

Mở `/`, `/shipments`, `/shipments/SHP-0006`, `/tasks`, `/review` trên `http://localhost:3000`. API đọc fixture chỉ mở trong `next dev` theo cấu hình A; `npm run start` trả `403` cho API mẫu. Chưa có đăng nhập, database thật hay tài liệu PDF/ảnh thật trong ZIP của A.

```bash
npm run typecheck
npm run lint
npm run build
```

Ba lệnh đều thành công. Đã thử trên trình duyệt: chi tiết lô rủi ro seal; 250 công việc; giao, bắt đầu và hoàn tất kèm chứng từ đã xác nhận; duyệt một mục Review Queue từ 100 còn 99; trạng thái chứng từ hiển thị lại ở chi tiết lô; lỗi lô không tồn tại; không cuộn ngang tại 390px. Không phát sinh request `POST`/`PATCH` trong chế độ mô phỏng.

## Ranh giới bản mô phỏng và cách nối API ghi

- Mặc định các thao tác ghi đi qua `src/lib/api/mock.ts`, chỉ giữ trạng thái trong bộ nhớ **của trang đang mở**. Tải lại trang sẽ mất. Không có file nào được gửi; mục chứng từ vừa chọn chỉ là metadata gắn nhãn “bản xem trước”. Không hiển thị “đã lưu thật”.
- Dashboard, kiểm tra và trạng thái lô vẫn theo API đọc của A; thao tác mô phỏng **không** làm backend tính lại những giá trị này. Không coi một task ở trạng thái DONE mô phỏng là lô đã hoàn tất.
- Khi A đã làm và kiểm tra quyền cho `PATCH /api/tasks/{id}`, `PATCH /api/review/{id}`, `POST /api/shipments/{id}/documents`, A đặt `NEXT_PUBLIC_WRITE_MODE=http` **trước khi build**. `src/lib/api/client.ts` đã có request theo hợp đồng, `actions.ts` sẽ đổi adapter; khi thành công giao diện tải lại dữ liệu đọc. A cần thử lại toàn tuyến với session, bằng chứng và lỗi `409`.
- API đọc task/review ở chế độ mẫu được gọi theo nhiều trang, sau đó hiển thị phân trang cục bộ để giữ trạng thái mô phỏng nhất quán. Khi tích hợp dữ liệu lớn, A/B chuyển bộ lọc và phân trang của hai màn hình này sang truy vấn server.
- Trong fixture chưa có file thật để mở/đối chiếu. Kết quả trích xuất AI trong Review Queue là dữ liệu giả lập, không phải AI đang chạy.

## Cập nhật đợt điều phối (mới)

Các mô tả mock ở trên là trạng thái tại thời điểm B bàn giao. Bản tích hợp hiện dùng PATCH công việc và duyệt chứng từ lưu trong `.nexuscargo-demo/state.json` khi chạy fixture cục bộ. Luồng seal và thời lượng từng việc ở `docs/DEMO-SAI-SEAL.md`. Supabase vẫn chỉ đọc, upload vẫn xem trước; không bật `NEXT_PUBLIC_WRITE_MODE=http` nữa vì API công việc đã dùng mặc định trong bản mới.
