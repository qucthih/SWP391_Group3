import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../prisma.js";
import { env } from "../config/env.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const EMAIL_REGEX = /^[^@\s]+@(fpt|fe)\.edu\.vn$/;

export const loginWithGoogle = async (req: Request, res: Response) => {
    try {
        const { credential } = req.body;

        if (!credential || typeof credential !== "string") {
            return res.status(400).json({ success: false, message: "Thiếu Google credential." });
        }

        // 1. Verify token với Google
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } catch (err) {
            return res.status(401).json({ success: false, message: "Google token không hợp lệ." });
        }

        if (!payload?.email || !payload.email_verified) {
            return res.status(401).json({ success: false, message: "Email Google chưa được xác minh." });
        }

        // 2. Lấy dữ liệu từ payload đã verify, chuẩn hóa email
        const email = payload.email.trim().toLowerCase();
        const fullName = payload.name || email.split("@")[0];

        // 3. Kiểm tra domain FPT theo SRS mục 6.7.1
        if (!EMAIL_REGEX.test(email)) {
            return res.status(403).json({
                success: false,
                message: "Vui lòng sử dụng tài khoản email FPT Education (@fpt.edu.vn hoặc @fe.edu.vn) để đăng nhập.",
            });
        }

        // 4. Phân loại Role mặc định theo domain
        const defaultRole: "STUDENT" | "LECTURER" = email.endsWith("@fe.edu.vn") ? "LECTURER" : "STUDENT";
        const code = email.split("@")[0].toUpperCase();

        // 5. Tìm hoặc tạo user trong DB (khớp tên quan hệ studentProfile/lecturerProfile/adminProfile)
        let user = await prisma.user.findUnique({
            where: { email },
            include: { studentProfile: true, lecturerProfile: true, adminProfile: true },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    fullName,
                    role: defaultRole,
                    ...(defaultRole === "STUDENT" && {
                        studentProfile: { create: { studentCode: code } },
                    }),
                    ...(defaultRole === "LECTURER" && {
                        lecturerProfile: { create: { lecturerCode: code } },
                    }),
                },
                include: { studentProfile: true, lecturerProfile: true, adminProfile: true },
            });
        }

        // 6. Ký JWT Token
        const token = jwt.sign(
            { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
            env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({
            success: true,
            message: "Đăng nhập thành công!",
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    student: user.studentProfile,
                    lecturer: user.lecturerProfile,
                    admin: user.adminProfile,
                },
            },
        });
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ khi đăng nhập." });
    }
};

export const getCurrentUser = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Chưa xác thực." });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { studentProfile: true, lecturerProfile: true, adminProfile: true },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
        }

        return res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                student: user.studentProfile,
                lecturer: user.lecturerProfile,
                admin: user.adminProfile,
            },
        });
    } catch (error) {
        console.error("Lỗi getCurrentUser:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ." });
    }
};
