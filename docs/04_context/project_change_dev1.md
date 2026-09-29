# BÁO CÁO TIẾN ĐỘ THỰC HIỆN — DEV 1 (PHÂN HỆ 1: PORTAL & AUTH + API GATEWAY/DB)
**Dự án:** AITA-INTELLIGENT (SWP391)  
**Phụ trách:** Dev 1 (Portal, Authentication, Class & Assignment Management, Submission Pipeline)  
**Mốc hoàn thành:** Toàn bộ Backend Core Workflow của **Milestone 2 (Tuần 3 - Tuần 5)** và vượt tiến độ sang **Milestone 3**.

---

## 1. TỔNG QUAN CÁC GIAI ĐOẠN ĐÃ HOÀN THÀNH (MILESTONE 2)

### 🔹 Giai đoạn 1: Chuẩn hóa Database & Ràng buộc Dữ liệu (Prisma & MSSQL Server)
- **Đồng bộ Schema:** Kết nối thành công tới database `aita_db` (Microsoft SQL Server 2019+ trên cổng chuẩn `1433`).
- **Mở rộng Model:**
  - Bổ sung trường cho `Student`: `student_code`, `major`, `intake_year`.
  - Bổ sung trường cho `Lecturer`: `department`, `title`, `lecturer_code` (Unique).
  - Bổ sung trường cho `Admin`: `access_level`, `staff_code` (Unique), `managed_scope`.
  - Cập nhật model `ClassStudent` với 2 cột: `enrolled_at` (DateTime mặc định `now()`) và `status` (`ACTIVE`/`DROPPED`) nhằm phục vụ việc lọc dữ liệu theo đúng SRS US09.
- **Tính toàn vẹn:** Đã chạy `prisma db push` đồng bộ trực tiếp vào MSSQL, sinh lại Prisma Client tương thích Node.js TypeScript.

---

### 🔹 Giai đoạn 2: Module Xác thực Google SSO & Phân quyền (Auth & Security)
- **Chuẩn hóa xác thực:** Sử dụng `google-auth-library` để verify chữ ký số Google ID Token (`credential`) từ client gửi lên, triệt tiêu hoàn toàn rủi ro giả mạo email qua Postman/cURL.
- **Ràng buộc Domain (SRS 6.7.1):** Kiểm tra Regex chặt chẽ, chỉ chấp nhận email thuộc tổ chức giáo dục FPT: `@fpt.edu.vn` hoặc `@fe.edu.vn`.
- **Phân loại Role tự động:** Tự động map role ban đầu (`STUDENT` / `LECTURER`) và liên kết bản ghi `studentProfile` / `lecturerProfile`.
- **JWT & Role Guard Middleware:** Cấp phát JWT Token (hạn 7 ngày) kèm Middleware `authenticateJWT` và `authorizeRole` bảo vệ toàn diện các API nội bộ.
- **Fail-Fast Environment:** Xây dựng module `src/config/env.ts` kiểm tra các biến môi trường bắt buộc (`JWT_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`) ngay khi ứng dụng khởi động.

---

### 🔹 Giai đoạn 3: Quản lý Lớp học & Đề bài (Class & Assignment Management)
- **API Lớp học (`/api/classes`):** Hỗ trợ Giảng viên/Admin tạo lớp, tự động lọc danh sách lớp theo vai trò (`getMyClasses`).
- **Import Sinh viên bằng Excel (US06 & NFR-12):**
  - Nhận file `.xlsx`, phân tích dữ liệu dòng (MSSV, Email, Họ tên).
  - Sử dụng **Database Transaction (`prisma.$transaction`)**: Đảm bảo tính toán tử ACID, nếu 1 dòng trong file lỗi thì toàn bộ quá trình sẽ Rollback, không gây rác dữ liệu.
