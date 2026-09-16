# AITA AST Engine Microservice (FastAPI + Python)

Dịch vụ phân tích cây cú pháp trừu tượng (AST) và băm vân tay số (Winnowing Fingerprints) phục vụ đề tài SWP391 - Nhóm 3.

---

## 🚀 Cách chạy dịch vụ (Local Development)

### 1. Di chuyển vào thư mục dịch vụ:
```bash
cd apps/ast-engine
```

### 2. Tạo môi trường ảo Python (Khuyên dùng):
```bash
python -m venv venv

# Kích hoạt trên Windows:
.\venv\Scripts\activate

# Hoặc kích hoạt trên macOS/Linux:
source venv/bin/activate
```

### 3. Cài đặt thư viện:
```bash
pip install -r requirements.txt
```

### 4. Khởi động server:
```bash
python main.py
# Hoặc:
uvicorn main:app --reload --port 8000
```

---

## 🔍 Kiểm tra hoạt động:
* **Giao diện test Swagger UI (cực tiện):** Mở trình duyệt vào [http://localhost:8000/docs](http://localhost:8000/docs)
* **Endpoint kiểm tra sức khỏe:** [http://localhost:8000/health](http://localhost:8000/health)
* **Endpoint phân tích AST:** `POST http://localhost:8000/api/v1/ast/parse`
