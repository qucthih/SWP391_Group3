import { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { emitGradingProgress } from "../socket/index.js";

// Giới hạn số lần nộp tối đa theo Risk R01 (mặc định 5 lần)
const MAX_SUBMISSION_ATTEMPTS = 5;

// 1. Nộp bài tập (US12 & Risk R01)
export const submitAssignment = async (req: Request, res: Response) => {
    try {
        const studentId = req.user?.userId;
        const { assignmentId } = req.body;
        const file = req.file;

        if (!studentId) {
            return res.status(401).json({ success: false, message: "Chưa xác thực danh tính." });
        }

        if (!assignmentId || !file) {
            return res.status(400).json({ success: false, message: "Vui lòng chọn đề bài và đính kèm file bài nộp (.zip)." });
        }

        // 1. Kiểm tra tồn tại Assignment & Deadline
        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId },
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đề bài." });
        }

        // 2. Kiểm tra Risk R01: Số lần nộp bài của sinh viên cho assignment này
        const submissionCount = await prisma.submission.count({
            where: {
                assignmentId,
                studentId,
            },
        });

        if (submissionCount >= MAX_SUBMISSION_ATTEMPTS) {
            return res.status(429).json({
                success: false,
                message: `Bạn đã đạt giới hạn tối đa ${MAX_SUBMISSION_ATTEMPTS} lần nộp cho bài tập này (Risk R01).`,
            });
        }

        // 3. Tính mã băm SHA-256 từ file buffer
        const hashSum = crypto.createHash("sha256");
        hashSum.update(file.buffer);
        const fileHash = hashSum.digest("hex");

        // 4. Lưu file vật lý vào thư mục uploads/submissions
        const uploadDir = path.join(process.cwd(), "uploads", "submissions");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}_${studentId}_${file.originalname}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, file.buffer);

        // 5. Tạo bản ghi Submission với trạng thái PENDING
        const submission = await prisma.submission.create({
            data: {
                assignmentId,
                studentId,
                fileUrl: `/uploads/submissions/${fileName}`,
                fileHash,
                status: "PENDING",
            },
        });

        // Phát thông báo tiến trình khởi tạo qua WebSocket
        emitGradingProgress({
            submissionId: submission.id,
            step: "QUEUED",
            progressPercent: 10,
            message: "Bài nộp đã được tiếp nhận và đưa vào hàng đợi chấm.",
        });

        // Trả về mã 202 Accepted theo đúng đặc tả US12
        return res.status(202).json({
            success: true,
            message: "Nộp bài thành công! Đang tiến hành chấm tự động.",
            data: {
                submissionId: submission.id,
                attemptsLeft: MAX_SUBMISSION_ATTEMPTS - (submissionCount + 1),
                status: submission.status,
            },
        });
    } catch (error) {
        console.error("Lỗi submitAssignment:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi nộp bài." });
    }
};

// 2. Xem lịch sử nộp bài của sinh viên theo Assignment
export const getMySubmissions = async (req: Request, res: Response) => {
    try {
        const studentId = req.user?.userId;
        const { assignmentId } = req.params;

        const submissions = await prisma.submission.findMany({
            where: {
                assignmentId,
                studentId,
            },
            orderBy: { submittedAt: "desc" },
            include: {
                appeal: true,
            },
        });

        return res.json({ success: true, data: submissions });
    } catch (error) {
        console.error("Lỗi getMySubmissions:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách bài nộp." });
    }
};

// 3. Xem chi tiết bài nộp & kết quả chấm (Dùng cho Wireframe 6.7.3)
export const getSubmissionResult = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;

        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: {
                assignment: { select: { title: true, language: true, testCases: true } },
                student: { include: { user: { select: { fullName: true, email: true } } } },
                appeal: true,
                fingerprint: true,
                plagiarismMatches1: true,
                plagiarismMatches2: true,
            },
        });

        if (!submission) {
            return res.status(404).json({ success: false, message: "Không tìm thấy kết quả bài nộp." });
        }

        return res.json({ success: true, data: submission });
    } catch (error) {
        console.error("Lỗi getSubmissionResult:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy kết quả bài nộp." });
    }
};

