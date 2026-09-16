import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

// Định nghĩa các bước chấm điểm theo SRS mục 6.7.3
export type GradingStep =
  | "QUEUED"
  | "BUILDING"
  | "RUNNING_TESTS"
  | "AST_ANALYSIS"
  | "AI_REVIEW"
  | "COMPLETE"
  | "FAILED";

export interface GradingProgressPayload {
  submissionId: string;
  step: GradingStep;
  progressPercent: number; // 0 - 100
  message: string;
  data?: any;
}

let io: Server | null = null;

/**
 * Khởi tạo WebSocket Server (Socket.io) gắn vào HTTP Server
 */
export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Cho phép Frontend (Vite port 5173) kết nối
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Client (sinh viên) tham gia vào phòng lắng nghe của bài nộp cụ thể
    socket.on("join_submission", (submissionId: string) => {
      socket.join(`submission_${submissionId}`);
      console.log(`[WebSocket] Client ${socket.id} joined room: submission_${submissionId}`);
      socket.emit("joined", { submissionId, message: "Connected to submission stream" });
    });

    // Rời phòng
    socket.on("leave_submission", (submissionId: string) => {
      socket.leave(`submission_${submissionId}`);
      console.log(`[WebSocket] Client ${socket.id} left room: submission_${submissionId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Hàm tiện ích để các module khác (Sandbox, Queue, AST) phát sự kiện tiến trình chấm bài tới Client
 */
export function emitGradingProgress(payload: GradingProgressPayload) {
  if (!io) {
    console.warn("[WebSocket] Socket.io not initialized yet.");
    return;
  }
  io.to(`submission_${payload.submissionId}`).emit("grading_progress", payload);
}

export function getSocketServer(): Server | null {
  return io;
}
