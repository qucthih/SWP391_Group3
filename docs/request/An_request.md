# REQUEST SAU KHI TÍCH HỢP ADR-001 — GỬI CÁC THÀNH VIÊN LIÊN QUAN

- **Người gửi:** Dev 1 — An (Phân hệ 1: Portal & API Gateway)
- **Ngày:** 2026-10-05
- **Bối cảnh:** Sau khi review và hiện thực hóa `docs/05_plan/ADR-001-engine-stateless.md`, phần gateway phía Phân hệ 1 đã hoàn thành. Tuy nhiên có một số hạng mục cần sự phối hợp của các thành viên khác để hoàn thiện toàn bộ tích hợp.

---

## 📌 TỔNG QUAN BẢN ĐỒ CỔNG LOCALHOST (PORT MAP) CỦA TOÀN DỰ ÁN

Để tránh hiểu nhầm giữa các thành viên (Frontend Web, API Gateway, Docker Sandbox, AST Engine, Database):

| Phân hệ / Ứng dụng | Thư mục source | Địa chỉ Localhost | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Frontend Web Portal** | `apps/web` | `http://localhost:3000` *(hoặc `5173`)* | Giao diện React/Vite cho Sinh viên & Giảng viên |
| **Backend API Gateway** | `apps/api` | `http://localhost:5000` | REST API, WebSocket (Socket.io), xử lý Auth/DB |
| **AST Plagiarism Engine** | `apps/ast-engine` (Phân hệ 4) | `http://localhost:8000` *(mặc định)* | Python FastAPI parse AST & so khớp Winnowing |
| **MSSQL Database** | Docker / Host | `localhost:1433` | Cơ sở dữ liệu Microsoft SQL Server |
| **Redis / BullMQ** | Docker (Phân hệ 5) | `localhost:6379` | Message Queue cho các tác vụ bất đồng bộ |

> ⚠️ **Lưu ý cho việc kiểm thử & Prompt:**
> - Nếu test **Giao diện Web**: mở trình duyệt tại `http://localhost:3000` (được cấu hình trong `apps/web/vite.config.ts`).
> - Web kết nối gọi dữ liệu về **Backend API**: `http://localhost:5000/api`.
> - Backend API kết nối gọi sang **AST Engine**: mặc định `http://localhost:8000` (cấu hình qua biến `AST_ENGINE_URL`).

---

## 📌 REQUEST 1 — Gửi: Thành viên phụ trách SRS / Database Schema

### Mức độ ưu tiên: 🔴 Cao — cần làm trước khi chạy tích hợp thật

### Yêu cầu 1.1: Cập nhật SRS v1.2 — Bảng `SUBMISSIONS`

Sau khi phân tích ADR-001 §5, bảng `submissions` cần bổ sung cột sau vào SRS:

| Tên cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `ast_check_status` | `NVARCHAR(20)` | ❌ | `'PENDING'` | Trạng thái pipeline AST. Giá trị: `PENDING \| DONE \| FAILED \| NEEDS_REVIEW` |

> **Lưu ý:** Cột này **đã được thêm vào `schema.prisma` và đã apply vào DB** (ngày 2026-10-05 qua `prisma db push`). SRS cần đồng bộ lại để tránh lệch tài liệu.

---

### Yêu cầu 1.2: Cập nhật SRS v1.2 — Bảng `PLAGIARISM_MATCHES`

ADR-001 §5 (cột đề xuất, chưa có trong SRS) yêu cầu thêm 2 cột sau:

| Tên cột | Kiểu dữ liệu | Nullable | Mô tả |
| :--- | :--- | :---: | :--- |
| `level` | `NVARCHAR(10)` | ✅ | Mức độ nguy hiểm: `SAFE \| WARNING \| DANGER` |
| `mode` | `NVARCHAR(5)` | ✅ | Chế độ so sánh engine dùng: `ast \| lex` |

> **Lưu ý:** Hai cột này **chưa có trong `schema.prisma`** — cần Dev 1 thêm sau khi nhận confirm. Phần gateway đã chuẩn bị chỗ lưu `level` và `mode` từ response engine nhưng hiện chưa ghi vào DB vì thiếu cột.

---

### Yêu cầu 1.3: Xác nhận ánh xạ cột bổ sung vào `AST_FINGERPRINTS`

ADR-001 §5 đề xuất thêm vào bảng `ast_fingerprints`:

| Tên cột | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `analysis_mode` | `NVARCHAR(5)` | `ast` hoặc `lex` |
| `fallback_reason` | `NVARCHAR(50)` | NULL nếu không fallback |
| `warnings` | `NVARCHAR(MAX)` | JSON array các warning code |

**Câu hỏi cần confirm:**
1. Ba cột trên có được chấp nhận thêm vào SRS và schema Prisma không?
2. Nếu có, Dev 1 sẽ cập nhật `schema.prisma` + migrate ngay.

---

### Yêu cầu 1.4: Xác nhận `@@unique` trên `PLAGIARISM_MATCHES`

