# NexusCargo Seafood Ops — khung bàn giao A → B

> **Triển khai hiện tại:** Để mở demo cho mọi người xem mà không cần đăng nhập, xem [hướng dẫn demo công khai](docs/DEMO-KHONG-DANG-NHAP.md). Nếu dùng Supabase và đăng nhập để ghi dữ liệu, làm theo [hướng dẫn lên Vercel](docs/DEPLOY-VERCEL-TUNG-BUOC.md). Phần bàn giao A → B bên dưới ghi lại trạng thái thiết kế giai đoạn trước.

> **Bản đã ghép giao diện B đợt 2:** xem [START-HERE.md](START-HERE.md) để chạy trên Windows và phân biệt dữ liệu giả lập với các thao tác đã lưu thật. Gói B đợt 2 đã gồm toàn bộ đợt 1.

Khung Next.js + TypeScript dành cho hai người phát triển độc lập. **A** sở hữu Git, backend, database, logic, AI, tích hợp và Vercel. **B** sở hữu frontend và gửi code để A ghép. Dữ liệu trong gói **hoàn toàn giả lập**.

## Chạy trên máy

Yêu cầu Node.js phiên bản được Next.js trong `package.json` hỗ trợ và npm. Từ thư mục dự án:

```bash
npm ci
npm run dev
```

