# NexusCargo Seafood Ops — hợp đồng API v1.1.0

Tài liệu này là thỏa thuận triển khai giữa **A (backend, database, logic, AI, triển khai)** và **B (frontend)**. Đặt file TypeScript đi kèm tại `src/types/contracts.ts`, đặt tài liệu này tại `docs/api-contract.md`. A gửi cùng một bản của cả hai file cho B trước khi B bắt đầu viết giao diện. Khi cần thay đổi, A tăng phiên bản và gửi lại **cả hai file**.

## 1. Phạm vi và quy ước chung

**Tương thích B đợt 2:** Không đổi URL, trường cũ, enum trạng thái hoặc cách phân trang. `GET /api/shipments/{id}` có thêm `seafoodProfile` (tùy chọn, có thể null ở dữ liệu cũ) và `containers[].temperatureReadings` (tùy chọn). Các màn hình B cũ vẫn chạy; bản tích hợp mới hiển thị hai trường bổ sung. Xem [SEAFOOD-RULES.md](SEAFOOD-RULES.md) để phân biệt điều kiện khách hàng giả lập với yêu cầu pháp lý.

**Nhãn giao việc ở dữ liệu mẫu:** `assigneeId` là mã đầu mối xử lý giả lập và `assigneeName` hiển thị tên **bộ phận**, giữ tên khóa JSON cũ để tương thích API. `GET /api/users/assignees` cung cấp danh mục ba bộ phận mẫu. Người đăng nhập thật qua Supabase Auth vẫn là tài khoản cá nhân; bộ phận xử lý không phải tài khoản đăng nhập và không cấp quyền truy cập theo tên bộ phận.

- Hệ thống quản lý **500 đơn xuất khẩu giả lập**, gồm tôm đông lạnh (`SHRIMP`) và cá tra đông lạnh (`PANGASIUS`). Trong phiên bản đầu, mỗi đơn gắn với đúng một lô hàng/booking; một lô có thể có nhiều container.
- Danh sách `GET /api/shipments` lấy dữ liệu từ database và phân trang ở server. Mock của B có thể tạo 500 dòng để kiểm tra giao diện nhưng không thay thế seed database của A.
- Backend tính `status`, `priority`, `riskReasons`, kết quả kiểm tra và `latestStartAt`. Frontend chỉ hiển thị kết quả, lọc, nhập/chỉnh dữ liệu và gọi API. Không sao chép thuật toán tính trạng thái sang frontend.
- Tất cả response JSON thành công có dạng `{ "data": ... }`; lỗi có dạng `{ "error": { "code": "...", "message": "..." } }`.
- Thời gian là ISO 8601 **có múi giờ**: `2026-10-06T17:00:00+07:00` hoặc dạng `Z`. Frontend hiển thị theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`); **không tự đổi ngày/giờ để tính cutoff**.
- `null` có nghĩa chưa có/chưa xác nhận; giao diện hiển thị “Chưa có thông tin” hoặc “Chưa xác nhận”, không coi là hoàn tất.
- API yêu cầu người dùng đăng nhập. A quản lý session, quyền trên API và quyền truy cập file. B không lưu secret, token có quyền cao hay quy tắc phân quyền trong trình duyệt.
- Mã lô `id`, mã đơn `orderNo`, booking `bookingNo` là ba trường khác nhau. Mỗi URL chi tiết dùng `id`; tìm kiếm chấp nhận `orderNo` và `bookingNo`.
- Quy tắc chứng từ/chứng nhận tùy tuyến hàng, khách hàng và thông tin booking đã xác nhận. Dữ liệu giả lập không chứng minh rằng một giấy tờ luôn bắt buộc cho mọi thị trường.

### Ý nghĩa các trạng thái

| Trường | Giá trị | Hiển thị gợi ý |
| --- | --- | --- |
| `ShipmentStatus` | `READY` | Sẵn sàng |
| | `AT_RISK` | Có nguy cơ trễ |
| | `BLOCKED` | Cần xử lý lỗi/thiếu dữ liệu bắt buộc |
| | `COMPLETED` | Đã hoàn tất, có bằng chứng |
| `CheckStatus` | `PASS` | Đã xác nhận đạt |
| | `MISSING` | Thiếu dữ liệu/bằng chứng |
| | `MISMATCH` | Thông tin không khớp |
| | `PENDING_REVIEW` | Chờ nhân viên xác nhận |
| | `STALE` | Cần kiểm tra lại do dữ liệu nguồn thay đổi |
| `DocumentStatus` | `PROCESSING` | Đang xử lý/trích xuất |
| | `PENDING_REVIEW` | Chờ kiểm tra dữ liệu trích xuất |
| | `VERIFIED` | Đã xác nhận |
| | `STALE` | Phiên bản cần kiểm tra lại |
| | `REJECTED` | Bị từ chối |
| | `FAILED` | Không xử lý được, cần thao tác lại |

`COMPLETED` không được suy ra chỉ vì một nhân viên bấm hoàn tất một việc. Backend đánh giá toàn bộ điều kiện, bằng chứng và các việc liên quan trước khi trả về trạng thái mới.

## 2. Endpoint để B dựng giao diện

| Phương thức | URL | Request | Kiểu `data` thành công |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard` | Không có | `DashboardSummary` |
| `GET` | `/api/shipments` | `search`, `product`, `status`, `page`, `pageSize`, `sort` | `Page<ShipmentListItem>` |
| `GET` | `/api/shipments/{shipmentId}` | Không có | `ShipmentDetail` |
| `GET` | `/api/tasks` | `status`, `assigneeId`, `page`, `pageSize` | `Page<Task>` |
| `PATCH` | `/api/tasks/{taskId}` | `UpdateTaskRequest` | `UpdateTaskResult` |
| `GET` | `/api/review` | `page`, `pageSize` | `Page<ReviewItem>` |
| `PATCH` | `/api/review/{reviewId}` | `ReviewDecisionRequest` | `ReviewDecisionResult` |
| `POST` | `/api/shipments/{shipmentId}/documents` | `multipart/form-data`: `file`, `type` | `UploadDocumentResult` |
| `GET` | `/api/documents/{documentId}/file` | Không có | File/luồng tải có kiểm tra quyền |
| `GET` | `/api/users/assignees` | Không có | `AssigneeOption[]` |

