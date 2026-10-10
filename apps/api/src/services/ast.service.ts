/**
 * ast.service.ts — Service xử lý nghiệp vụ kiểm tra đạo văn AST/Winnowing
 *
 * Tách biệt hoàn toàn từ submission.controller.ts theo yêu cầu kiến trúc (HUONG_DAN §4 & can phan he 1 chot A3).
 * Hàm chính: check(submissionId)
 *   1. Đọc source code từ file bài nộp đã lưu trên disk
 *   2. Gọi astClient.analyze() lấy fingerprint, metadata (mode, fallback, warnings)
 *   3. Upsert vào bảng AST_FINGERPRINTS (lưu trọn vẹn cả metadata mới)
 *   4. Lấy danh sách fingerprint của các bài khác cùng assignment
 *   5. Gọi astClient.compareBatch() so khớp toàn bộ
 *   6. Chuẩn hóa ID nhỏ trước, đảo a_lines ↔ b_lines nếu bị ngược, upsert PLAGIARISM_MATCHES (kèm level, mode)
 *   7. Nếu có cặp DANGER: đặt SCORE_WITHHELD, ghi SCORE_AUDIT_LOGS, emit WebSocket
 *   8. Cập nhật astCheckStatus: DONE hoặc NEEDS_REVIEW (nếu có warning/fallback), FAILED nếu lỗi
 */

import fs from "fs";
import { prisma } from "../prisma.js";
import { emitGradingProgress } from "../socket/index.js";
import { astClient, ASTSubmissionInput } from "./ast.client.js";

export interface ASTCheckResult {
    success: boolean;
    status: "DONE" | "NEEDS_REVIEW" | "FAILED";
    similarityPercent: number;
    isPlagiarism: boolean;
    matchedPairs: number;
    message?: string;
}

