# AITA-INTELLIGENT — Task Tuần 3-10 (chia theo Milestone Syllabus)

> 5 Dev cố định theo 5 phân hệ, không random nữa: An = Phân hệ 1 (Portal & Auth + API Gateway/DB), Thiên = Phân hệ 2 (Docker Sandbox), Huy = Phân hệ 3 (GenAI Core), Nhật = Phân hệ 4 (AST/RBL — trọng tâm RBL của môn, cố định), Thịnh = Phân hệ 5 (Redis Queue & Teamwork Analytics).

---

# 🟦 TUẦN 3-5 — MILESTONE 2 (20%): Core Workflow từng phân hệ riêng lẻ

> Theo Syllabus: mã hóa Phân hệ 1, 2, 4, 5 — **CHƯA tích hợp end-to-end**, mỗi phân hệ chạy độc lập trước. Bị P2P: tấn công Sandbox (fork bomb, timeout, ghi đè host) + thử AST Bypass (đổi biến/hàm/comment, phải phát hiện similarity >80%).

## Phân hệ 1 — Portal & Auth (An)
- [ ] Login SSO (6.7.1): Google Sign-in, chỉ nhận `@fpt.edu.vn`/`@fe.edu.vn`, toast lỗi sai domain, redirect `/dashboard`
- [ ] Student Dashboard (6.7.2): assignment cards, quick stats, sort theo deadline
- [ ] Verify schema Prisma đã migrate đủ 10 bảng vào MSSQL
- [ ] Cập nhật model `Student`/`Lecturer`/`Admin` với field thật: `student_code`/`major`/`intake_year`; `department`/`title`/`lecturer_code`; `access_level`/`staff_code`/`managed_scope`
- [ ] Cập nhật model `ClassStudent` thêm `enrolled_at`, `status` (`ACTIVE`/`DROPPED`)
- [ ] `POST /api/submissions`: nhận .zip, validate ≤10MB, hash SHA-256, tạo `Submission` status `PENDING`, đẩy Redis Queue, trả `202 Accepted` (US12)
- [ ] Risk R01: chặn nộp bài khi ≥5 lần/assignment/sinh viên — để dạng config
- [ ] API quản lý Class: tạo/sửa/xóa, gán lecturer
- [ ] Import Excel (US06): parse .xlsx, preview, DB Transaction (toàn bộ hoặc rollback — NFR-12)
- [ ] API Assignment + Test Case (US07): tạo đề, nhiều test case, chọn ngôn ngữ
- [ ] API lấy danh sách assignment cũ + API tạo assignment nhận `sourceAssignmentId` (UC-02 Import/Clone)
- [ ] Thống nhất sớm format API cập nhật `Submission` với Phân hệ 2/4/5 — vì các phân hệ này sẽ gọi ngược vào Phân hệ 1 ngay từ Milestone 2

## Phân hệ 2 — Docker Autograding Sandbox (Thiện)
- [ ] Docker Compose: MSSQL Server 2019 + Redis
- [ ] Code Execution Engine (Node.js + Dockerode): nhận job, tạo container theo ngôn ngữ (.NET 8.0 SDK/Java JDK 17), compile + chạy
- [ ] Resource limit (NFR-01): `--memory=512m`, `--cpus=1`, `--network=none`
- [ ] Hardening bảo mật (NFR-02): `--pids-limit`, `--read-only`, seccomp profile, non-root user
- [ ] Chạy test case (StdIn → so khớp StdOut), tính điểm theo `score_weight`, trả pass/fail + stdout/stderr
- [ ] Timeout 30s không tín hiệu độc hại → `docker kill`, status `TIMEOUT`
- [ ] Phát hiện độc hại (fork bomb, `/proc`, ghi đĩa quá mức) → `docker kill`, status `SECURITY_VIOLATION`
- [ ] Dọn container sau chạy/timeout: `docker rm -f`, verify bằng Docker event listener (NFR-14)
- [ ] Log chi tiết mỗi lần chạy (NFR-18): submission_id, start/end_time, exit_code, resource usage, security_alert — lưu ≥30 ngày
- [ ] **Bắt buộc trước khi hết Tuần 5:** tự test kỹ bằng chính các case sẽ bị nhóm đối thủ dùng để tấn công P2P — fork bomb, vòng lặp vô hạn, đọc file `.env`/hệ thống host — vì đây là tiêu chí chấm điểm trực tiếp của Milestone 2

