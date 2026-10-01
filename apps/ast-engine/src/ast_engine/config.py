"""Tham số của engine. Giá trị mặc định lấy từ SRS v1.2 (US14, mục 4.3 và US04)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class WinnowingConfig:
    k: int = 25          # độ dài k-gram (SRS US14)
    window: int = 40     # kích thước cửa sổ trượt (SRS US14)
    # Ngưỡng đảm bảo phát hiện của Winnowing: mọi đoạn trùng >= window + k - 1 token đều bị bắt.
    # Đây là tham số nên thử nghiệm lại (k, window nhỏ hơn) cho bài báo IEEE.

    @property
    def guarantee_threshold(self) -> int:
        return self.window + self.k - 1


@dataclass(frozen=True)
class SimilarityThresholds:
    warning: float = 30.0   # 0-30%: Safe, 30-60%: Warning (SRS US04)
    danger: float = 60.0    # >60%: flag PLAGIARISM_DETECTED + giữ điểm (SCORE_WITHHELD)


WINNOWING = WinnowingConfig()
THRESHOLDS = SimilarityThresholds()