// 4. Sinh viên gửi đơn Khiếu nại điểm số (US05)
export const createAppeal = async (req: Request, res: Response) => {
    try {
        const studentId = req.user?.userId;
        const { submissionId, reason } = req.body;

        if (!studentId || !submissionId || !reason) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập lý do khiếu nại." });
        }

        const existingAppeal = await prisma.appeal.findUnique({
            where: { submissionId },
        });

        if (existingAppeal) {
            return res.status(400).json({ success: false, message: "Bài nộp này đã có đơn khiếu nại trước đó." });
        }

        const appeal = await prisma.appeal.create({
            data: {
                submissionId,
                studentId,
                reason,
                status: "PENDING",
            },
        });

        return res.status(201).json({
            success: true,
            message: "Gửi đơn khiếu nại thành công!",
            data: appeal,
        });
    } catch (error) {
        console.error("Lỗi createAppeal:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo khiếu nại." });
    }
};

// 5. Giảng viên giải quyết khiếu nại & Bắt buộc lưu Audit Log nếu sửa điểm (Risk R03 & US10)
export const resolveAppeal = async (req: Request, res: Response) => {
    try {
        const lecturerId = req.user?.userId;
        const { appealId } = req.params;
        const { status, lecturerResponse, newScore, reasonForScoreChange } = req.body;

        if (!lecturerId) {
            return res.status(401).json({ success: false, message: "Chưa xác thực." });
        }

        const appeal = await prisma.appeal.findUnique({
            where: { id: appealId },
            include: { submission: true },
        });

        if (!appeal) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn khiếu nại." });
        }

        // Xử lý bằng Transaction để đảm bảo tính toàn vẹn (Risk R03)
        await prisma.$transaction(async (tx) => {
            // 1. Cập nhật trạng thái Appeal
            await tx.appeal.update({
                where: { id: appealId },
                data: {
                    status: status || "RESOLVED",
                    lecturerResponse,
                    resolvedBy: lecturerId,
                    resolvedAt: new Date(),
                },
            });

            // 2. Nếu có thay đổi điểm số -> Cập nhật Submission và ghi SCORE_AUDIT_LOGS
            if (newScore !== undefined && newScore !== null) {
                const oldScore = appeal.submission.totalScore;

                await tx.submission.update({
                    where: { id: appeal.submissionId },
                    data: { totalScore: Number(newScore) },
                });

                // Bắt buộc ghi log sửa điểm theo Risk R03
                await tx.scoreAuditLog.create({
                    data: {
                        submissionId: appeal.submissionId,
                        editorId: lecturerId,
                        oldScore: oldScore,
                        newScore: Number(newScore),
                        reason: reasonForScoreChange || lecturerResponse || "Điều chỉnh sau khiếu nại",
                    },
                });
            }
        });

        return res.json({
            success: true,
            message: "Đã xử lý khiếu nại thành công!",
        });
    } catch (error) {
        console.error("Lỗi resolveAppeal:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý khiếu nại." });
    }
};

// Lấy danh sách các đơn khiếu nại chờ duyệt (Lecturer)
export const getPendingAppeals = async (req: Request, res: Response) => {
    try {
        const appeals = await prisma.appeal.findMany({
            where: { status: "PENDING" },
            include: {
                submission: {
                    include: {
                        assignment: { select: { title: true } },
                    },
                },
                student: {
                    include: { user: { select: { fullName: true, email: true } } },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return res.json({ success: true, data: appeals });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách khiếu nại." });
    }
};

// API Endpoint cho Phân hệ 2 (Sandbox), 4 (AST), 5 (Queue) cập nhật kết quả chấm
export const updateSubmissionGradingResult = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;
        const {
            status, // "GRADED", "COMPILATION_ERROR", "TIMEOUT", "SECURITY_VIOLATION"
            totalScore,
            aiFeedback,
            step,
            progressPercent,
            message,
        } = req.body;

        const updated = await prisma.submission.update({
            where: { id: submissionId },
            data: {
                ...(status && { status }),
                ...(totalScore !== undefined && { totalScore: Number(totalScore) }),
                ...(aiFeedback && { aiFeedback }),
            },
        });

        // Phát WebSocket real-time cho sinh viên đang xem Stepper
        if (step) {
            emitGradingProgress({
                submissionId,
                step,
                progressPercent: progressPercent || 100,
                message: message || "Đang xử lý kết quả...",
            });
        }

        return res.json({ success: true, message: "Đã cập nhật kết quả chấm!", data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi khi cập nhật kết quả bài nộp." });
    }
};
