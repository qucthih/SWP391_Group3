"""Cấu hình pytest dùng chung: cho phép `from tests.helpers import ...` trong các test."""
import sys
from pathlib import Path

# apps/ast-engine (thư mục chứa `tests/`) cần nằm trong sys.path.
_ROOT = str(Path(__file__).resolve().parents[1])
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