## Phân hệ 4 — AST Plagiarism Detection (Nhật, cố định)
- [ ] AST Engine (FastAPI) độc lập, endpoint `POST /analyze` nhận code Java
- [ ] Parse Java → AST bằng ANTLR4 (`antlr4-python3-runtime`), xuất JSON
- [ ] Chuẩn hóa AST (US14): bỏ tên biến/hàm, comment, khoảng trắng, thứ tự hàm
- [ ] Winnowing đúng thông số SRS: k-gram = 25, window = 40 → sinh fingerprint
- [ ] Lưu fingerprint vào `AST_FINGERPRINTS`
- [ ] So khớp toàn bộ submission cùng assignment, tính `similarity_percent`, ghi `PLAGIARISM_MATCHES`
- [ ] Similarity > 60% → trả cờ `SCORE_WITHHELD`/`PLAGIARISM_DETECTED`
- [ ] Code không parse được → bỏ qua AST check, log warning, không chặn pipeline
- [ ] **Bắt buộc trước khi hết Tuần 5:** tự test bằng chính kịch bản P2P sẽ dùng — lấy 1 đoạn code, dùng AI đổi toàn bộ tên biến/hàm/comment/đảo vị trí hàm, xác nhận thuật toán vẫn bắt được similarity **>80%** (đây là ngưỡng Syllabus ghi rõ để "qua" bài kiểm tra chéo, cao hơn ngưỡng 60% dùng để cảnh báo trong hệ thống thật)

## Phân hệ 5 — Redis Queue & Teamwork Analytics (Thịnh)
- [ ] BullMQ: retry tối đa 3 lần, exponential backoff (US12, NFR-13)
- [ ] Cấu hình Redis Queue nhận bài nộp — đúng Syllabus ghi rõ đây là việc của Tuần 3-5, làm cùng đợt với Phân hệ 1
- [ ] Worker lắng nghe job (chưa cần nối đủ chuỗi Sandbox→AST→GenAI, vì GenAI thuộc Milestone 3 — Tuần 3-5 chỉ cần Queue nhận job và gọi được Phân hệ 2/4 riêng lẻ)

## Phân hệ 3 — GenAI Core & Review Hub (Huy)
> Syllabus không giao việc GenAI ở Milestone 2 — chỉ cần **chuẩn bị hạ tầng** để không bị chậm khi bước vào Tuần 6-8:
- [ ] Mỗi thành viên tự đăng ký key riêng (không cần thẻ): Groq, Cerebras
- [ ] Tạo `.env.example` chuẩn hóa tên biến
- [ ] Bắt đầu đo lường hiệu năng provider (xem `benchmark_phuongan_B.md` hoặc `A.md`) — làm sớm ở Tuần 3-5 để có đủ số liệu trước khi code Gateway thật ở Tuần 6-8

---

# 🟩 TUẦN 6-8 — MILESTONE 3 (25%): Tích hợp toàn diện & Semantic Review

> Theo Syllabus: nối toàn bộ pipeline qua WebSocket, hoàn thiện GenAI, Appeals, Git Analytics, đạt Unit Test ≥80%. Bị P2P: UAT bug-hunting, trừ điểm theo số bug nghiêm trọng nhóm đối thủ tìm thấy.

## Phân hệ 1 — Portal & Auth (An)
- [ ] Submission & Grading Results (6.7.3): stepper 6 bước, 3 card (Test Cases, Code Quality, Plagiarism Check 3 vùng màu), final score bar
- [ ] Lecturer Dashboard (6.7.4): sidebar quản lý, pie chart tỷ lệ nộp, bar chart phân bố điểm, top 10 cặp similarity cao nhất
- [ ] Form Appeal (US05): lý do, trạng thái Pending/Accepted/Rejected, nhận thông báo phản hồi
- [ ] Tích hợp WebSocket client — cập nhật UI real-time không reload
- [ ] Responsive: Desktop ≥1024px, Tablet ≥768px, Mobile ≥375px (NFR-15)
- [ ] UI "Import from Existing Assignment" (UC-02 bước 2a) + cảnh báo khác ngôn ngữ (Alt Flow 2b) — nếu chưa kịp làm ở Tuần 3-5
- [ ] API Appeal (US05, US10): tạo, list pending, resolve (accept re-grade/reject kèm lý do)
- [ ] Risk R03 (bắt buộc): ghi `SCORE_AUDIT_LOGS` mỗi lần sửa điểm thủ công
- [ ] API tổng hợp Dashboard: tỷ lệ nộp bài, phân bố điểm, top 10 cặp similarity cao nhất
- [ ] API Dashboard thống kê (US09) + API danh sách lớp lọc `status = ACTIVE`, loại `DROPPED` khỏi số liệu
- [ ] Unit Test cho các API cốt lõi — góp phần vào mục tiêu coverage ≥80% toàn hệ thống

