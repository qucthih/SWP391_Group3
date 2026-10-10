# PHẢN HỒI VÀ CHỐT PHƯƠNG ÁN TÍCH HỢP — AN (PHÂN HỆ 1)

- **Người gửi:** An (Dev 1 — Phân hệ 1: Portal & API Gateway / DB)
- **Người nhận:** Nhật (Phân hệ 4 — AST Engine) · Thịnh (Phân hệ 5 — Queue & Worker)
- **Ngày:** 2026-10-10
- **Tài liệu phản hồi:** `docs/request/can phan he 1 chot.md` và `HUONG_DAN_TICH_HOP_AST_ENGINE.md`

---

## 1. Xác nhận các mục §1 (A1 → A6)

| # | Nội dung | Phía An làm | Quyết định của An |
|---|---|---|:---:|
| **A1** | **Engine không ghi DB**, gateway ghi `AST_FINGERPRINTS` và `PLAGIARISM_MATCHES` | Gateway là nơi duy nhất kết nối Prisma và ghi 2 bảng này | ✅ **XÁC NHẬN** |
| **A2** | **Chỉ một client** gọi engine: `apps/api/src/services/ast.client.ts` | Duy trì một client tập trung duy nhất, xử lý timeout và phân loại lỗi | ✅ **XÁC NHẬN** |
| **A3** | **An viết `ast.service.ts`** với hàm `check(submissionId)` | Đã chuẩn bị sẵn logic (đang chạy trong controller), An sẽ tách độc lập ra `ast.service.ts` | ✅ **XÁC NHẬN** |
| **A4** | **Ngưỡng do engine quyết**: dùng `level`/`flag` từ engine, không tự tính 30/60 | Gateway dùng trực tiếp enum `level` (`SAFE`, `WARNING`, `DANGER`) và `flag` của engine | ✅ **XÁC NHẬN** |
| **A5** | **Bài lỗi cú pháp không bị bỏ qua**: engine trả 200 + cảnh báo, rơi về `lex` | Lưu kết quả, không set `SKIPPED`, đặt `NEEDS_REVIEW` để bảo vệ bài test P2P | ✅ **XÁC NHẬN** |
| **A6** | **Cổng engine 8000**, biến `AST_ENGINE_URL` | Đã thêm service `ast-engine` vào `docker-compose.yml` (`http://ast-engine:8000`) và đọc `AST_ENGINE_URL` | ✅ **XÁC NHẬN** |

---

## 2. Quyết định các mục §2 (B1 → B6)

### B1. Ánh xạ `ast_check_status`
- **Quyết định:** **ĐỒNG Ý THÊM `NEEDS_REVIEW`**
- **Quy tắc ánh xạ:**
  - `DONE`: Engine trả 200, phân tích AST thành công (`warnings` rỗng, `fallback_reason = null`).
  - `NEEDS_REVIEW`: Engine trả 200 nhưng có `warnings` hoặc rơi về `lex` (bài lỗi cú pháp, parser timeout, hoặc thiếu dữ liệu token). Giúp Giảng viên lọc nhanh các bài cần xem tay.
  - `FAILED`: Lỗi 400/422 hoặc sập kết nối / hết lượt retry.
  - Cặp `DANGER` (`PLAGIARISM_DETECTED`): Giữ nguyên điểm số qua `SCORE_WITHHELD` + ghi `SCORE_AUDIT_LOGS`, không làm sai lệch `ast_check_status`.

---

### B2. Cột mới trong Database
- **Quyết định:** **ĐỒNG Ý THÊM ĐỦ CÁC CỘT VÀO SCHEMA**
- **Kế hoạch thực hiện:**
  - `ast_check_status` trên `Submission`: **Đã có sẵn trong DB** (`prisma db push` đã hoàn thành).
  - An sẽ cập nhật trực tiếp vào `schema.prisma` và migrate:
    - Bảng `plagiarism_matches`: thêm `level` (`NVARCHAR(10)`), `mode` (`NVARCHAR(5)`).
    - Bảng `ast_fingerprints`: thêm `analysis_mode` (`NVARCHAR(5)`), `fallback_reason` (`NVARCHAR(50)`, nullable), `warnings` (`NVARCHAR(MAX)` lưu JSON array).
  - An đã gửi request đồng bộ Data Dictionary sang người phụ trách SRS.

---

