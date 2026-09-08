# AITA-Intelligent — Screen Flow & UI Workflow Description

**Phiên bản:** 1.0
**Mục đích:** Mô tả chi tiết luồng màn hình (Screen Flow) của hệ thống AITA để nhóm có thể vẽ lại wireframe/mockup trên Figma hoặc Visual Paradigm.

---

## 1. Tổng quan luồng màn hình (Navigation Map)

```
[Login Page]
    │
    ├── Google SSO Success ──► [Role Check]
    │                              │
    │                    ┌─────────┼──────────┐
    │                    ▼         ▼          ▼
    │              [Student     [Lecturer   [Admin
    │              Dashboard]   Dashboard]  Dashboard]
    │
    └── SSO Fail (email không hợp lệ) ──► [Error Page]
```

---

## 2. Màn hình Login (Trang đăng nhập)

**Tham khảo mockup:** `mockup_01_login_page.jpg`

### Layout:
- **Background:** Gradient tối (navy → tím đậm), có hình trang trí AST tree mờ phía sau.
- **Trung tâm:** Thẻ kính mờ (glassmorphism) chứa:
  - Logo AITA (icon kết hợp não bộ + dấu ngoặc nhọn code `</>`)
  - Tiêu đề: "Welcome to AITA-Intelligent"
  - Phụ đề: "Sign in with your FPT University account"
  - **Nút "Sign in with Google"** (nút trắng, logo Google 4 màu, font đậm)
  - Ghi chú nhỏ: "Only @fpt.edu.vn and @fe.edu.vn emails are accepted"
  - Logo FPT University ở dưới cùng

### Luồng xử lý:
1. User nhấn "Sign in with Google"
2. Redirect sang Google OAuth 2.0 consent screen
3. Google trả về token → Backend xác thực:
   - Email đúng miền FPT? → Tạo JWT → Redirect tới Dashboard (theo role)
   - Email sai miền? → Hiển thị thông báo lỗi "Email không thuộc hệ thống FPT University"

---

## 3. Màn hình Lecturer Dashboard (Bảng điều khiển Giảng viên)

**Tham khảo mockup:** `mockup_02_lecturer_dashboard.jpg`

### Layout:
- **Sidebar trái (cố định, 240px):**
  - Logo AITA
  - Menu items (icon + text): Dashboard, Classes, Assignments, Submissions, Analytics, Settings
  - Avatar + tên GV ở dưới cùng sidebar

- **Header bar (trên cùng):**
  - Thanh tìm kiếm (Search students, assignments...)
  - Icon chuông thông báo (bell icon) + badge số lượng
  - Avatar user + dropdown menu (Profile, Logout)

- **Content chính:**
  - **Dòng chào mừng:** "Welcome back, Dr. [Tên]" + ngày hôm nay
  - **4 Stat Cards (hàng ngang):**
    | Card | Giá trị | Màu accent |
    |---|---|---|
    | Total Students | Số SV trong tất cả lớp | 🔵 Xanh dương |
    | Active Assignments | Số bài tập đang mở | 🟢 Xanh lá |
    | Pending Submissions | Bài nộp chưa chấm xong | 🟡 Vàng |
    | Plagiarism Alerts | Số bài bị gắn cờ đạo văn | 🔴 Đỏ |
  - **Biểu đồ cột:** "Score Distribution" – phân bố điểm từ 0-50, 51-60... đến 91-100
  - **Bảng dữ liệu:** "Recent Submissions" – cột: Student, Assignment, Status (badge màu), Score

### Luồng điều hướng từ Dashboard:
- Nhấn vào "Classes" → Danh sách lớp học (có nút "Tạo lớp mới" + "Import SV")
- Nhấn vào "Assignments" → Danh sách bài tập (có nút "Tạo bài tập" + "Sinh đề bằng AI")
- Nhấn vào "Analytics" → Trang Git Analytics (biểu đồ commit của từng SV)
- Nhấn vào 1 dòng trong bảng "Recent Submissions" → Xem chi tiết kết quả chấm

---

## 4. Màn hình Student – Nộp bài (Submit Assignment)

**Tham khảo mockup:** `mockup_03_student_submission.jpg`

### Layout:
- **Sidebar trái:** Dashboard, My Classes, Submissions, Results, Appeal
- **Content chính:**
  - **Tiêu đề trang:** "Submit Assignment: [Tên bài tập]"
  - **Phụ đề:** Tên lớp học (VD: "Introduction to Data Structures - CS201")
  - **Đồng hồ đếm ngược Deadline:** hiển thị DD ngày : HH giờ : MM phút : SS giây (màu đỏ nếu còn < 24h)
  - **Vùng kéo thả file (Drag & Drop Zone):**
    - Viền nét đứt (dashed border), icon mây upload ở giữa
    - Text: "Drop your .zip file here or click to browse"
    - Ghi chú: "Maximum file size: 10MB | Only .zip files accepted"
  - **Progress Stepper:** Setup → **Upload** → Review → Confirm (đánh dấu bước hiện tại)
  - **Phần "Previous Submissions":** Timeline liệt kê các lần nộp trước:
    - Mỗi dòng hiển thị: Submission ID, DateTime, Status Badge (Completed/Grading/Failed), Score

