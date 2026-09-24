# Gửi nguyên nội dung này cho ChatGPT của người B

Tôi là **người B** phụ trách frontend của NexusCargo Seafood Ops. Tôi đã tải lên ZIP khung dự án do A tạo. Trước khi viết code, đọc `README.md`, `src/types/contracts.ts`, `docs/api-contract.md` và cấu trúc Next.js hiện có.

## Vai trò

- A giữ Git chung, API, database, phân quyền, thuật toán nghiệp vụ, AI trích xuất chứng từ và Vercel.
- Tôi làm giao diện rồi **gửi file/ZIP cho A ghép**. Tôi không có quyền đẩy code lên Git chung hoặc triển khai Vercel.
- Không chỉnh `src/types/contracts.ts`, `docs/api-contract.md`, `src/app/api/**`, `src/lib/fixture-db.ts`, `scripts/**` và `data/**`. Nếu cần thêm trường, ghi yêu cầu rõ để A chỉnh hợp đồng.
- B được chỉnh `src/app/page.tsx`, `src/app/globals.css` và tạo `src/components/**`, `src/lib/api/client.ts`, `src/lib/api/mock.ts`, các trang `src/app/shipments/**`, `src/app/tasks/**`, `src/app/review/**`. Giữ `src/app/layout.tsx` thuộc A.
- Dùng dependency hiện có; nếu cần dependency mới, ghi tên và lý do trong `HANDOFF.md`, không âm thầm sửa cấu hình A.

## Mục tiêu giao diện

1. Dashboard: 500 đơn, số lượng từng trạng thái, danh sách việc khẩn và lý do phải xử lý; số lấy từ `GET /api/dashboard`.
2. Danh sách lô: tìm theo mã đơn/booking, lọc tôm/cá tra/trạng thái, phân trang server từ `GET /api/shipments`.
3. Chi tiết lô: các cutoff SI/VGM/CY, container, seal/nhiệt độ, chứng từ, kết quả kiểm tra, người phụ trách, việc và lịch sử.
4. Công việc: việc mở/đang xử lý/đã xong, ưu tiên, hạn xử lý và bằng chứng hoàn tất.
5. Review Queue: trường dữ liệu AI đề xuất, độ tin cậy, giá trị nhân viên xác nhận/sửa.

Frontend chỉ **hiển thị** `status`, `priority`, `riskReasons`, `checks` và `latestStartAt` từ API. Không viết lại quy tắc tính trạng thái nghiệp vụ trên trình duyệt.

## Dữ liệu và các phần chưa có

Các GET API trên localhost vẫn chạy bằng fixture 500 đơn mặc định; thử với `npm run dev`. A đang có nhánh đọc Supabase riêng nhưng B **không cần cấu hình Supabase** để làm giao diện. API ghi và file PDF thật chưa có; API đăng nhập chỉ dành cho chế độ database nên B chưa phải tích hợp ngay. B làm một tầng `client.ts` gọi API GET, một tầng `mock.ts` cho thao tác giao việc, hoàn tất việc, upload và duyệt AI để kiểm tra UI trong lúc A phát triển. Đánh dấu rõ trong UI/HANDOFF thao tác nào còn mock. Khi A làm API ghi xong, thay adapter mock bằng lời gọi API cùng request/response trong hợp đồng.

## Bàn giao 3 đợt

**Đợt 1:** khung điều hướng, Dashboard, danh sách lô với tìm kiếm/lọc/phân trang, loading/empty/error và responsive. Gửi cho A ngay khi chạy được.

**Đợt 2:** trang chi tiết, công việc, Review Queue; các thao tác ghi dùng mock theo hợp đồng.

**Đợt 3:** sửa lỗi sau khi A nối API thật, hoàn thiện trải nghiệm và mobile.

Mỗi lần bàn giao, đưa: (1) ZIP các file frontend thay đổi; (2) `HANDOFF.md` ghi file nào thêm/sửa, lệnh chạy, API nào dùng, các thao tác còn mock, dependency mới và lỗi đã biết; (3) ảnh/video ngắn của màn hình chính. Loại `node_modules`, `.next`, `.env.local` khỏi ZIP.

**Bắt đầu ngay:** đọc dự án, chạy `npm ci` và `npm run dev`, kiểm tra `GET /api/dashboard` trả dữ liệu; rồi viết đợt 1. Sau khi xong, chạy `npm run typecheck` và `npm run lint` trước khi gửi A.