### B3. Thứ tự cặp trong `PLAGIARISM_MATCHES` (UNIQUE)
- **Quyết định:** **ĐỒNG Ý VÀ ĐÃ TRIỂN KHAI**
- **Chi tiết hiện thực:**
  - Đã sắp xếp khóa chính UUID: `const [s1, s2] = [id1, id2].sort()`.
  - **Đã xử lý đảo dòng code:** Kiểm tra `isReversed = (submission_1_id > submission_2_id)`. Nếu `true`, hoán đổi `a_lines` ↔ `b_lines` trong toàn bộ `matched_fragments` trước khi lưu vào DB. Giảng viên mở giao diện soi chi tiết sẽ không bị lệch dòng code giữa 2 sinh viên.

---

### B4. Mô hình kết nối Worker ↔ Gateway ở Milestone 3
- **Quyết định:** **CHỌN CÁCH 1 (Endpoint nội bộ `POST /api/internal/submissions/:id/ast-check`)**
- **Lý do:**
  - Worker của Thịnh chạy tiến trình riêng biệt với BullMQ, không cần truy cập trực tiếp vào Prisma DB của Gateway.
  - Gateway đã có sẵn middleware `requireInternalApiKey` với header `x-internal-key` bảo mật nội bộ.
  - Đảm bảo tính idempotent: Gọi lại nhiều lần vẫn `upsert` an toàn, không sinh bản ghi trùng lặp.
  - Response endpoint sẽ trả về:
    ```json
    {
      "success": true,
      "status": "DONE | NEEDS_REVIEW | FAILED",
      "similarityPercent": 92.5,
      "isPlagiarism": true,
      "matchedPairs": 1
    }
    ```

---

### B5. Quy ước Retry của BullMQ (Thịnh & An)
- **Quyết định:** **CHỌN `attempts: 4` (1 lần chạy đầu + 3 lần retry)**
- **Khớp chuẩn SRS:** US12 và NFR-13 ghi rõ *"retry tối đa 3 lần"*.
- **Cơ chế:**
  - Lỗi 4xx (400, 422 - dữ liệu đầu vào không hợp lệ): Worker bắt ném `UnrecoverableError` để BullMQ dừng ngay, không retry.
  - Lỗi 5xx hoặc Timeout mạng: Worker retry với exponential backoff. Khi hết 4 lượt thử thất bại thì cập nhật `ast_check_status = 'FAILED'`.

---

### B6. Bảo mật & Hiển thị dữ liệu
- **Quyết định:** **ĐỒNG Ý VÀ ĐÃ TRIỂN KHAI**
- **Chi tiết:**
  - Cổng 8000 của AST Engine chỉ chạy trong mạng nội bộ Docker (`http://ast-engine:8000`), không mở port công khai ra internet.
  - Giao diện Sinh viên: Đã áp dụng bộ lọc RBAC trong `getSubmissionResult`: Sinh viên chỉ nhìn thấy `similarityPercent`, ẩn hoàn toàn `submission_id` bài đối chiếu và mảng `matched_fragments`. Chỉ Giảng viên mới thấy đầy đủ chi tiết.

---

## 3. Tình trạng thực hiện của An (Tính đến 10/10/2026)

| Hạng mục | Trạng thái | Ghi chú |
|:---|:---:|:---|
| Client duy nhất `ast.client.ts` | ✅ Hoàn thành | Đã có timeout 10s, lọc 4xx/5xx |
| Cấu hình `docker-compose.yml` cổng 8000 | ✅ Hoàn thành | Service `ast-engine` port 8000:8000 |
| Logic hoán đổi `a_lines` ↔ `b_lines` khi sort ID | ✅ Hoàn thành | Đã code trong `submission.controller.ts` |
| Bảo mật IDOR & Ẩn dữ liệu đối chiếu với Student | ✅ Hoàn thành | Đã code lọc theo vai trò người dùng |
| Tách `apps/api/src/services/ast.service.ts` | 🔄 Đang thực hiện | Tách từ controller ra service riêng |
| Bổ sung 5 cột chi tiết vào `schema.prisma` | 🔄 Đang thực hiện | Thêm `level`, `mode`, `warnings`,... |
| Endpoint nội bộ `POST /api/internal/submissions/:id/ast-check` | 🔄 Sẵn sàng cho M3 | Chuẩn bị route cho Worker của Thịnh |
