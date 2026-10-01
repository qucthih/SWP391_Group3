"""Các endpoint của AST Engine. Engine KHÔNG truy cập DB: api-gateway lưu kết quả (xem ADR-001)."""
from fastapi import APIRouter

from .. import __version__
from .schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=__version__)


# [TODO] POST /analyze  : nhận source -> trả fingerprint
# [TODO] POST /compare  : nhận 1 bài mới + danh sách fingerprint cũ -> trả các cặp trùng + %
