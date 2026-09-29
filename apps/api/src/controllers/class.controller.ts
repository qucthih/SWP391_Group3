import { Request, Response } from "express";
import * as xlsx from "xlsx";
import { prisma } from "../prisma.js";

// 1. Tạo lớp học mới (chỉ LECTURER hoặc ADMIN)
export const createClass = async (req: Request, res: Response) => {
    try {
        const { classCode } = req.body;
        const lecturerId = req.user?.userId;

        if (!classCode) {
            return res.status(400).json({ success: false, message: "Mã lớp (classCode) là bắt buộc." });
        }

        if (!lecturerId) {
            return res.status(401).json({ success: false, message: "Chưa xác thực danh tính." });
        }

        // Đảm bảo user có profile Lecturer
        const lecturer = await prisma.lecturer.findUnique({
            where: { userId: lecturerId },
        });

        if (!lecturer) {
            return res.status(403).json({ success: false, message: "Tài khoản không phải là Giảng viên." });
        }

        const newClass = await prisma.class.create({
            data: {
                classCode: classCode.trim().toUpperCase(),
                lecturerId: lecturerId,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Tạo lớp học thành công!",
            data: newClass,
        });
    } catch (error: any) {
        console.error("Lỗi createClass:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo lớp học." });
    }
};

// 2. Lấy danh sách lớp học (tự lọc theo Role)
export const getMyClasses = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Chưa xác thực." });
        }

        if (user.role === "LECTURER") {
            const classes = await prisma.class.findMany({
                where: { lecturerId: user.userId },
                include: {
                    _count: { select: { students: true, assignments: true } },
                },
            });
            return res.json({ success: true, data: classes });
        }

        if (user.role === "STUDENT") {
            const enrollments = await prisma.classStudent.findMany({
                where: { studentId: user.userId, status: "ACTIVE" },
                include: {
                    class: {
                        include: {
                            lecturer: { include: { user: { select: { fullName: true, email: true } } } },
                            _count: { select: { assignments: true } },
                        },
                    },
                },
            });
            return res.json({ success: true, data: enrollments.map((e) => e.class) });
        }

        // Nếu là ADMIN thì lấy tất cả
        const allClasses = await prisma.class.findMany({
            include: {
                lecturer: { include: { user: { select: { fullName: true, email: true } } } },
                _count: { select: { students: true, assignments: true } },
            },
        });
        return res.json({ success: true, data: allClasses });
    } catch (error) {
        console.error("Lỗi getMyClasses:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách lớp." });
    }
};

// 3. Import sinh viên bằng file Excel (.xlsx) với Transaction (NFR-12 & US06)
export const importStudentsFromExcel = async (req: Request, res: Response) => {
    try {
        const { classId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "Vui lòng đính kèm file Excel (.xlsx)." });
        }

        // Đọc file Excel từ bộ nhớ đệm (buffer)
        const workbook = xlsx.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = xlsx.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: "File Excel rỗng, không có dữ liệu." });
        }

        // Định dạng mong đợi: các cột email, studentCode (hoặc mssv), fullName
        const studentsToEnroll: { email: string; studentCode: string; fullName: string }[] = [];

        for (const [index, row] of rows.entries()) {
            const email = (row["Email"] || row["email"] || "").toString().trim().toLowerCase();
            const studentCode = (row["StudentCode"] || row["MSSV"] || row["mssv"] || row["student_code"] || "").toString().trim().toUpperCase();
            const fullName = (row["FullName"] || row["HoTen"] || row["full_name"] || email.split("@")[0]).toString().trim();

            if (!email || !studentCode) {
                return res.status(400).json({
                    success: false,
                    message: `Lỗi tại dòng ${index + 2}: Thiếu Email hoặc Mã số sinh viên. Toàn bộ thao tác đã bị hủy (Rollback).`,
                });
            }

            studentsToEnroll.push({ email, studentCode, fullName });
        }

        // Chạy Database Transaction đảm bảo ACID: Toàn bộ thành công hoặc Rollback (NFR-12)
        const result = await prisma.$transaction(async (tx) => {
            let enrolledCount = 0;

            for (const item of studentsToEnroll) {
                // Tìm hoặc tạo User + Student
                let user = await tx.user.findUnique({
                    where: { email: item.email },
                    include: { studentProfile: true },
                });

                if (!user) {
                    user = await tx.user.create({
                        data: {
                            email: item.email,
                            fullName: item.fullName,
                            role: "STUDENT",
                            studentProfile: {
                                create: {
                                    studentCode: item.studentCode,
                                },
                            },
                        },
                        include: { studentProfile: true },
                    });
                }

                const studentId = user.id;

                // Thêm vào lớp nếu chưa có
                const existingEnrollment = await tx.classStudent.findUnique({
                    where: {
                        classId_studentId: {
                            classId,
                            studentId,
                        },
                    },
                });

                if (!existingEnrollment) {
                    await tx.classStudent.create({
                        data: {
                            classId,
                            studentId,
                            status: "ACTIVE",
                        },
                    });
                    enrolledCount++;
                }
            }

            return { totalImported: enrolledCount };
        });

        return res.json({
            success: true,
            message: `Import thành công! Đã ghi danh ${result.totalImported} sinh viên vào lớp.`,
            data: result,
        });
    } catch (error: any) {
        console.error("Lỗi importStudentsFromExcel:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Lỗi máy chủ khi import danh sách sinh viên.",
        });
    }
};

// Cập nhật thông tin lớp (Sửa mã lớp, đổi giảng viên)
export const updateClass = async (req: Request, res: Response) => {
    try {
        const { classId } = req.params;
        const { classCode, lecturerId } = req.body;

        const updated = await prisma.class.update({
            where: { id: classId },
            data: {
                ...(classCode && { classCode: classCode.trim().toUpperCase() }),
                ...(lecturerId && { lecturerId }),
            },
        });

        return res.json({ success: true, message: "Cập nhật lớp thành công!", data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật lớp." });
    }
};

// Xóa lớp học
export const deleteClass = async (req: Request, res: Response) => {
    try {
        const { classId } = req.params;
        await prisma.class.delete({ where: { id: classId } });
        return res.json({ success: true, message: "Đã xóa lớp học thành công!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xóa lớp." });
    }
};