- **API Đề bài & Bộ Test Cases (US07):** Giảng viên tạo đề bài lập trình (chọn Java/Python/C#, hạn deadline) kèm nhiều test cases với `score_weight`.
- **Clone / Import Đề bài cũ (UC-02):** Cho phép sao chép nguyên trạng đề bài và bộ test case từ bài tập trước sang lớp mới kèm hạn nộp mới.

---

### 🔹 Giai đoạn 4: Luồng Nộp bài (Submission Pipeline) & Khiếu nại (Appeals)
- **API Nộp bài (`POST /api/submissions` - US12):**
  - Nhận file nén `.zip` với dung lượng tối đa **≤ 10MB** (cấu hình qua Multer memory storage).
  - **Kiểm soát rủi ro R01:** Giới hạn sinh viên không được nộp quá 5 lần/bài tập (`MAX_SUBMISSION_ATTEMPTS = 5`).
  - **Băm bảo mật SHA-256:** Tính toán hash code của file để kiểm tra trùng lặp và lưu trữ file vật lý an toàn vào thư mục `uploads/submissions/`.
  - Tạo bản ghi với trạng thái `PENDING` và trả về mã HTTP **`202 Accepted`**.
  - Tích hợp phát sự kiện WebSocket ban đầu (`emitGradingProgress` - step `QUEUED`).
- **Khiếu nại & Lưu vết Audit Log (US05, US10 & Risk R03):**
  - Sinh viên gửi đơn khiếu nại (`Appeal`) kèm lý do cụ thể.
  - Giảng viên phản hồi và điều chỉnh điểm số.
  - **Bắt buộc lưu vết `SCORE_AUDIT_LOGS`:** Tự động ghi lại điểm cũ, điểm mới, người sửa và lý do vào bảng lịch sử khi có sự thay đổi điểm thủ công (tuân thủ nghiêm ngặt Risk R03).

---

### 🔹 Giai đoạn 5: Thống kê Báo cáo Giảng viên (Lecturer Analytics - US09)
- **API `/api/dashboard/analytics/:assignmentId`:**
  - Tự động tính toán tỷ lệ nộp bài (`submission_rate`).
  - **Loại bỏ sinh viên `DROPPED`:** Chỉ đếm các sinh viên có `status = 'ACTIVE'` trong lớp.
  - Thống kê phân bố điểm theo 4 dải: `< 5.0`, `5.0 - 6.5`, `6.5 - 8.0`, `8.0 - 10.0`.
  - Trích xuất Top 10 cặp bài nộp có tỷ lệ tương đồng đạo văn (`similarity_percent`) cao nhất phục vụ Wireframe 6.7.4.

---

## 2. CHUYỂN TIẾP SANG MILESTONE 3 (TUẦN 6 - TUẦN 8)

Backend của Phân hệ 1 đã hoàn thành trước hạn toàn bộ các API quan trọng. Các nhiệm vụ tiếp theo của Milestone 3 bao gồm:

1. **Ghép nối Frontend React (Vite):**
   - Tích hợp `@react-oauth/google` vào trang Login (`LoginPage.tsx`).
   - Kết nối API vào Student Dashboard (`StudentDashboardPage.tsx`).
   - Kết nối Socket.io client và Stepper 6 bước tại trang Kết quả chấm (`GradingResultsPage.tsx`).
   - Hiển thị biểu đồ thống kê Chart.js / Recharts tại trang Quản lý Giảng viên (`LecturerDashboardPage.tsx`).
2. **Tích hợp Điều phối End-to-End với các Phân hệ khác:**
   - Sẵn sàng cung cấp endpoint cập nhật trạng thái `Submission` cho Worker Redis (Phân hệ 5) khi Docker Sandbox (Phân hệ 2) và AST Engine (Phân hệ 4) chấm xong.
3. **Độ bao phủ Unit Test (Coverage ≥ 80%):**
   - Viết test suite cho Auth Middleware, Class Transaction và Submission Constraints bằng Jest/Supertest.
