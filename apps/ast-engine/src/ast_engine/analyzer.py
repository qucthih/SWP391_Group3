"""Điểm nối các module: source Java -> SubmissionFingerprints.

Luồng xử lý (endpoint POST /analyze sẽ gọi hàm `analyze_source`):

    source ─┬─▶ lexer_fallback ─▶ Winnowing ─▶ fingerprint "lex"   (LUÔN tính)
            │
            └─▶ parse_java ──┬─ 0 lỗi cú pháp ─▶ tree_normalizer ─▶ Winnowing ─▶ fingerprint "ast"
                             └─ có lỗi / exception ─▶ ast = None  (matcher sẽ dùng "lex")

Chính sách: chỉ tin fingerprint "ast" khi parse KHÔNG có lỗi nào. Nếu cho qua cây đã được
ANTLR "sửa lỗi", kẻ đạo văn có thể cố ý chèn cú pháp hỏng để cây bị cắt cụt, làm tụt điểm giống nhau.

Hợp đồng với parse_java (xem parsing/parse_java.py): trả về ParseResult có `.tree` và
`.issues` (danh sách SyntaxIssue). Số lỗi cú pháp = len(issues). Nếu parse_java đổi chữ ký,
`_unpack_parse_result` sẽ BÁO LỖI RÕ RÀNG (ParseContractError) thay vì lặng lẽ coi là "0 lỗi".
"""

from __future__ import annotations

from typing import Any, Callable, Optional, Tuple

from ast_engine.fingerprint.winnowing import (
    DEFAULT_K,
    DEFAULT_WINDOW,
    Fingerprint,
    build_fingerprint,
)
from ast_engine.normalization.lexer_fallback import tokenize_fallback
from ast_engine.normalization.tree_normalizer import normalize_tree_with_lines
from ast_engine.similarity.matcher import SubmissionFingerprints


class ParseContractError(TypeError):
    """parse_java trả về kiểu không đúng hợp đồng (thiếu .tree / .issues)."""


def _unpack_parse_result(result: Any) -> Tuple[Any, int]:
    """Đưa kết quả parse_java về dạng (tree, số_lỗi_cú_pháp).

    Hợp đồng thật: object có `.tree` và `.issues` (list[SyntaxIssue]).
    Cũng chấp nhận `.errors` hoặc tuple (tree, errors) để dễ viết test.
    KHÔNG có giá trị mặc định: thiếu thông tin lỗi mà vẫn coi là "0 lỗi" sẽ khiến
    bài hỏng bị tin nhầm là bài sạch — đúng điều chính sách của analyzer cấm.
    """
    if hasattr(result, "tree"):
        tree = result.tree
        if hasattr(result, "issues"):
            errors = result.issues
        elif hasattr(result, "errors"):
            errors = result.errors
        else:
            raise ParseContractError(
                f"{type(result).__name__} có .tree nhưng không có .issues/.errors"
            )
    elif isinstance(result, tuple) and len(result) == 2:
        tree, errors = result
    else:
        raise ParseContractError(f"Không hiểu kết quả parse_java: {type(result).__name__}")

    if hasattr(errors, "__len__"):
        return tree, len(errors)
    if isinstance(errors, int):
        return tree, errors
    raise ParseContractError(f"Không đếm được lỗi cú pháp từ: {type(errors).__name__}")


def _run_parser(source: str) -> Tuple[Any, int]:
    from ast_engine.parsing import parse_java  # import muộn để module này test được độc lập

    return _unpack_parse_result(parse_java(source))


def analyze_source(
    submission_id: str,
    source: str,
    *,
    k: int = DEFAULT_K,
    window: int = DEFAULT_WINDOW,
    parse_fn: Optional[Callable[[str], Tuple[Any, int]]] = None,
) -> SubmissionFingerprints:
    """Tạo bộ fingerprint ("lex" luôn có, "ast" khi parse sạch) cho một bài nộp."""
    lex_tokens = tokenize_fallback(source)
    lex_fp = build_fingerprint(
        [t.value for t in lex_tokens],
        [t.line for t in lex_tokens],
        mode="lex",
        k=k,
        window=window,
    )

    ast_fp: Optional[Fingerprint] = None
    error_count = 0
    parse_ok = False
    try:
        tree, error_count = (parse_fn or _run_parser)(source)
        if tree is not None and error_count == 0:
            ast_tokens = normalize_tree_with_lines(tree)
            ast_fp = build_fingerprint(
                [t.value for t in ast_tokens],
                [t.line for t in ast_tokens],
                mode="ast",
                k=k,
                window=window,
            )
            parse_ok = True
    except ParseContractError:  # lỗi lập trình/hợp đồng: phải lộ ra, không được nuốt
        raise
    except Exception:  # parser/normalizer lỗi bất ngờ -> vẫn còn fingerprint "lex"
        ast_fp = None
        parse_ok = False

    return SubmissionFingerprints(
        submission_id=submission_id,
        lex=lex_fp,
        ast=ast_fp,
        parse_ok=parse_ok,
        syntax_error_count=error_count,
    )