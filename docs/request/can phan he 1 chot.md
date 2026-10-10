# Những điều cần An chốt (AST Engine ↔ Gateway ↔ DB)

- **Gửi:** An (Dev 1, Phân hệ 1, gateway + database)
- **Từ:** Nhật (Phân hệ 4) · **Ngày:** 2026-10-10
- **Cách dùng:** tick ✅/❌ vào cột *Quyết định của An* ở §1 và §2 (khoảng 10 phút). Chi tiết hợp đồng API nằm ở `HUONG_DAN_TICH_HOP_AST_ENGINE.md`; Swagger của engine: `http://localhost:8000/docs`.
- **Tình trạng:** Nhật đã đổi `Dockerfile` sang cổng 8000. Thịnh (Phân hệ 5) đã đồng ý các điểm phía worker. Còn chờ An.

---

## 1. Cần An xác nhận (Nhật và Thịnh đã đồng ý, chỉ thiếu An)

| # | Nội dung | Phía An phải làm gì | Quyết định của An |
|---|---|---|:---:|
| A1 | **Engine không ghi DB**, gateway ghi `AST_FINGERPRINTS` và `PLAGIARISM_MATCHES` (ADR-001) | Gateway là nơi duy nhất ghi 2 bảng này | ✅ Đồng ý |
| A2 | **Chỉ một client** gọi engine: `apps/api/src/services/ast.client.ts` | Thịnh/worker không viết client thứ hai | ✅ Đồng ý |
| A3 | **An viết `ast.service.ts`** với hàm `check(submissionId)` | Gom luồng: `/analyze` → lưu fingerprint → đọc fingerprint cả lớp → `/compare/batch` → lưu matches → giữ điểm nếu `DANGER` (xem `HUONG_DAN` §4). Lý do: worker của Thịnh không có kết nối DB nên không tự lấy được fingerprint các bài khác | ✅ Đồng ý |
| A4 | **Ngưỡng do engine quyết**: dùng `level`/`flag` từ engine, không tự tính 30/60 | Không hard-code ngưỡng ở gateway. Đúng 60% vẫn là `WARNING` | ✅ Đồng ý |
| A5 | **Bài lỗi cú pháp không bị bỏ qua**: engine vẫn trả 200 + cảnh báo, so bằng chế độ `lex` | Không đặt `SKIPPED` cho lỗi. Lý do: thêm một dấu `}` thừa là né được kiểm tra | ✅ Đồng ý |
| A6 | **Cổng engine 8000**, biến `AST_ENGINE_URL` | Thêm service `ast-engine` vào `docker-compose.yml` (`http://ast-engine:8000`) và `AST_ENGINE_URL` vào `.env.example` | ✅ Đã xong |

## 2. Cần An quyết định (chưa ai chốt)

### B1. Ánh xạ `ast_check_status`

| Tình huống | Giá trị đề xuất |
|---|---|
| 200, không có cảnh báo | `DONE` |
| 200 nhưng có `warnings` hoặc `fallback_reason` | `NEEDS_REVIEW` (**giá trị mới**) |
| 400/422 hoặc hết lượt retry | `FAILED` (hiện cho giảng viên, có nút chạy lại) |

Câu hỏi: **thêm `NEEDS_REVIEW`** vào `ast_check_status` được không? Nếu không muốn thêm thì chọn: gộp vào `DONE` và dùng `warnings` để hiển thị (mất khả năng lọc "bài cần xem tay").
`DANGER` xử lý riêng ở điểm số (`SCORE_WITHHELD` + `SCORE_AUDIT_LOGS`), không đi qua `ast_check_status`.

**Quyết định:** Đồng ý thêm `NEEDS_REVIEW` (đã hỗ trợ trong code và DB).

### B2. Cột mới trong DB (cần phối hợp người làm SRS)

| Bảng | Cột | Kiểu đề xuất | Giá trị engine trả |
|---|---|---|---|
| `PLAGIARISM_MATCHES` | `level` | `NVARCHAR(10)` | `SAFE` / `WARNING` / `DANGER` |
| `PLAGIARISM_MATCHES` | `mode` | `NVARCHAR(5)` | `ast` / `lex` |
| `AST_FINGERPRINTS` | `analysis_mode` | `NVARCHAR(5)` | `ast` / `lex` |
| `AST_FINGERPRINTS` | `fallback_reason` | `NVARCHAR(50)`, cho phép NULL | `SYNTAX_ERROR`, `PARSER_FAILED`, `NORMALIZATION_FAILED`, `PARSE_TIMEOUT` |
| `AST_FINGERPRINTS` | `warnings` | `NVARCHAR(MAX)` (JSON) | mảng chuỗi |
| `Submission` | `ast_check_status` | `PENDING / DONE / NEEDS_REVIEW / FAILED` | do gateway đặt |

Nhật đã đối chiếu: mọi giá trị engine trả đều vừa kiểu cột (dài nhất 20 ký tự). Câu hỏi: thêm các cột này được không, và SRS đã cập nhật chưa?

**Quyết định:** Đồng ý thêm đủ cả 5 cột. `ast_check_status` đã có trong DB; An sẽ cập nhật tiếp các cột còn lại vào schema.prisma.