Mở `http://localhost:3000`. Không cần tạo `.env.local` để B chạy dữ liệu mẫu bằng `npm run dev`. Ở production, dữ liệu mẫu chỉ mở công khai nếu bật `NEXT_PUBLIC_NEXUSCARGO_PUBLIC_DEMO=true`; khi đó Supabase không được dùng và các thao tác chỉ là bản xem trước trong trình duyệt. Nếu không bật, production tiếp tục dùng Supabase và yêu cầu đăng nhập. Nếu A chủ động tắt mock cục bộ, đặt `DEMO_API_ENABLED=false`.

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run seed:fixture` tái tạo `data/shipments.json` bằng script cố định, gồm **500 đơn và 550 container**. File JSON không phải database. Dữ liệu mới kết hợp 17 kịch bản gốc với các lỗi có thể đồng thời xuất hiện, bốn thị trường, quy cách tôm/cá tra, mã lô, kiểm nghiệm và bản ghi đầu dò hàng. A làm theo [docs/A-SUPABASE-SETUP.md](docs/A-SUPABASE-SETUP.md) để áp dụng **cả hai migration** trước `npm run seed:supabase`, đưa đúng 500 đơn này vào Supabase. A đặt `NEXUSCARGO_DATA_SOURCE=supabase` để dùng nhánh API đọc từ database ở máy A; production mặc định dùng nhánh database trừ khi bật demo công khai. Xem [docs/SEAFOOD-RULES.md](docs/SEAFOOD-RULES.md) trước khi diễn giải số liệu trước BGK.

Trong bản mẫu, đầu mối xử lý là **bộ phận** theo loại lỗi: Chứng từ, Vận tải / Hiện trường hoặc Kiểm soát chất lượng. API vẫn giữ tên trường `assigneeId`/`assigneeName` để B không phải sửa các chỗ đã tích hợp, nhưng nhãn hiện trên giao diện là bộ phận. Trang Công việc có 275 việc chưa làm, 100 việc đang xử lý và 143 việc đã hoàn tất kèm bằng chứng SI đã xác nhận. Số lượng này là tiến độ **giả lập**, không phải nhật ký thực tế.

## Thành phần trong gói

| Đường dẫn | Chủ sở hữu | Tác dụng |
| --- | --- | --- |
| `src/types/contracts.ts` | A | Kiểu dữ liệu dùng chung v1.0.0 |
| `docs/api-contract.md` | A | Request/response và quy tắc chung |
| `data/shipments.json` | A | Dữ liệu giả lập cố định để phát triển UI |
| `scripts/generate-fixtures.mjs` | A | Sinh lại dữ liệu giả lập |
| `src/lib/fixture-db.ts`, `src/lib/api-fixture.ts` | A | Đọc, tìm, lọc, phân trang fixture |
| `supabase/migrations/**` | A | Schema, chỉ mục và RLS theo tổ chức |
| `scripts/seed-supabase.mjs` | A | Nạp 500 đơn vào database bằng secret ở máy A |
| `src/lib/db-read.ts`, `src/lib/supabase/**`, `src/proxy.ts` | A | API đọc từ Supabase bằng session người dùng |
| `src/app/api/**` | A | API đọc theo hợp đồng; auth A bổ sung |
| `src/app/layout.tsx` | A | Root layout và metadata |
| `src/app/page.tsx`, `src/app/globals.css` | B | Trang khởi động và CSS, B được thay thế |
| `src/components/**`, `src/lib/api/client.ts`, `src/lib/api/mock.ts` | B | Các file B có thể thêm |

### API đọc cùng hợp đồng ở cả hai chế độ

```text
GET /api/dashboard
GET /api/shipments?search=&product=&status=&page=1&pageSize=20&sort=urgency
GET /api/shipments/SHP-0001
GET /api/tasks?status=OPEN&page=1&pageSize=20
GET /api/review?page=1&pageSize=20
GET /api/users/assignees
```

Thử nhanh: mở `http://localhost:3000/api/dashboard` và `http://localhost:3000/api/shipments?page=1&pageSize=20`. Dữ liệu giả lập là bản chụp mốc **09:00 ngày 06/10/2026 (giờ Việt Nam)** nên các con số về việc sắp đến hạn ở chế độ fixture dựa trên mốc mẫu này. Khi đọc Supabase, `asOf` là thời điểm truy vấn thực tế. Cả hai chế độ trả về cùng cấu trúc JSON trong `docs/api-contract.md`.

### Phần A còn phải thực hiện sau khi giao khung cho B

1. Tạo dự án Supabase và Auth user, áp dụng migration, seed 500 đơn rồi chạy API trong chế độ Supabase; chưa có tài khoản/dự án trong gói ZIP nên chưa kiểm tra được database từ xa.
2. Kết nối giao diện đăng nhập với `POST /api/auth/login`, kiểm thử phân quyền RLS hai tài khoản trước khi đưa dữ liệu người dùng lên hệ thống.
3. Viết bộ quy tắc đối chiếu booking, seal, SI, VGM, nhiệt độ, chứng thư theo từng lô, CY cutoff; tính `latestStartAt` và đánh giá lại sau khi dữ liệu đổi. Các kết quả hiện có trong seed vẫn là **kịch bản giả lập**, chưa phải quy tắc chạy khi dữ liệu thay đổi.
4. Triển khai các API ghi trong `docs/api-contract.md`: `PATCH /api/tasks/{id}`, `PATCH /api/review/{id}`, `POST /api/shipments/{id}/documents`, `GET /api/documents/{id}/file`. Trước khi cho phép upload thật, cấu hình kho file riêng tư.
5. Tích hợp AI trích xuất chứng từ thật qua Review Queue, nhân viên xác nhận rồi mới đưa kết quả vào bộ quy tắc. Chưa có chatbot.
6. Ghép giao diện B gửi, chạy kiểm thử toàn tuyến và chỉ sau đó mới triển khai Vercel. Chỉ A đẩy code lên Git chung.

Các `documents` trong JSON **chỉ có metadata giả lập, không kèm PDF/ảnh thật**; nút xem file và thao tác cập nhật cần mock trên frontend cho đến khi A triển khai dịch vụ file/API ghi. Tránh hiển thị thông báo “đã lưu” nếu thao tác vẫn dùng mock.

## B bắt đầu như thế nào?

Đọc `docs/B-HANDOFF.md`, mở cuộc ChatGPT riêng và tải nguyên gói ZIP này. Không tự tạo một dự án Next.js mới. B làm theo đúng `contracts.ts` và `api-contract.md`, ưu tiên Dashboard và danh sách lô trước.

## Bản cập nhật luồng công việc

Xem `docs/DEMO-SAI-SEAL.md` để thử lô sai seal, lưu trạng thái qua tải lại trang và hiểu ranh giới giữa dữ liệu giả lập cục bộ và Supabase chỉ đọc. Các mô tả giao diện giai đoạn 1–2 phía trên là lịch sử bàn giao; thao tác công việc và duyệt chứng từ hiện gọi API ghi cục bộ khi chạy `npm run dev`. Việc chọn thêm tệp vẫn chỉ xem trước.
