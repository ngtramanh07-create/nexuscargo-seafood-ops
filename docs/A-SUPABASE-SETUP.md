# A: kích hoạt Supabase cho NexusCargo

**Chỉ A** chạy migration, seed, giữ khóa quản trị và đưa code lên Git. B tiếp tục làm frontend trên fixture và hai file hợp đồng v1.0.0; B không cần tài khoản hay khóa Supabase.

## 1. A chuẩn bị tài khoản và database

1. Tạo dự án Supabase của riêng nhóm. Trong Supabase Auth, tạo một tài khoản nhân viên dùng email của A, lấy **User ID (UUID)** của tài khoản này. Không ghi mật khẩu vào Git hoặc gửi cho B.
2. Trong trang Connect/API keys, lấy **Project URL**, **publishable key** và **secret key**. Chỉ URL và publishable key được đặt trong biến `NEXT_PUBLIC_*`. Secret chỉ nằm trong `.env.local` của máy A khi seed; không dùng secret trong `src/app/api/**`.
3. Tại thư mục dự án, sao chép `.env.example` thành `.env.local`; điền URL, publishable key, secret, UUID người dùng. Đặt `SEED_CONFIRM=seed-nexuscargo-synthetic`. File `.env.local` đã được `.gitignore` loại khỏi Git và ZIP bàn giao.

Mẫu **tên biến**:

```dotenv
NEXUSCARGO_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
SEED_OWNER_USER_ID=YOUR_EXISTING_AUTH_USER_UUID
SEED_CONFIRM=seed-nexuscargo-synthetic
```

Các giá trị chữ in hoa ở trên chỉ là chỗ trống minh họa. Không gửi `.env.local` cho ChatGPT của B.

## 2. Chạy migration rồi seed

Chỉ cần CLI Supabase trên máy A; A đăng nhập bằng trình duyệt của mình:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
npm run seed:supabase
```

`YOUR_PROJECT_REF` là project reference trong dashboard Supabase. Migration trong `supabase/migrations/20260923000100_initial_seafood_ops.sql` tạo 9 bảng với chính sách RLS đọc theo tổ chức. Script seed kiểm tra Auth user đã tồn tại, sau đó nạp **500 lô/đơn, 550 container, 2.100 bản ghi chứng từ metadata, 3.000 kết quả kiểm tra, 250 công việc và 500 sự kiện**. Các mốc trong JSON được dịch cùng số ngày để ở gần ngày A chạy seed, giữ nguyên khoảng cách giữa các cutoff. Seed có thể chạy lại: upsert các ID giả lập và đối chiếu tổng số đơn là 500. Nó ghi đè dữ liệu giả lập trùng ID và cập nhật các mốc thời gian; chỉ chạy trên tổ chức dành riêng cho dữ liệu tổng hợp, trước khi nhân viên sửa dữ liệu.

**Giới hạn hiện tại:** chứng từ seed chỉ chứa metadata, chưa có file PDF trong Storage; kết quả kiểm tra từ seed là kịch bản, chưa có bộ quy tắc tái tính khi nhân viên cập nhật. Database thật chưa được tạo bởi ZIP; lệnh `db push` cần tài khoản Supabase của A.

## 3. Chạy API đọc bằng database

```bash
npm ci
npm run dev
```

Đăng nhập qua `POST /api/auth/login` với JSON `{ "email": "...", "password": "..." }`; trình duyệt lưu cookie session. Sau đó `GET /api/auth/me` kiểm tra tài khoản có trong tổ chức, rồi các API `GET /api/dashboard`, `GET /api/shipments`, `GET /api/shipments/{id}`, `GET /api/tasks`, `GET /api/review`, `GET /api/users/assignees` trả dữ liệu từ Supabase. `POST /api/auth/logout` đăng xuất. Các auth endpoint mới này **không đổi** URL hay JSON của các API B đã làm theo hợp đồng.

Chưa đăng nhập nhận `401`; có tài khoản nhưng không thuộc tổ chức nhận `403`. Trên môi trường production, fixture không bao giờ tự bật. Khi A muốn kiểm tra B có còn dùng được mock, đặt `NEXUSCARGO_DATA_SOURCE=fixture` trong `.env.local` rồi chạy lại `npm run dev`.

## 4. Việc kiểm tra trước khi triển khai

- Tổng `GET /api/dashboard` là 500 và hai nhóm hàng mỗi nhóm 250 trong danh sách có lọc.
- `GET /api/shipments?page=1&pageSize=20` có 20 dòng và `total=500`; tìm mã đơn, xem chi tiết, công việc, Review Queue đều đúng `contracts.ts`.
- Tài khoản thuộc tổ chức đọc được; tài khoản ngoài tổ chức không đọc được lô, chứng từ và công việc. Kiểm tra cả API và truy vấn trực tiếp qua Supabase SDK; cơ chế bảo vệ chính nằm ở RLS.
- Không đưa `SUPABASE_SECRET_KEY` hoặc `.env.local` vào commit, ảnh chụp hoặc ZIP cho B.
- A chưa bật Vercel production khi API ghi, kho file riêng tư, logic kiểm tra lại và giao diện đăng nhập chưa chạy trọn luồng.
