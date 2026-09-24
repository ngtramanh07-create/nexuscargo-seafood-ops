# Bắt đầu với NexusCargo đã ghép A + B đợt 2

Gói này đã ghép backend của A với **toàn bộ giao diện B đợt 2**. Đợt 2 đã bao gồm đợt 1, nên không cần ghép ZIP B đợt 1 thêm lần nữa.

Giao diện dùng font **Be Vietnam Pro** có hỗ trợ tiếng Việt. Lệnh `npm.cmd ci` sẽ cài font cùng các thư viện của dự án; không cần tự cài font trên Windows.

## Chạy trên Windows

1. Nhấp chuột phải ZIP > **Extract All**. Trong VS Code, dùng **File > Open Folder** và chọn thư mục `nexuscargo` chứa `package.json`, `src` và `supabase`.
2. Nếu một cửa sổ VS Code khác vẫn đang chạy dự án cũ, vào terminal đó và nhấn **Ctrl+C** để dừng, tránh trùng cổng 3000.
3. Trong VS Code mới, chọn **Terminal > New Terminal**, gõ từng lệnh và đợi lệnh đầu chạy xong:

   ```powershell
   npm.cmd ci
   npm.cmd run dev
   ```

   `npm.cmd` tránh lỗi PowerShell chặn `npm.ps1`. Không cần thay đổi chính sách bảo mật của Windows.
4. Mở `http://localhost:3000` trên trình duyệt. Dùng menu hoặc mở trực tiếp:

   - Dashboard: `http://localhost:3000/`
   - Danh sách đơn: `http://localhost:3000/shipments`
   - Chi tiết đơn: `http://localhost:3000/shipments/SHP-0006`
   - Công việc: `http://localhost:3000/tasks`
   - Duyệt chứng từ: `http://localhost:3000/review`

   Ở bản này trang Công việc có **518 công việc mẫu: 275 chưa làm, 100 đang xử lý, 143 đã hoàn tất**. Lọc theo **bộ phận xử lý** để xem Chứng từ, Vận tải / Hiện trường và Kiểm soát chất lượng. Các việc đã hoàn tất có chứng từ SI giả lập đã xác nhận làm bằng chứng. Nếu trang vẫn hiện `250 / 250 / 0 / 0` và tên Nguyễn An, máy đang chạy thư mục ZIP cũ; dừng tiến trình cũ bằng Ctrl+C và mở đúng thư mục `nexuscargo` vừa giải nén.

## Trạng thái chức năng

- Các trang đọc dữ liệu từ API của A. Trong `npm.cmd run dev` khi chưa cấu hình Supabase, dữ liệu là **500 đơn giả lập** trong `data/shipments.json`.
- Nút giao việc, bắt đầu/hoàn tất việc, duyệt gợi ý và thêm chứng từ đang dùng **mô phỏng trên trình duyệt**. Tải lại trang sẽ mất các thay đổi; file tải lên chưa được lưu. Không coi kết quả mô phỏng là cập nhật thật trong database.
- Migration và script seed Supabase nằm trong gói nhưng chưa tự chạy; A xem `docs/A-SUPABASE-SETUP.md` để tạo project, chạy migration và nạp 500 đơn vào database riêng của nhóm.
- Chưa có giao diện đăng nhập dành cho chế độ Supabase. A cần nối giao diện đăng nhập, API ghi, kho file riêng tư và kiểm tra lại quy tắc nghiệp vụ trước khi đưa vào dùng thật hoặc triển khai production.

Để kiểm tra sau khi sửa code, chạy `npm.cmd run lint`, `npm.cmd run build` và `npm.cmd run typecheck`. Nếu `typecheck` báo thiếu `LayoutProps` ngay sau khi giải nén, chạy `npm.cmd run build` trước để Next.js tạo các kiểu cần thiết.

`HANDOFF.md` là tài liệu người B bàn giao, liệt kê toàn bộ màn hình và phần đang mô phỏng. `docs/api-contract.md` mô tả API dùng chung.
