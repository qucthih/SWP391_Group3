# HƯỚNG DẪN KHỞI TẠO & ĐỒNG BỘ DATABASE MSSQL (AITA-INTELLIGENT)

Tài liệu này dành cho các thành viên trong nhóm thiết lập và đồng bộ toàn bộ **13 bảng dữ liệu** (theo đúng đặc tả SRS v1.2 Mục 6.5 & 6.6) vào Microsoft SQL Server trên máy cục bộ.

---

## 📌 QUY ƯỚC CHUNG CỦA NHÓM
* **Hệ quản trị CSDL:** Microsoft SQL Server 2019+ (MSSQL)
* **Tên Database:** `aita_db`
* **Tài khoản quản trị:** `sa`
* **Mật khẩu dùng chung:** `12345` (Nếu máy bạn dùng mật khẩu khác, hãy đổi tương ứng trong file `.env`)
* **Cổng mặc định:** `1433`

---

## 🛠️ CÁC BƯỚC THỰC HIỆN TRÊN MÁY BẠN

### Bước 1: Tạo Database rỗng trong SSMS (SQL Server Management Studio)
1. Mở phần mềm **SSMS** và kết nối vào SQL Server trên máy bạn.
2. Tại cây thư mục bên trái (**Object Explorer**), click chuột phải vào thư mục **Databases** -> chọn **New Database...**
3. Ở ô **Database name**, nhập chính xác: `aita_db`.
4. Bấm **OK**.

---

### Bước 2: Tạo file cấu hình `.env`
1. Mở terminal tại thư mục gốc dự án sau khi `git pull` code mới nhất về.
2. Di chuyển vào thư mục API:
   ```bash
   cd apps/api
   ```
3. Tạo file `.env` bằng cách copy từ file mẫu `.env.example`:
   * Trên Windows (PowerShell):
     ```powershell
     copy .env.example .env
     ```
   * Hoặc tạo file `.env` thủ công và dán nội dung:
     ```env
     PORT=5000
     DATABASE_URL="sqlserver://localhost:1433;database=aita_db;user=sa;password=12345;trustServerCertificate=true"
     JWT_SECRET="aita_super_secret_jwt_key_2024_change_me_later"
     ```
   *(Lưu ý: Thay `12345` bằng mật khẩu `sa` của máy bạn nếu bạn đặt khác).*

---

### Bước 3: Cài đặt thư viện & Đẩy toàn bộ bảng vào Database
Tại thư mục `apps/api`, chạy 3 lệnh sau:

```powershell
# 1. Cài đặt các thư viện cần thiết
npm.cmd install

# 2. Đẩy cấu trúc 13 bảng từ schema.prisma vào database aita_db
npx.cmd prisma db push

# 3. Sinh mã Prisma Client (để code TypeScript có đầy đủ gợi ý và không bị báo lỗi đỏ)
npx.cmd prisma generate
```

> **Ghi chú:**  
> Lệnh `npx.cmd prisma db push` sẽ tự động tạo đầy đủ các bảng: `users`, `students`, `lecturers`, `admins`, `classes`, `class_students`, `assignments`, `test_cases`, `submissions`, `ast_fingerprints`, `plagiarism_matches`, `appeals`, `score_audit_logs`.

---

## 🔍 BƯỚC 4: KIỂM TRA KẾT QUẢ

Có 2 cách kiểm tra:
1. **Kiểm tra trong SSMS:** Quay lại SSMS -> chuột phải vào thư mục **Tables** của `aita_db` -> chọn **Refresh**, bạn sẽ thấy đầy đủ danh sách các bảng `dbo.users`, `dbo.submissions`...
2. **Kiểm tra qua giao diện Web trực quan (Prisma Studio):**
   Chạy lệnh:
   ```powershell
   npx.cmd prisma studio
   ```
   Trình duyệt sẽ mở `http://localhost:5555` cho phép bạn xem và thêm bớt dữ liệu các bảng cực kỳ trực quan!

---

## 🐳 CÁCH THAY THẾ: DÙNG DOCKER (CHO BẠN NÀO CHƯA CÀI SSMS)
Nếu máy bạn chưa cài đặt sẵn SQL Server, bạn có thể khởi động MSSQL bằng Docker:
1. Chạy lệnh tại thư mục gốc:
   ```powershell
   docker compose up -d mssql
   ```
2. Đổi mật khẩu trong `.env` thành mật khẩu Docker:
   ```env
   DATABASE_URL="sqlserver://localhost:1433;database=master;user=sa;password=AitaPassword123!;trustServerCertificate=true"
   ```
3. Chạy `npx.cmd prisma db push`.
