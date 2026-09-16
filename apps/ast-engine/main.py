"""
AITA-INTELLIGENT — AST Code Analytics & Plagiarism Detection Engine
Module: apps/ast-engine
Công nghệ: Python 3.11+ / FastAPI / ANTLR4
Tuân thủ đặc tả SRS v1.2 Mục 8.1 & 8.2 (MVP hỗ trợ Java AST)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import time

app = FastAPI(
    title="AITA AST Code Analytics Engine",
    description="Microservice phân tích Cây cú pháp trừu tượng (AST) và phát hiện đạo văn mã nguồn bằng giải thuật Winnowing",
    version="1.0.0",
)

# Cấu hình CORS để API Gateway (Node.js) hoặc Frontend có thể gọi sang
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Schemas dữ liệu (Pydantic Models)
# ------------------------------------------------------------------------------

class ASTParseRequest(BaseModel):
    submission_id: str = Field(..., description="ID của bài nộp cần phân tích")
    language: str = Field(default="Java", description="Ngôn ngữ lập trình (MVP: Java)")
    source_code: str = Field(..., description="Nội dung mã nguồn cần bóc tách AST")


class ASTFingerprintItem(BaseModel):
    hash_value: int
    position: int


class ASTParseResponse(BaseModel):
    submission_id: str
    status: str
    language: str
    node_count: int
    fingerprints: List[ASTFingerprintItem]
    message: str


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """Kiểm tra trạng thái hoạt động của microservice AST Engine"""
    return {
        "service": "AITA AST Engine",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": time.time()
    }


@app.post("/api/v1/ast/parse", response_model=ASTParseResponse)
def parse_ast_endpoint(request: ASTParseRequest):
    """
    Endpoint khởi tạo (Skeleton) theo yêu cầu:
    Nhận mã nguồn -> Bóc tách cây cú pháp AST -> Chuẩn bị trích xuất k-grams và tính Fingerprint Winnowing.
    """
    if not request.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty.")

    # Skeleton placeholder: Phản hồi cấu trúc mẫu, sẵn sàng cho bộ parser ANTLR4 ở các tuần tiếp theo
    return ASTParseResponse(
        submission_id=request.submission_id,
        status="SKELETON_READY",
        language=request.language,
        node_count=0,
        fingerprints=[],
        message="AST Engine skeleton endpoint initialized successfully. Ready for ANTLR4 Java grammar integration."
    )


if __name__ == "__main__":
    import uvicorn
    # Chạy cục bộ ở cổng 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