export const astService = {
    /**
     * Thực thi toàn bộ pipeline kiểm tra AST cho một bài nộp
     */
    async check(submissionId: string, filePath?: string): Promise<ASTCheckResult> {
        try {
            // Lấy thông tin bài nộp và assignment
            const submission = await prisma.submission.findUnique({
                where: { id: submissionId },
                include: { assignment: true },
            });

            if (!submission) {
                console.error(`[astService] Submission không tồn tại: ${submissionId}`);
                return {
                    success: false,
                    status: "FAILED",
                    similarityPercent: 0,
                    isPlagiarism: false,
                    matchedPairs: 0,
                    message: "Submission not found",
                };
            }

            // Xác định đường dẫn file bài nộp
            const resolvedPath = filePath || submission.fileUrl;
            if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                console.error(`[astService] File bài nộp không tìm thấy trên đĩa: ${resolvedPath}`);
                await prisma.submission.update({
                    where: { id: submissionId },
                    data: { astCheckStatus: "FAILED" },
                });
                return {
                    success: false,
                    status: "FAILED",
                    similarityPercent: 0,
                    isPlagiarism: false,
                    matchedPairs: 0,
                    message: "Submission file not found on disk",
                };
            }

            // ── Bước 1: Đọc source code ──────────────────────────────────────────
            const sourceCode = fs.readFileSync(resolvedPath, "utf-8");

            // ── Bước 2: Gọi engine POST /analyze ─────────────────────────────────
            const analyzeResult = await astClient.analyze(submissionId, sourceCode);

            if (!analyzeResult) {
                // Engine lỗi 5xx hoặc timeout: cập nhật FAILED
                await prisma.submission.update({
                    where: { id: submissionId },
                    data: { astCheckStatus: "FAILED" },
                });
                return {
                    success: false,
                    status: "FAILED",
                    similarityPercent: 0,
                    isPlagiarism: false,
                    matchedPairs: 0,
                    message: "Engine analysis failed or timed out",
                };
            }

            // Kiểm tra xem bài có cần giảng viên xem tay không (fallback lex hoặc có warnings)
            const needsManualReview =
                analyzeResult.analysis_mode === "lex" ||
                (analyzeResult.warnings && analyzeResult.warnings.length > 0) ||
                analyzeResult.fallback_reason !== null;

            // ── Bước 3: Lưu fingerprint và metadata vào DB ───────────────────────
            await prisma.aSTFingerprint.upsert({
                where: { submissionId },
                create: {
                    submissionId,
                    fingerprintData: JSON.stringify(analyzeResult.fingerprint),
                    analysisMode: analyzeResult.analysis_mode,
                    fallbackReason: analyzeResult.fallback_reason,
                    warnings: JSON.stringify(analyzeResult.warnings || []),
                },
                update: {
                    fingerprintData: JSON.stringify(analyzeResult.fingerprint),
                    analysisMode: analyzeResult.analysis_mode,
                    fallbackReason: analyzeResult.fallback_reason,
                    warnings: JSON.stringify(analyzeResult.warnings || []),
                },
            });

            // ── Bước 4: Lấy fingerprint các bài khác cùng assignment ─────────────
            const siblingSubmissions = await prisma.submission.findMany({
                where: {
                    assignmentId: submission.assignmentId,
                    id: { not: submissionId },
                    fingerprint: { isNot: null },
                },
                include: { fingerprint: true },
            });

            let maxSimilarity = 0;
            let hasDanger = false;
            let matchCount = 0;

            if (siblingSubmissions.length > 0) {
                // Chuẩn bị danh sách gửi so sánh batch
                const batchInputs: ASTSubmissionInput[] = [
                    {
                        submission_id: submissionId,
                        fingerprint: analyzeResult.fingerprint,
                    },
                    ...siblingSubmissions.map((s) => ({
                        submission_id: s.id,
                        fingerprint: JSON.parse(s.fingerprint!.fingerprintData),
                    })),
                ];

                // ── Bước 5: Gọi POST /compare/batch ──────────────────────────────
                const batchResult = await astClient.compareBatch(batchInputs, {
                    minPercent: 30,
                    with_fragments: true,
                });

                if (batchResult && batchResult.matches.length > 0) {
                    // Lọc các cặp có bài nộp hiện tại
                    const currentMatches = batchResult.matches.filter(
                        (m) => m.submission_1_id === submissionId || m.submission_2_id === submissionId
                    );

                    matchCount = currentMatches.length;

                    for (const match of currentMatches) {
                        if (match.similarity_percent > maxSimilarity) {
                            maxSimilarity = match.similarity_percent;
                        }

                        // ── Bước 6: Chuẩn hóa ID nhỏ trước và đảo a_lines ↔ b_lines nếu ngược ──
                        const isReversed = match.submission_1_id > match.submission_2_id;
                        const [s1, s2] = [match.submission_1_id, match.submission_2_id].sort();

                        let fragments = match.matched_fragments || [];
                        if (isReversed) {
                            fragments = fragments.map((f) => ({
                                a_lines: f.b_lines,
                                b_lines: f.a_lines,
                            }));
                        }

                        await prisma.plagiarismMatch.upsert({
                            where: { submission1Id_submission2Id: { submission1Id: s1, submission2Id: s2 } },
                            create: {
                                submission1Id: s1,
                                submission2Id: s2,
                                similarityPercent: match.similarity_percent,
                                level: match.level,
                                mode: match.mode,
                                matchedFragments: JSON.stringify(fragments),
                            },
                            update: {
                                similarityPercent: match.similarity_percent,
                                level: match.level,
                                mode: match.mode,
                                matchedFragments: JSON.stringify(fragments),
                            },
                        });

                        // ── Bước 7: Cặp DANGER → giữ điểm + ghi ScoreAuditLog ──────
                        if (match.level === "DANGER" && match.flag === "PLAGIARISM_DETECTED") {
                            hasDanger = true;
                            await prisma.$transaction(async (tx) => {
                                await tx.submission.update({
                                    where: { id: submissionId },
                                    data: { status: "SCORE_WITHHELD" },
                                });
                                await tx.scoreAuditLog.create({
                                    data: {
                                        submissionId,
                                        editorId: "system",
                                        oldScore: null,
                                        newScore: 0,
                                        reason: `Nghi ngờ đạo văn: ${match.similarity_percent.toFixed(1)}% tương đồng với bài ${[s1, s2].find((id) => id !== submissionId)}`,
                                    },
                                });
                            });

                            emitGradingProgress({
                                submissionId,
                                step: "AST_ANALYSIS",
                                progressPercent: 100,
                                message: `Phát hiện khả năng đạo văn (${match.similarity_percent.toFixed(1)}%). Điểm tạm giữ, chờ Giảng viên xác nhận.`,
                            });
                        }
                    }
                }
            }

            // ── Bước 8: Đánh dấu DONE hoặc NEEDS_REVIEW ──────────────────────────
            const finalStatus = needsManualReview ? "NEEDS_REVIEW" : "DONE";
            await prisma.submission.update({
                where: { id: submissionId },
                data: { astCheckStatus: finalStatus },
            });

            emitGradingProgress({
                submissionId,
                step: "AST_ANALYSIS",
                progressPercent: 100,
                message: needsManualReview
                    ? "Kiểm tra AST hoàn tất (có cảnh báo cú pháp/độ tin cậy thấp, chờ duyệt)."
                    : "Kiểm tra AST hoàn tất: Không phát hiện vi phạm quy chế.",
            });

            return {
                success: true,
                status: finalStatus,
                similarityPercent: maxSimilarity,
                isPlagiarism: hasDanger,
                matchedPairs: matchCount,
            };
        } catch (error: any) {
            console.error(`[astService] Lỗi nghiêm trọng khi chạy check(${submissionId}):`, error?.message);
            await prisma.submission.update({
                where: { id: submissionId },
                data: { astCheckStatus: "FAILED" },
            }).catch(() => {});

            return {
                success: false,
                status: "FAILED",
                similarityPercent: 0,
                isPlagiarism: false,
                matchedPairs: 0,
                message: error?.message,
            };
        }
    },
};