### Luồng xử lý:
1. SV kéo thả file .zip vào vùng upload (hoặc click để chọn file)
2. Hệ thống validate: kiểm tra đuôi .zip, dung lượng ≤ 10MB
3. Hiển thị preview tên file + dung lượng
4. SV nhấn "Submit" → API nhận file → Hiển thị trạng thái "Queued"
5. Redirect sang trang Grading Results để theo dõi realtime

---

## 5. Màn hình Grading Results (Kết quả chấm điểm – Realtime)

**Tham khảo mockup:** `mockup_04_grading_results.jpg`

### Layout:
- **Progress Stepper (trên cùng):** 6 bước đánh dấu trạng thái chấm bài:
  ```
  Queued → Building → Running Tests → AST Analysis → AI Review → Complete
  ```
  - Bước đang chạy: icon loading xoay + màu vàng
  - Bước hoàn thành: icon ✅ + màu xanh lá
  - Bước chưa đến: icon xám

- **3 Card kết quả (hàng ngang):**

  **Card 1: Test Cases (Bên trái)**
  - Tiêu đề: "Test Cases" + điểm (VD: 80/100)
  - Danh sách: mỗi test case 1 dòng, icon ✅ (passed) hoặc ❌ (failed)
  - Chi tiết: Input, Expected Output, Actual Output (ẩn, nhấn mở rộng)

  **Card 2: Code Quality – AI Review (Giữa)**
  - Tiêu đề: "Code Quality (AI Review)"
  - Biểu đồ tròn (circular gauge): điểm 0-100
  - Danh sách gạch đầu dòng nhận xét của AI:
    - "✅ Good naming convention"
    - "⚠️ Missing error handling"
    - "💡 Consider using SOLID principles"

  **Card 3: Plagiarism Check (Bên phải)**
  - Tiêu đề: "Plagiarism Check"
  - Đồng hồ bán nguyệt (semicircle gauge): phần trăm tương đồng
    - 0-30%: Xanh lá (Safe zone)
    - 30-60%: Vàng (Warning)
    - 60-100%: Đỏ (Danger – Nghi đạo văn)
  - Ghi chú: "No plagiarism detected" hoặc "⚠️ High similarity with Submission #XYZ"

- **Thanh tổng điểm (dưới cùng):**
  - "Final Score: XX/100" (font lớn, nổi bật)
  - Nút "Appeal this result" nếu SV muốn kháng cáo

### Cập nhật Realtime:
- Khi trang được mở, client kết nối WebSocket tới server
- Server push trạng thái mỗi khi 1 bước hoàn thành
- Progress Stepper tự động chuyển sang bước tiếp theo kèm animation
- Khi "Complete", toàn bộ 3 card kết quả được render đồng thời

---

## 6. Các màn hình phụ (Mô tả ngắn gọn)

### 6.1. Trang Lecturer – Tạo bài tập + AI sinh đề
- Form nhập: Tiêu đề, Mô tả, Ngôn ngữ (Dropdown: Java/Python/C#), Deadline (Date Picker)
- Nút "🤖 Generate with AI": mở modal, GV nhập prompt → AI trả về đề bài + test cases
- Bảng test cases: cột Input, Expected Output, Score, nút Add/Delete
- Nút "Save & Publish"

### 6.2. Trang Lecturer – Import sinh viên
- Nút "Download Template" (tải file Excel mẫu)
- Vùng upload file .xlsx
- Bảng preview danh sách SV sau khi parse
- Nút "Confirm Import" → Progress bar → Kết quả (X success, Y duplicates)

### 6.3. Trang Student – Appeal (Kháng cáo)
- Danh sách bài đã chấm → Nút "Appeal"
- Form: Textarea "Lý do kháng cáo"
- Sau khi gửi: hiển thị trạng thái (Pending / Accepted / Rejected)

### 6.4. Trang Lecturer – Git Analytics
- Input: URL GitHub Repo
- Biểu đồ: Đóng góp theo từng thành viên (commits, LOC, PRs)
- Bảng: Tên SV, Tổng commits, LOC Added, LOC Removed, PRs Merged, % Đóng góp
- Cảnh báo đỏ nếu thành viên < 5%

### 6.5. Trang Admin – Quản trị hệ thống
- CRUD Users (danh sách, tìm kiếm, sửa role, khóa tài khoản)
- Cấu hình Sandbox (RAM limit, CPU limit, timeout)
- Quản lý API Keys (thêm/xóa key OpenAI/Gemini)
- Xem Audit Logs (bảng: Timestamp, User, Action, Details)

---

**Kết thúc tài liệu Screen Flow – Phiên bản 1.0**