**Phân trang:** `page` bắt đầu từ `1`, mặc định `1`; `pageSize` mặc định `20`, tối đa `50`. Response có `items`, `page`, `pageSize`, `total`. Nếu trang vượt phạm vi, `items: []` và `total` giữ nguyên.

**Lọc và sắp xếp:** `product` dùng `SHRIMP`/`PANGASIUS`; `status` dùng enum `ShipmentStatus`; `search` tìm mã đơn/booking; `sort=urgency` (mặc định) hoặc `sort=etd`. Backend quyết định thứ tự theo mốc cần xử lý và mức độ ưu tiên; khi bằng nhau sắp theo `id` tăng dần để phân trang ổn định. `GET /api/tasks` mặc định ưu tiên các việc chưa xong có `latestStartAt` sớm; việc không có hạn phải được đánh dấu là chưa xác định cutoff, không tự gán giờ.

**Quy ước HTTP:** `GET` thành công `200`; tạo tài liệu và đưa vào xử lý `202`; sửa thành công `200`; request sai `400`; chưa đăng nhập `401`; không có quyền `403`; không tồn tại `404`; phiên bản tác vụ đã đổi `409`; file vượt giới hạn do A cấu hình `413`; file không thể xử lý `422`; AI tạm không hoạt động `503`; lỗi hệ thống `500`.

### 2.1. Dashboard

`GET /api/dashboard` trả về các thống kê **theo dữ liệu đã seed hoặc dữ liệu thực**, không phải số viết cứng trong UI:

```json
{
  "data": {
    "totalOrders": 500,
    "statusCounts": {
      "READY": 140,
      "AT_RISK": 150,
      "BLOCKED": 85,
      "COMPLETED": 125
    },
    "tasksDueSoon": 36,
    "urgentTasks": [
      {
        "id": "TASK-0001",
        "shipmentId": "SHP-0001",
        "orderNo": "EXP-2026-0001",
        "sourceCheckCode": "SEAL_SI_MATCH",
        "title": "Cập nhật seal trên SI",
        "description": "Thay seal cũ trên SI bằng seal đã xác nhận, tải lên SI mới và kiểm tra lại.",
        "status": "OPEN",
        "priority": "CRITICAL",
        "assigneeId": "USR-001",
        "assigneeName": "Bộ phận Chứng từ",
        "dueAt": "2026-10-06T17:00:00+07:00",
        "latestStartAt": "2026-10-06T13:00:00+07:00",
        "evidenceDocumentId": null,
        "completionNote": null,
        "version": 1,
        "updatedAt": "2026-10-06T08:45:00+07:00"
      }
    ],
    "asOf": "2026-10-06T09:00:00+07:00"
  }
}
```