## Phân hệ 2 — Docker Autograding Sandbox (Thiên)
- [ ] Ghép nối chính thức vào pipeline: nhận job từ Phân hệ 5, trả kết quả ngược lại đúng format đã thống nhất với Phân hệ 1
- [ ] Viết Unit Test cho logic xử lý kết quả (pass/fail, tính điểm theo `score_weight`) — không cần test cả container Docker thật, đúng ngoại lệ Syllabus cho phép ("excluding live Docker sandbox integration paths")
- [ ] Sửa lỗi phát sinh từ Milestone 2 (nếu P2P đã tìm ra lỗ hổng bảo mật)

## Phân hệ 3 — GenAI Core & Review Hub (Huy)
- [ ] Hoàn tất đo lường hiệu năng provider (nếu chưa xong ở Tuần 3-5), lưu kết quả vào `docs/ai-provider-benchmark.md`/`.csv`
- [ ] Gateway 2 provider + đa key (2 tầng fallback): Groq → Cerebras, xoay key trong từng provider trước khi rớt sang provider kế tiếp
- [ ] Timeout riêng theo từng provider dựa trên số liệu đo được; giới hạn tổng thời gian fallback để không vi phạm NFR-07
- [ ] Bắt riêng lỗi 429/5xx, log rõ nguyên nhân fallback
- [ ] Tích hợp US08 (MVP): AI sinh mô tả đề + sample test case từ prompt Lecturer
- [ ] Tích hợp US15: sau khi Sandbox chạy xong → AI chấm Clean Code 0-100 + feedback tiếng Việt
- [ ] NFR-17: AI giải thích lỗi biên dịch tiếng Việt khi `COMPILATION_ERROR`
- [ ] Quota & độ tin cậy (Risk R02): đếm request/provider/ngày, log fallback, set "AI Review Pending" nếu toàn bộ lỗi — không để Submission treo ở `REVIEWING_AI`
- [ ] Unit Test cho phần logic Gateway (mock response provider, test cơ chế fallback) — góp phần coverage ≥80%

## Phân hệ 4 — AST Plagiarism Detection (Nhật, cố định)
- [ ] Thiết lập Similarity Matrix cho toàn bộ bài nộp trong 1 assignment (không chỉ từng cặp) — phục vụ US09 bảng Top 10 similarity trên Lecturer Dashboard
- [ ] Ghép nối chính thức vào pipeline: nhận input từ Phân hệ 2 (sau khi Sandbox chạy xong), trả kết quả về đúng format cho Phân hệ 1
- [ ] Viết Unit Test cho thuật toán chuẩn hóa AST + Winnowing (dùng 3 case đã tự test ở Milestone 2 làm test case chính thức) — góp phần coverage ≥80%
- [ ] Sửa lỗi nếu P2P Milestone 2 phát hiện AST Bypass thành công (similarity thực tế <80% dù đã ngụy trang)

## Phân hệ 5 — Redis Queue & Teamwork Analytics (Thịnh)
- [ ] Hoàn thiện điều phối end-to-end: Redis Queue nhận job từ Phân hệ 1 → gọi Phân hệ 2 (Sandbox) → Phân hệ 4 (AST) → Phân hệ 3 (GenAI) → cập nhật kết quả qua API Phân hệ 1 → Phân hệ 1 emit WebSocket
- [ ] Cấu hình queue xử lý batch-grading không block API Gateway khi chấm cả lớp
- [ ] Git CLI Parser (US11, chống free-riding): nhận GitHub Repo URL từ Lecturer, clone/fetch, đọc lịch sử commit
- [ ] Phân tách commit theo từng thành viên, đếm commit + LOC added/removed (MVP, chưa cần PR)
- [ ] Lưu báo cáo đóng góp vào DB, hiển thị trên Lecturer Dashboard
- [ ] Xử lý lỗi URL sai/không có quyền truy cập — thông báo rõ, không crash job
- [ ] Áp dụng State Diagram 6.4.3: `CLONING` → `PARSING_COMMITS` → `CALCULATING_LOC` → `EVALUATING` → `COMPLETED`/`FREE_RIDER_DETECTED` (đóng góp <5% → gắn cờ)
- [ ] Unit Test cho logic tính LOC/commit theo từng thành viên — góp phần coverage ≥80%

