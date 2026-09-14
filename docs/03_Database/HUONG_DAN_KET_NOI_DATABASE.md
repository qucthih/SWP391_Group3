# HƯỚNG DẪN KẾT NỐI DATABASE CHO THÀNH VIÊN NHÓM (AITA-INTELLIGENT)

Tài liệu này hướng dẫn cách kết nối dự án với Database PostgreSQL dùng chung của nhóm (chạy trên Cloud Neon.tech). Bạn **không cần cài đặt PostgreSQL hay Docker nặng máy**.

---

## BƯỚC 1: LẤY CHUỖI KẾT NỐI DATABASE (DATABASE_URL)

Có 2 trường hợp:

### Trường hợp A: Dùng chung Database dự án của nhóm (Khuyên dùng ⭐)
* Liên hệ bạn phụ trách Mục 4 (hoặc lấy trong nhóm chat riêng) để nhận chuỗi `DATABASE_URL` dùng chung.
* Bỏ qua Bước B, chuyển thẳng sang **BƯỚC 2**.

---

### Trường hợp B: Tự tạo 1 Database cá nhân riêng để test độc lập (Nếu muốn)
1. Truy cập [https://neon.tech](https://neon.tech) -> Bấm **Sign Up** -> Chọn **Continue with Google**.
2. Đặt tên project (ví dụ: `aita-dev`), chọn Region: **Singapore (ap-southeast-1)** -> Bấm **Create Project**.
3. Tại trang Dashboard, copy chuỗi **Connection string** (dạng `postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require`).

---

## BƯỚC 2: CẤU HÌNH DỰ ÁN TRÊN MÁY BẠN

1. Mở terminal tại thư mục gốc dự án sau khi `git pull` code mới nhất về.
2. Di chuyển vào thư mục API:
   ```bash
   cd apps/api
   ```
3. Tạo file `.env` bằng cách copy từ file mẫu:
   * Trên Windows (PowerShell):
     ```powershell
     copy .env.example .env
     ```
   * Trên macOS/Linux:
     ```bash
     cp .env.example .env
     ```
4. Mở file `.env` vừa tạo và dán chuỗi kết nối vào dòng `DATABASE_URL`:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
   JWT_SECRET="aita_super_secret_jwt_key_2024_change_me_later"
   ```

---

## BƯỚC 3: CÀI ĐẶT & KÍCH HOẠT PRISMA CLIENT

Chạy các lệnh sau trong thư mục `apps/api`:

```bash
# 1. Cài đặt các thư viện cần thiết
npm install

# 2. Sinh mã Prisma Client tương ứng với Database (để code không bị lỗi đỏ)
npx prisma generate
```

> **Lưu ý cho Windows:** Nếu gặp lỗi bảo mật PowerShell chặn script (`Execution_Policies`), hãy thay bằng `npm.cmd install` và `npx.cmd prisma generate`.

---

## BƯỚC 4: KIỂM TRA KẾT NỐI (XEM DỮ LIỆU BẰNG PRISMA STUDIO)

Chạy lệnh:
```bash
npx prisma studio
```
Trình duyệt sẽ tự động mở trang `http://localhost:5555`. Nếu bạn thấy xuất hiện đầy đủ **7 bảng** (`users`, `classes`, `exams`, `submissions`, `ast_fingerprints`, `rule_scores`, `criterion_scores`) nghĩa là bạn đã kết nối thành công 100%!