Đây là **JSON minh họa**, không phải chỉ tiêu bắt buộc của bộ 500 đơn. `totalOrders` bằng tổng bốn số trong `statusCounts`. `tasksDueSoon` đếm các việc chưa hoàn thành mà `latestStartAt` nằm từ hiện tại đến 24 giờ tiếp theo; việc đã quá hạn cũng phải được hiển thị rõ trong danh sách việc.

### 2.2. Danh sách và chi tiết lô

Ví dụ: `GET /api/shipments?search=EXP-2026-0001&product=SHRIMP&status=BLOCKED&page=1&pageSize=20&sort=urgency`:

```json
{
  "data": {
    "items": [
      {
        "id": "SHP-0001",
        "orderNo": "EXP-2026-0001",
        "bookingNo": "BK-SF-0001",
        "bookingVersion": 2,
        "product": "SHRIMP",
        "customerName": "Công ty Thủy sản Minh Hải (giả lập)",
        "destination": "Yokohama, Nhật Bản",
        "vesselName": "Ocean Star",
        "voyageNo": "OS102",
        "etd": "2026-10-08T07:00:00+07:00",
        "cutoffs": {
          "si": "2026-10-06T17:00:00+07:00",
          "vgm": "2026-10-07T12:00:00+07:00",
          "cy": "2026-10-07T18:00:00+07:00"
        },
        "status": "BLOCKED",
        "priority": "CRITICAL",
        "riskReasons": ["Seal trên SI khác với seal container đã xác nhận."],
        "assigneeName": "Bộ phận Chứng từ",
        "containerCount": 1,
        "updatedAt": "2026-10-06T08:45:00+07:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

`GET /api/shipments/SHP-0001` trả một đối tượng `ShipmentDetail`: bao gồm **toàn bộ trường của `ShipmentListItem`** và thêm `requiredSetPointCelsius`, `containers`, `documents`, `checks`, `tasks`, `auditEvents`. Minh họa các trường bổ sung:

```json
{
  "requiredSetPointCelsius": -18,
  "containers": [
    {
      "id": "CTR-0001",
      "containerNo": "MSCU1234567",
      "sealNo": "SL-NEW-001",
      "setPointCelsius": -18,
      "reeferConnectionConfirmed": true
    }
  ],
  "documents": [
    {
      "id": "DOC-0001",
      "shipmentId": "SHP-0001",
      "type": "SI",
      "status": "VERIFIED",
      "fileName": "shipping-instruction-v1.pdf",
      "version": 1,
      "uploadedAt": "2026-10-05T16:00:00+07:00",
      "reviewedAt": "2026-10-05T16:30:00+07:00"
    }
  ],
  "checks": [
    {
      "code": "SEAL_SI_MATCH",
      "title": "Đối chiếu seal container và SI",
      "status": "MISMATCH",
      "message": "SI phiên bản 1 ghi seal SL-OLD-001; container xác nhận SL-NEW-001.",
      "relatedDocumentIds": ["DOC-0001"],
      "requiredBy": "2026-10-06T17:00:00+07:00",
      "updatedAt": "2026-10-06T08:45:00+07:00"
    }
  ],
  "tasks": [
    {
      "id": "TASK-0001",
      "shipmentId": "SHP-0001",
      "orderNo": "EXP-2026-0001",
      "sourceCheckCode": "SEAL_SI_MATCH",
      "title": "Cập nhật seal trên SI",
      "description": "Thay seal cũ trên SI bằng seal đã xác nhận, tải lên SI mới và kiểm tra lại.",
      "status": "OPEN",
      "priority": "CRITICAL",
      "assigneeId": "USR-001",
      "assigneeName": "Bộ phận Chứng từ",
      "dueAt": "2026-10-06T17:00:00+07:00",
      "latestStartAt": "2026-10-06T13:00:00+07:00",
      "evidenceDocumentId": null,
      "completionNote": null,
      "version": 1,
      "updatedAt": "2026-10-06T08:45:00+07:00"
    }
  ],
  "auditEvents": [
    {
      "id": "EVT-0001",
      "actorName": "Nguyễn An",
      "action": "CONTAINER_SEAL_UPDATED",
      "description": "Cập nhật seal container; yêu cầu đối chiếu lại SI.",
      "createdAt": "2026-10-06T08:45:00+07:00"
    }
  ]
}
```

Phần JSON trên là **các trường thêm vào**, không phải toàn bộ response. `documents` hiển thị phiên bản hiện hành; A giữ các phiên bản cũ trong lịch sử để giải thích vì sao kiểm tra bị mở lại. Giao diện phải tách bạch `document.status = VERIFIED` (SI cũ từng được xác nhận) và `check.status = MISMATCH` (SI đó hiện không khớp seal mới).

### 2.3. Việc cần làm và cập nhật

`GET /api/tasks?status=OPEN&page=1&pageSize=20` trả `{ "data": { "items": [Task], "page": 1, "pageSize": 20, "total": 23 } }` theo kiểu `Page<Task>`.

Ví dụ giao việc: `PATCH /api/tasks/TASK-0001` với body:

```json
{ "action": "ASSIGN", "expectedVersion": 1, "assigneeId": "USR-001" }
```

Bắt đầu làm: `{ "action": "START", "expectedVersion": 2 }`. Hoàn tất: 

```json
{
  "action": "COMPLETE",
  "expectedVersion": 3,
  "evidenceDocumentId": "DOC-0002",
  "note": "Đã tải SI mới có seal đúng và đối chiếu lại."
}
```

Trả `{ "data": { "task": Task, "shipmentStatus": "..." } }` với Task mới và `version` tăng lên. A kiểm tra bằng chứng thuộc **đúng lô** và phù hợp với việc trước khi chấp nhận hoàn tất; nếu cần xác nhận lại chứng từ thì việc vẫn chưa được coi là giải quyết. Nếu `expectedVersion` cũ, trả `409 CONFLICT`; B báo người dùng tải lại dữ liệu. `dueAt` là hạn nghiệp vụ; `latestStartAt` là mốc bắt đầu xử lý được backend tính từ hạn, thời lượng và khoảng đệm.

### 2.4. Review Queue của AI

`GET /api/review?page=1&pageSize=20` chỉ trả những chứng từ đang chờ nhân viên kiểm tra. Mẫu một item:

```json
{
  "id": "REV-0001",
  "shipmentId": "SHP-0001",
  "orderNo": "EXP-2026-0001",
  "document": {
    "id": "DOC-0002",
    "shipmentId": "SHP-0001",
    "type": "SI",
    "status": "PENDING_REVIEW",
    "fileName": "shipping-instruction-v2.pdf",
    "version": 2,
    "uploadedAt": "2026-10-06T09:05:00+07:00",
    "reviewedAt": null
  },
  "fields": [
    {
      "key": "sealNo",
      "label": "Số seal",
      "suggestedValue": "SL-NEW-001",
      "confirmedValue": null,
      "confidence": 0.93,
      "sourcePage": 1,
      "needsReview": true
    }
  ],
  "createdAt": "2026-10-06T09:06:00+07:00"
}
```

`confidence` là số từ `0` đến `1`, hoặc `null` nếu nhà cung cấp trích xuất không trả về chỉ số này. Đây là thông tin hỗ trợ kiểm tra, **không phải sự bảo đảm dữ liệu đúng**. `suggestedValue` chưa phải giá trị xác nhận; B cho người dùng sửa bằng một ô nhập. `sourcePage` cho biết trang gợi ý; xem file qua `GET /api/documents/DOC-0002/file` (kiểm tra quyền). Nếu xử lý AI thất bại, document là `FAILED` trong trang chi tiết và không có ReviewItem để duyệt nhầm.

Xác nhận: `PATCH /api/review/REV-0001`:

```json
{
  "decision": "APPROVE",
  "corrections": [{ "key": "sealNo", "confirmedValue": "SL-NEW-001" }]
}
```

`corrections` chứa **chỉ các trường nhân viên sửa**; trường không sửa dùng `suggestedValue` sau khi nhân viên xem và chấp nhận. Nếu một trường bắt buộc vẫn `null`, backend trả `400 VALIDATION_ERROR`; nhân viên phải nhập rồi xác nhận. Từ chối: `{ "decision": "REJECT", "note": "Tài liệu không thuộc booking này" }`. Kết quả thành công: `{ "data": { "document": DocumentRecord, "shipmentStatus": "..." } }`. Sau đó B tải lại chi tiết lô và danh sách việc để hiện kết quả đánh giá mới.

### 2.5. Tải chứng từ và chọn người phụ trách

`POST /api/shipments/SHP-0001/documents`: gửi `FormData` với `file` (PDF/ảnh) và `type` (`DocumentType`). Trả `202` với `data.document.status = "PROCESSING"`. A cấu hình loại file và giới hạn dung lượng, kiểm tra quyền, lưu file riêng tư, xử lý trích xuất rồi cập nhật `PENDING_REVIEW` hoặc `FAILED`. B có thể hiển thị trạng thái đang xử lý và tải lại chi tiết lô/Review Queue để nhận kết quả; API phiên bản này chưa hứa hẹn cập nhật thời gian thực.

`GET /api/users/assignees` trả về `AssigneeOption[]` gồm `id`, `name`, `role` để B hiện danh sách **bộ phận xử lý** ở bản mẫu. Danh mục bộ phận là nơi điều phối công việc, không phải tài khoản Supabase Auth hay quyền truy cập. Trước khi vận hành thật, A cần thiết kế nhóm nghiệp vụ và quyền thành viên riêng.

## 3. Lỗi mẫu và xử lý ở frontend

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Công việc đã được người khác cập nhật. Vui lòng tải lại.",
    "details": { "expectedVersion": "3", "currentVersion": "4" }
  }
}
```