Constraint sau **đã được apply vào DB**:
```sql
UNIQUE (submission_1_id, submission_2_id)
```
Mục đích: đảm bảo mỗi cặp bài chỉ có 1 bản ghi (ADR-001 §5: luôn lưu id nhỏ đứng trước để không trùng cặp A-B và B-A). Cần cập nhật Data Dictionary trong SRS để phản ánh constraint này.

---

## 📌 REQUEST 2 — Gửi: Thành viên phụ trách Phân hệ 4 (AST Engine — Python FastAPI)

### Mức độ ưu tiên: 🔴 Cao — cần xác nhận URL và định dạng response

### Yêu cầu 2.1: Xác nhận URL mặc định và định dạng response của AST Engine
 
Trong kiến trúc toàn hệ thống:
- Frontend chạy tại: `http://localhost:3000`
- Backend API Gateway chạy tại: `http://localhost:5000`
- Phân hệ 4 (AST Engine) dự kiến chạy tại: `http://localhost:8000`
 
Hiện tại Backend Gateway đang cấu hình gọi sang AST Engine qua biến môi trường `AST_ENGINE_URL` (mặc định: `http://localhost:8000`). Vui lòng xác nhận:
1. **URL chính xác** của AST FastAPI service khi chạy local development là gì? (có đúng là `http://localhost:8000` không?)
2. **Docker Compose service name** khi chạy trong container là gì? (ví dụ: `http://ast-engine:8000`)

Sau khi có thông tin, Dev 1 sẽ cập nhật file `.env.example` và `docker-compose.yml`.

### Yêu cầu 2.2: Xác nhận tên field trong response `/compare`

Hợp đồng API tại ADR-001 §4.2 ghi field là `submission_1_id` và `submission_2_id`. Gateway (`astClient`) đang dùng tên này. Nếu implementation thực tế của engine dùng tên khác, vui lòng thông báo để cập nhật `ast.client.ts`.

---

## 📌 REQUEST 3 — Gửi: Thành viên phụ trách Phân hệ 5 (Queue / Worker — BullMQ)

### Mức độ ưu tiên: 🟡 Thấp — cho Milestone tiếp theo

### Yêu cầu 3.1: Xác nhận vị trí `astClient` trong monorepo

ADR-001 §10 và §11.3 đặt câu hỏi: **worker chạy trong gateway hay service riêng?**

Hiện tại `astClient` nằm tại `apps/api/src/services/ast.client.ts`. Khi nâng cấp lên BullMQ:
- Nếu worker **trong gateway**: giữ nguyên vị trí, worker import trực tiếp.
- Nếu worker **service riêng**: cần move `astClient` vào `packages/` (shared package).

Vui lòng confirm architecture để Dev 1 chuẩn bị sẵn cấu trúc thư mục.

### Yêu cầu 3.2: Xác nhận error handling convention cho BullMQ

ADR-001 §10 ghi:
> Lỗi 4xx dùng `UnrecoverableError` (không retry); 5xx và quá thời gian để BullMQ retry.

`astClient` đã phân biệt 4xx (trả `undefined`) vs 5xx (throw Error). Khi tích hợp BullMQ, worker cần wrap:
```typescript
// Pseudo-code:
const result = await astClient.analyze(...);
if (!result) throw new UnrecoverableError("Engine từ chối đầu vào — không retry");
```

Xác nhận convention này trước khi Phân hệ 5 implement.

---

## 📋 Bảng tổng hợp trạng thái

| # | Người nhận | Nội dung | Deadline | Trạng thái |
| :---: | :--- | :--- | :---: | :---: |
| 1.1 | SRS/DB | Thêm `ast_check_status` vào SRS (đã có trong DB) | Sớm nhất | ⏳ Chờ |
| 1.2 | SRS/DB | Thêm `level`, `mode` vào SRS bảng `PLAGIARISM_MATCHES` | Sớm nhất | ⏳ Chờ |
| 1.3 | SRS/DB | Confirm 3 cột bổ sung cho `AST_FINGERPRINTS` | Sớm nhất | ⏳ Chờ |
| 1.4 | SRS/DB | Ghi `@@unique` vào Data Dictionary SRS | Sớm nhất | ⏳ Chờ |
| 2.1 | Phân hệ 4 | Xác nhận URL engine local & docker | Trước khi test | ⏳ Chờ |
| 2.2 | Phân hệ 4 | Xác nhận tên field `/compare` response | Trước khi test | ⏳ Chờ |
| 3.1 | Phân hệ 5 | Vị trí `astClient` trong monorepo khi có BullMQ | Milestone tiếp | 🔵 Chưa bắt đầu |
| 3.2 | Phân hệ 5 | Convention `UnrecoverableError` với BullMQ | Milestone tiếp | 🔵 Chưa bắt đầu |

---

> Mọi câu hỏi/phản hồi về phần gateway, liên hệ **An — Dev 1 (Phân hệ 1)**.
