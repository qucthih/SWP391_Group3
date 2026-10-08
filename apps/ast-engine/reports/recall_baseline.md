# Kết quả đo recall (k=25, window=40)

Dataset: 3 nhóm — 15 cặp ĐẠO VĂN, 150 cặp KHÔNG đạo văn.

## 1. Similarity trung bình theo mức ngụy trang

| Mức | Kỹ thuật | AST+LEX (pipeline) | Chỉ LEX | Min (pipeline) |
|---|---|---|---|---|
| L1 | đổi tên | 100% | 100% | 100% |
| L2 | + comment, đổi literal | 100% | 100% | 100% |
| L3 | + đảo thứ tự hàm | 100% | 33% | 100% |
| L4 | AI viết lại (for→while, i++→i+=1, đảo if/else, tách hàm) | 25% | 13% | 14% |
| L5 | AI viết lại mạnh (lambda, đệ quy, lớp phụ, code thừa) | 11% | 5% | 0% |

## 2. Chi tiết từng cặp đạo văn (pipeline)

| Cặp | Similarity | Mức | Chế độ |
|---|---|---|---|
| bank:l1_rename | 100% | DANGER | ast |
| bank:l2_comments | 100% | DANGER | ast |
| bank:l3_reorder | 100% | DANGER | ast |
| bank:l4_ai_restyle | 22% | SAFE | ast |
| bank:l5_ai_heavy | 22% | SAFE | ast |
| sorting:l1_rename | 100% | DANGER | ast |
| sorting:l2_comments | 100% | DANGER | ast |
| sorting:l3_reorder | 100% | DANGER | ast |
| sorting:l4_ai_restyle | 14% | SAFE | ast |
| sorting:l5_ai_heavy | 0% | SAFE | ast |
| stack:l1_rename | 100% | DANGER | ast |
| stack:l2_comments | 100% | DANGER | ast |
| stack:l3_reorder | 100% | DANGER | ast |
| stack:l4_ai_restyle | 40% | WARNING | ast |
| stack:l5_ai_heavy | 10% | SAFE | ast |

## 3. Tổng hợp

| | Pipeline (AST+LEX) | Chỉ LEX |
|---|---|---|
| Recall mức DANGER (>60%) | 9/15 = 60% | 7/15 = 47% |
| Recall mức WARNING+ (≥30%) | 10/15 = 67% | 8/15 = 53% |
| Báo nhầm mức DANGER | 0/150 = 0% | 0/150 = 0% |
| Báo nhầm mức WARNING+ | 0/150 = 0% | 0/150 = 0% |

## 4. Các cặp KHÔNG đạo văn có điểm đáng chú ý (≥ 10%)

Không có cặp nào ≥ 10%.

## 5. Quét tham số (k, window)

| k | window | ngưỡng đảm bảo (w+k-1) | Recall DANGER | Recall WARNING+ | Báo nhầm DANGER | Báo nhầm WARNING+ | Recall L4 | Recall L5 |
|---|---|---|---|---|---|---|---|---|
| 25 | 40 | 64 | 9/15 = 60% | 10/15 = 67% | 0/150 = 0% | 0/150 = 0% | 0/3 = 0% | 0/3 = 0% |
| 15 | 25 | 39 | 9/15 = 60% | 13/15 = 87% | 0/150 = 0% | 0/150 = 0% | 0/3 = 0% | 0/3 = 0% |
| 10 | 15 | 24 | 11/15 = 73% | 14/15 = 93% | 0/150 = 0% | 1/150 = 1% | 2/3 = 67% | 0/3 = 0% |
| 8 | 12 | 19 | 10/15 = 67% | 14/15 = 93% | 0/150 = 0% | 2/150 = 1% | 1/3 = 33% | 0/3 = 0% |
| 5 | 8 | 12 | 14/15 = 93% | 15/15 = 100% | 1/150 = 1% | 25/150 = 17% | 3/3 = 100% | 2/3 = 67% |

## Giới hạn của phép đo (đọc trước khi trích số liệu)

- Mẫu NHỎ: số cặp đạo văn ít nên mỗi % thay đổi rất lớn; chưa đủ để kết luận thống kê.
- Biến thể L4/L5 do người viết tay mô phỏng cách AI ngụy trang, KHÔNG phải bài thật của đối thủ. Cần thay/bổ sung bằng biến thể AI sinh thật và bài nhóm khác nộp thử lúc P2P.
- Cặp ÂM chủ yếu là các chương trình khác đề (dễ). Chỉ có vài cặp 'cùng đề, viết độc lập' (khó) nên tỉ lệ báo nhầm ở đây đang bị đánh giá THẤP hơn thực tế.
- Recall tổng gộp cả L1-L3 (dễ) nên cao hơn recall trên riêng L4/L5; hãy xem bảng theo từng mức.