## Việc chung toàn team (bắt buộc theo Syllabus)
- [ ] Đạt độ bao phủ Unit Test tối thiểu **80%** trên toàn bộ mã nguồn backend và frontend trước khi hết Tuần 8
- [ ] Chuẩn bị đóng vai "Giảng viên"/"Sinh viên" thật để đi UAT hệ thống nhóm khác (École 42 P2P), đồng thời tự UAT hệ thống mình trước để giảm thiểu bug bị đối thủ phát hiện (mỗi bug nghiêm trọng bị trừ điểm trực tiếp)
- [ ] Deploy hệ thống thật lên Azure/AWS/Vercel trước cuối Tuần 8 — Milestone 3 yêu cầu nghiệm thu trên môi trường deploy thực tế, không chấm trên localhost

---

# 🟥 TUẦN 9-10 — FINAL DEFENSE (40%): Stress Test, IEEE Paper & Bảo vệ

> Theo Syllabus: tối ưu hiệu năng, viết báo cáo khoa học IEEE bắt buộc, demo trực tiếp trước Hội đồng.

## Việc kỹ thuật (toàn team phối hợp, không chia cứng theo phân hệ nữa)
- [ ] Stress test Redis Queue bằng k6 hoặc JMeter dưới tải **100 requests đồng thời** (NFR-08)
- [ ] Tối ưu database indexes cho các bảng truy vấn nhiều (`SUBMISSIONS`, `PLAGIARISM_MATCHES`)
- [ ] Cấu hình caching Redis cho API kết quả — giảm độ trễ phản hồi xuống **dưới 100ms** (đúng mục tiêu NFR-09 nhưng siết chặt hơn theo yêu cầu Tuần 9-10)
- [ ] Rà soát và dọn toàn bộ mã nguồn: pass linting ESLint/Prettier (TypeScript), Flake8 (Python) — không còn warning trước khi nộp
- [ ] Viết User Manual đầy đủ (hướng dẫn sử dụng cho Student/Lecturer/Admin)

## Phân hệ 4 — AST/RBL (Nhật chủ trì, cả team hỗ trợ nội dung)
- [ ] Thực nghiệm so sánh: **Tree Edit Distance (AST)** vs **Winnowing** — đo độ nhạy phát hiện đạo văn và thời gian xử lý khi đối phó với mã nguồn bị ngụy trang bằng GenAI
- [ ] Ghi lại số liệu thực nghiệm cụ thể (bảng so sánh, biểu đồ) làm bằng chứng cho phần thực nghiệm của bài báo

## Viết Báo cáo Khoa học IEEE (bắt buộc, cả team phối hợp)
- [ ] Viết bài báo 6-8 trang, đúng định dạng chuẩn IEEE, tiếng Anh hoặc tiếng Việt
- [ ] Bắt buộc có phần: thực nghiệm so sánh Tree Edit Distance vs Winnowing (lấy số liệu từ mục Phân hệ 4 ở trên)
- [ ] Phân công viết theo phần: Introduction/Related Work, Methodology (kiến trúc hệ thống), Experiment (số liệu AST/Winnowing), Conclusion
- [ ] Review chéo nội bộ trước khi nộp — đây là điều kiện bắt buộc để được chấm điểm tối đa ở Final Defense

## Chuẩn bị Bảo vệ Cuối kỳ
- [ ] Soạn slide thuyết trình kiến trúc hệ thống + demo trực tiếp toàn bộ luồng (Login → Nộp bài → Sandbox → AST → GenAI → Kết quả real-time)
- [ ] Demo phải chạy trên server đã deploy thật, không dùng localhost
- [ ] Phân công người trả lời câu hỏi phản biện kỹ thuật theo đúng phân hệ mỗi người phụ trách
- [ ] Chuẩn bị trả lời câu hỏi về Risk Assessment (R01-R06 trong SRS) — Hội đồng có thể hỏi sâu về các rủi ro đã lường trước và cách xử lý

---

## Ghi chú chuyển tiếp giữa các Milestone
- **Cuối Tuần 5:** nếu Phân hệ 2 hoặc Phân hệ 4 bị P2P tấn công thành công (sandbox bị hack, AST bypass được), phải ưu tiên vá lỗi này **đầu Tuần 6** trước khi tiếp tục tích hợp — lỗi bảo mật Sandbox bị hack thành công sẽ bị trừ thẳng 50% điểm kỹ thuật Milestone 2 theo thang điểm Syllabus.
- **Cuối Tuần 8:** nếu chưa đạt Unit Test coverage 80%, đây là điều kiện chặn — không nên bước vào Tuần 9-10 (stress test/IEEE Paper) khi nền tảng code chưa đạt chuẩn, vì Milestone 3 và Final đều yêu cầu coverage này là điều kiện được "chấp nhận chấm điểm".
