import { Router } from "express";
import { getLecturerAnalytics } from "../controllers/dashboard.controller.js";
import { authenticateJWT, authorizeRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Lấy số liệu thống kê bài tập cho Giảng viên (US09)
router.get("/analytics/:assignmentId", authenticateJWT, authorizeRole("LECTURER", "ADMIN"), getLecturerAnalytics);

export default router;