| Mã | Cách B hiển thị |
| --- | --- |
| `VALIDATION_ERROR` | Chỉ ra trường cần sửa; giữ dữ liệu người dùng vừa nhập |
| `UNAUTHENTICATED` | Chuyển tới đăng nhập do A cung cấp |
| `FORBIDDEN` | Hiển thị không có quyền, không thực hiện lại thao tác |
| `NOT_FOUND` | Thông báo dữ liệu không còn tồn tại |
| `CONFLICT` | Yêu cầu tải lại lô/việc trước khi gửi lần nữa |
| `FILE_TOO_LARGE`, `UNPROCESSABLE_DOCUMENT` | Giải thích lỗi file và cho chọn file khác |
| `AI_UNAVAILABLE`, `INTERNAL_ERROR` | Thông báo tạm thời, giữ nguyên dữ liệu nhập |

## 4. Quy tắc tính toán A phải tuân theo

1. Lưu dữ liệu gốc, phiên bản và nguồn; AI chỉ đề xuất giá trị cho nhân viên xác nhận.
2. Dùng SI/VGM/CY cutoff của **chính booking đã được xác nhận**, không áp một số giờ cố định lên mọi đơn. Nếu thiếu cutoff thì để `null`, tạo kiểm tra/việc tìm hạn và đánh dấu rủi ro phù hợp.
3. Với mỗi lỗi, tạo/duy trì CheckResult và Task có `sourceCheckCode`, lý do và `dueAt` phù hợp. `latestStartAt = dueAt − thời lượng xử lý dự kiến − khoảng đệm` khi có đủ dữ liệu; nếu không, trả `null` và nêu rõ việc thiếu hạn.
4. Khi booking, container, seal, chỉ dẫn nhiệt độ hoặc chứng từ thay đổi, vô hiệu hóa những kiểm tra phụ thuộc (`STALE`), chạy lại và ghi `AuditEvent`. Không bỏ mất bằng chứng hoặc phiên bản cũ.
5. Đánh giá lại lô sau khi nhân viên xác nhận Review Queue và sau khi hoàn tất việc. Không để UI tự sửa `status`.
6. `READY` chỉ khi tất cả kiểm tra bắt buộc hiện hành đạt; `COMPLETED` cần mốc hoàn tất và bằng chứng; `AT_RISK`/`BLOCKED` dựa vào kết quả kiểm tra, khả năng xử lý và cutoff. A ghi các quy tắc chi tiết trong module backend và dùng cùng một module cho API danh sách, Dashboard và chi tiết.

