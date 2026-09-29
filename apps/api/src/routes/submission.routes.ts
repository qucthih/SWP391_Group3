import { Router } from "express";
import multer from "multer";
import {
    submitAssignment,
    getMySubmissions,
    getSubmissionResult,
    createAppeal,
    resolveAppeal,
} from "../controllers/submission.controller.js";
import { authenticateJWT, authorizeRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Cấu hình Multer: Chỉ nhận file .zip và dung lượng tối đa 10MB (theo SRS)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed" || file.originalname.endsWith(".zip")) {
            cb(null, true);
        } else {
            cb(new Error("Hệ thống chỉ chấp nhận file nén định dạng .zip"));
        }
    },
});

// Nộp bài tập (Sinh viên) - Giới hạn ≤ 10MB
router.post("/", authenticateJWT, authorizeRole("STUDENT"), upload.single("file") as any, submitAssignment);

// Xem các lần nộp của mình theo bài tập
router.get("/assignment/:assignmentId", authenticateJWT, getMySubmissions);

// Xem kết quả chi tiết của 1 bài nộp (Wireframe 6.7.3)
router.get("/:submissionId", authenticateJWT, getSubmissionResult);

// Sinh viên gửi khiếu nại (US05)
router.post("/appeal", authenticateJWT, authorizeRole("STUDENT"), createAppeal);

// Giảng viên xử lý khiếu nại & ghi Audit log (US10, Risk R03)
router.patch("/appeal/:appealId/resolve", authenticateJWT, authorizeRole("LECTURER", "ADMIN"), resolveAppeal);

export default router;
