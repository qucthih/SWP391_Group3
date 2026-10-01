"""Phương án dự phòng: chuẩn hóa ở mức TOKEN (không cần parse tree).

Ý TƯỞNG (đọc trước khi đọc code)
================================
Parser ANTLR có thể thất bại khi bài nộp có cú pháp lạ (đối thủ cố tình né, hoặc bài
chưa hoàn chỉnh). Nếu ta bỏ qua những bài đó thì kẻ đạo văn chỉ cần "làm hỏng" cú pháp
một chút là thoát -> KHÔNG được bỏ qua.

    parse OK  ─▶ tree_normalizer  ─▶ Winnowing   (chế độ "ast",  mạnh, chống đảo hàm)
    parse FAIL ─▶ lexer_fallback  ─▶ Winnowing   (chế độ "lex",   yếu hơn nhưng luôn chạy)

Vì sao viết bộ tách token bằng regex thay vì dùng JavaLexer của ANTLR?
  * Không bao giờ ném lỗi, kể cả với đầu vào rác: ký tự lạ bị bỏ qua thay vì làm dừng cả pipeline.
  * Không phụ thuộc vào code sinh tự động, nên fallback vẫn chạy khi grammar/parser có vấn đề.

Chuẩn hóa (giống tinh thần tree_normalizer, nhưng không biết vai trò của tên):
    comment, khoảng trắng   -> bỏ
    tên (không phải từ khóa) -> ID       (không phân biệt được biến/hàm vì không có cây)
    số                       -> NUM
    chuỗi / ký tự / text block -> STR
    true / false             -> BOOL
    dấu câu ; , ( ) { } [ ] . -> bỏ
    import / package ... ;   -> bỏ
    từ khóa, toán tử         -> giữ nguyên

GIỚI HẠN: không có cây nên KHÔNG sắp xếp lại được các hàm -> đảo thứ tự hàm chỉ bị
chặn ở chế độ "ast". Vì vậy analyzer luôn tính cả hai loại fingerprint.
"""

from __future__ import annotations

import re
from typing import List

from .tree_normalizer import KEYWORDS, NormToken

# Thứ tự các nhánh QUAN TRỌNG: nhánh dài/đặc thù phải đứng trước nhánh ngắn.
_TOKEN_RE = re.compile(
    r"""
      (?P<ws>\s+)
    | (?P<line_comment>//[^\n]*)
    | (?P<block_comment>/\*.*?(?:\*/|\Z))          # comment chưa đóng: ăn tới hết file
    | (?P<text_block>\"\"\".*?(?:\"\"\"|\Z))
    | (?P<string>"(?:\\.|[^"\\\n])*"?)             # chuỗi chưa đóng: dừng ở hết dòng
    | (?P<char>'(?:\\.|[^'\\\n])*'?)
    | (?P<num>(?:\d(?:[\w.]|(?<=[eEpP])[+-])*|\.\d(?:\w|(?<=[eEpP])[+-])*))
    | (?P<ident>[^\W\d][\w$]*|\$[\w$]*)
    | (?P<op>>>>=|<<=|>>=|>>>|>>|<<|\.\.\.|->|::|\+\+|--|&&|\|\||==|!=|<=|>=|\+=|-=|\*=|/=|%=|&=|\|=|\^=|[-+*/%&|^~!<>=?:@])
    | (?P<punct>[{}()\[\];,.])
    | (?P<other>.)
    """,
    re.VERBOSE | re.DOTALL | re.UNICODE,
)


def tokenize_fallback(source: str) -> List[NormToken]:
    """Tách và chuẩn hóa token của mã nguồn Java; KHÔNG bao giờ ném lỗi cú pháp."""
    tokens: List[NormToken] = []
    line = 1
    skipping_directive = False  # đang bỏ qua một câu import/package cho tới dấu ';'

    for match in _TOKEN_RE.finditer(source):
        kind = match.lastgroup
        text = match.group()
        tok_line = line
        line += text.count("\n")

        if kind in ("ws", "line_comment", "block_comment", "other"):
            continue

        if skipping_directive:
            if kind == "punct" and text == ";":
                skipping_directive = False
            continue

        if kind == "punct":
            continue
        if kind in ("string", "char", "text_block"):
            tokens.append(NormToken("STR", tok_line))
        elif kind == "num":
            tokens.append(NormToken("NUM", tok_line))
        elif kind == "ident":
            if text in ("import", "package"):
                skipping_directive = True
            elif text in ("true", "false"):
                tokens.append(NormToken("BOOL", tok_line))
            elif text in KEYWORDS:
                tokens.append(NormToken(text, tok_line))
            else:
                tokens.append(NormToken("ID", tok_line))
        else:  # op
            tokens.append(NormToken(text, tok_line))
    return tokens


def normalize_lexical(source: str) -> List[str]:
    """Chỉ trả về chuỗi giá trị token — đầu vào của Winnowing ở chế độ "lex"."""
    return [t.value for t in tokenize_fallback(source)]