## 5. Bàn giao và kiểm tra tương thích

**A giao B:** ZIP khung Next.js, `src/types/contracts.ts`, `docs/api-contract.md`, JSON mẫu, quyền sửa file và lệnh chạy. **B giao A:** các file frontend, `HANDOFF.md`, danh sách dependency mới và các màn hình đã thử. B không gửi `.env.local`, `node_modules` hoặc thư mục build.

Checklist ghép mã của A:

- [ ] B build được frontend với mock mà không sửa `contracts.ts`.
- [ ] Tắt mock và ghép API thật: tìm kiếm, lọc, phân trang được trên 500 đơn đã lưu trong database.
- [ ] Mọi chi tiết lô hiển thị đúng cutoff, container, check, task và lịch sử.
- [ ] Đổi seal làm SI cũ bị kiểm tra lại; chứng từ mới đi qua Review Queue.
- [ ] Xác nhận chứng từ làm trạng thái/check/task thay đổi theo logic backend.
- [ ] Hoàn tất task cần bằng chứng; `409` khi phiên bản task không còn mới.
- [ ] API và file không truy cập được khi chưa đăng nhập/không đủ quyền.
- [ ] Build và các luồng trên vẫn chạy sau khi A triển khai Vercel.

**Đổi hợp đồng:** Nếu thêm/xóa/đổi tên trường hoặc endpoint, A sửa cả hai file, ghi thay đổi và tăng version. B cập nhật mock và component theo đúng version A gửi; A kiểm tra ghép từng gói trước khi commit.