### B3. Thứ tự cặp trong `PLAGIARISM_MATCHES` (UNIQUE)

Quy ước "id nhỏ đứng trước". Hai lưu ý bắt buộc:
1. **Nếu đảo cặp thì phải đảo cả `a_lines` và `b_lines`** trong từng phần tử `matched_fragments`. `a_lines` luôn thuộc `submission_1`. Quên đảo thì giảng viên mở sai đoạn code.
2. **So id đúng kiểu của khóa chính.** Nếu PK là số, đổi sang số trước khi so (so chuỗi thì `"10" < "9"`).

**Quyết định:** đồng ý ☑ (đã code xong logic đảo a_lines/b_lines trong submission.controller.ts)

### B4. Worker ↔ Gateway ở M3 (Thịnh hỏi An)

| Cách | Ưu | Nhược |
|---|---|---|
| **1. Endpoint nội bộ** `POST /api/internal/submissions/:id/ast-check`, xác thực `x-internal-key` (**Nhật gợi ý**, vì `apps/queue-worker` đang là tiến trình riêng) | Giữ worker tách rời, BullMQ vẫn có lợi | Thêm một endpoint và một khóa phải bảo vệ |
| **2. Chạy worker chung tiến trình với gateway** | Bỏ được endpoint, gọi thẳng `check()` | Worker và gateway dính nhau, một bên treo ảnh hưởng bên kia |

Nếu chọn cách 1, cần đủ các điều kiện:
- `x-internal-key` chỉ nằm trong `.env` của gateway và worker, không lộ ra trình duyệt.
- Lỗi đầu vào trả **4xx**, lỗi tạm trả **5xx** (để worker chọn `UnrecoverableError` hay retry).
- **Idempotent**: gọi lại cùng `submissionId` không nhân đôi bản ghi (upsert).
- Timeout HTTP của worker **lớn hơn tổng** timeout gateway→engine (khoảng 10s `/analyze` + khoảng 30s `/compare/batch`; số của batch chưa đo, An thử với lớp lớn).
- Response: `{ status, similarityPercent, isPlagiarism, matchedPairs }`. `similarityPercent` = cặp cao nhất của bài đó, `isPlagiarism` = có ít nhất một cặp `DANGER`.

**Lưu ý M2:** theo hướng đã chọn (gọi đồng bộ), route nộp bài gọi thẳng `astService.check()`, **chưa cần endpoint này**. Chỉ cần chốt khi làm M3.

**Quyết định:** ☑ Cách 1  ☐ Cách 2

### B5. `retry` của BullMQ (An/Thịnh thống nhất)

`attempts` là tổng số lần thử **đã tính lần đầu**. SRS (US12, NFR-13) ghi "retry tối đa 3 lần" thì khớp `attempts: 4`. Chọn theo đúng chữ SRS. Hết lượt thì đặt `FAILED` và báo giảng viên.

**Quyết định:** Chọn `attempts: 4` (1 lần đầu + 3 lần retry chuẩn theo SRS).

### B6. Bảo mật

- Engine **chưa có xác thực**. Chỉ cho chạy trong mạng nội bộ docker-compose, **không mở port ra ngoài**. Nếu cần mở thì Nhật thêm API key ở header.
- Màn hình sinh viên (khi appeal) **không** hiện code hay danh tính sinh viên đối chiếu; chỉ giảng viên thấy đầy đủ `matched_fragments`.

**Quyết định:** đồng ý ☑ (đã code xong bộ lọc RBAC ẩn thông tin nhạy cảm cho Student)

---

## 3. Việc An làm sau khi chốt

- [x] Giữ `ast.client.ts` là client duy nhất. Chỉ **400 và 422** là "không retry"; mọi lỗi khác (kể cả 404, 401, 403, 408, 429, 5xx) **ném lỗi**. Log nguyên văn `detail` (lỗi 422 có hai dạng: danh sách của FastAPI, hoặc `{code, message}` của engine).
- [x] Tạo `apps/api/src/services/ast.service.ts` (`check(submissionId)`).
- [x] Chuẩn hóa cặp (B3), upsert fingerprint và matches, xử lý nộp lại: ghi đè fingerprint, xóa/tính lại matches liên quan.
- [x] Thêm cột (B2) vào Prisma; thêm service vào compose; thêm `AST_ENGINE_URL`.
- [x] Tạo endpoint nội bộ `POST /api/submissions/internal/:submissionId/ast-check` bảo vệ bằng `x-internal-key` sẵn sàng cho Worker BullMQ (M3).

## 4. Những điều An nên biết

- `SAFE` **không** có nghĩa là "chắc chắn không đạo văn". Engine bắt tốt đổi tên, comment, đảo thứ tự hàm (100% trên dữ liệu thử), nhưng với bài AI viết lại mạnh thì mới đạt khoảng 25% và 11% (dữ liệu mô phỏng, mẫu nhỏ). Giao diện nên ghi "không phát hiện trùng đáng kể".
- Khi `note = INSUFFICIENT_DATA` thì `similarity_percent = 0` **không** có nghĩa là an toàn.
- Hỏi Nhật khi: engine trả khác hợp đồng, cần thêm field/endpoint, muốn đổi ngưỡng/`k`/`window`.
