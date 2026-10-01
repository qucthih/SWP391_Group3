"""Chuẩn hóa parse tree (ANTLR) thành chuỗi token "trung tính" để đưa vào Winnowing.

Ý TƯỞNG (đọc trước khi đọc code)
================================
Đối thủ trong AST Bypass Challenge sẽ "ngụy trang" code đạo văn bằng 3 mức:

    Mức 1: đổi tên biến / hàm / tham số
    Mức 2: thêm / sửa comment, thêm khoảng trắng
    Mức 3: đảo thứ tự các hàm (method) trong class

Ta chặn từng mức bằng cách làm cho các thay đổi đó KHÔNG ảnh hưởng đầu ra:

    Mức 1 -> thay mọi tên bằng nhãn theo VAI TRÒ:   sum, total, s  ==>  VAR
                                                    tinhTong, calc ==>  FUNC
    Mức 2 -> comment/whitespace vốn không nằm trong parse tree (lexer đã bỏ qua)
             + literal gộp: 5, 99, "abc"  ==>  NUM, STR
    Mức 3 -> các "thành viên" của class (method, field, ...) được SẮP XẾP theo nội dung
             đã chuẩn hóa, nên đảo thứ tự hàm cho ra cùng một chuỗi.

Sơ đồ:

    source ──ANTLR──▶ parse tree ──duyệt pre-order──▶ [compilationunit, classdeclaration,
                                                        CLASS, methoddeclaration, FUNC, ...]
                          │
                          ├─ bỏ import / package (không mang thông tin logic)
                          ├─ bỏ dấu câu ; , ( ) { } [ ] .  (cấu trúc đã nằm trong tree)
                          ├─ gộp nút chỉ có 1 con (nút bọc, không thêm thông tin)
                          └─ sắp xếp các thành viên độc lập trong class

Đầu ra: danh sách token (kèm số dòng để báo cáo đoạn trùng về sau).

Module này KHÔNG import ANTLR: nó duyệt cây theo "duck typing" (getChildren, parentCtx,
symbol...), nên chạy được với bất kỳ parser ANTLR4 sinh ra từ JavaParser.g4.
Tên luật lấy từ tên lớp context (MethodDeclarationContext -> "methoddeclaration")
và so khớp viết thường, để không phụ thuộc kiểu viết hoa/thường của grammar.
"""

from __future__ import annotations

import re
from typing import Any, Dict, FrozenSet, List, NamedTuple

# --------------------------------------------------------------------------- #
# Hằng số
# --------------------------------------------------------------------------- #

# Từ khóa "cứng" của Java (+ var). Không bao giờ là tên biến/hàm.
KEYWORDS: FrozenSet[str] = frozenset(
    """
    abstract assert boolean break byte case catch char class const continue default do
    double else enum extends final finally float for goto if implements import instanceof
    int interface long native new package private protected public return short static
    strictfp super switch synchronized this throw throws transient try void volatile while
    null var
    """.split()
)

# Từ khóa "theo ngữ cảnh": chỉ là từ khóa khi grammar dùng nó như một token riêng,
# còn nếu nằm trong luật `identifier` thì đó là tên do sinh viên đặt (vd: biến tên `record`).
CONTEXTUAL_KEYWORDS: FrozenSet[str] = frozenset(
    "record sealed permits yield module open requires exports opens to uses provides with transitive".split()
)

# Dấu câu chỉ mang tính cấu trúc — cây đã thể hiện rồi nên bỏ để bớt nhiễu.
_DROP_PUNCT: FrozenSet[str] = frozenset("{ } ( ) [ ] ; , .".split())

_NUM_RE = re.compile(r"^(?:\d|\.\d)")
_IDENT_RE = re.compile(r"^[^\W\d][\w$]*$", re.UNICODE)

# Luật cha bọc quanh token IDENTIFIER (grammar mới: identifier : IDENTIFIER | MODULE | ...)
_IDENT_WRAPPERS: FrozenSet[str] = frozenset({"identifier", "typeidentifier"})

# Không đưa vào chuỗi token (không mang thông tin logic của bài làm).
_SKIP_RULES: FrozenSet[str] = frozenset({"importdeclaration", "packagedeclaration"})

# Vai trò của định danh, suy ra từ luật cha.
_FUNC_OWNERS: FrozenSet[str] = frozenset(
    {
        "methoddeclaration",
        "constructordeclaration",
        "interfacecommonbodydeclaration",
        "annotationmethodrest",
        "methodcall",
        "explicitgenericinvocationsuffix",
    }
)
_CLASS_OWNERS: FrozenSet[str] = frozenset(
    {
        "classdeclaration",
        "interfacedeclaration",
        "enumdeclaration",
        "recorddeclaration",
        "annotationtypedeclaration",
    }
)
_TYPE_OWNERS: FrozenSet[str] = frozenset(
    {
        "classorinterfacetype",
        "createdname",
        "innercreator",
        "qualifiedname",
        "typeparameter",
    }
)
_PARAM_OWNERS: FrozenSet[str] = frozenset({"lambdaparameters"})
# variableDeclaratorId nằm dưới các luật này thì là THAM SỐ, ngược lại là BIẾN.
_PARAM_DECLARATOR_PARENTS: FrozenSet[str] = frozenset({"formalparameter", "lastformalparameter"})

# Container -> các luật con là "thành viên độc lập" (được phép sắp xếp lại).
_SORT_CONTAINERS: Dict[str, FrozenSet[str]] = {
    "compilationunit": frozenset({"typedeclaration"}),
    "classbody": frozenset({"classbodydeclaration"}),
    "interfacebody": frozenset({"interfacebodydeclaration"}),
    "enumbodydeclarations": frozenset({"classbodydeclaration"}),
    "recordbody": frozenset({"classbodydeclaration", "compactconstructordeclaration"}),
}


class NormToken(NamedTuple):
    """Một token đã chuẩn hóa + dòng nguồn (dòng đầu tiên của token/nút đó)."""

    value: str
    line: int


# --------------------------------------------------------------------------- #
# Tiện ích duyệt cây (duck typing)
# --------------------------------------------------------------------------- #

_rule_name_cache: Dict[type, str] = {}


def _is_terminal(node: Any) -> bool:
    return hasattr(node, "symbol")


def _is_error_node(node: Any) -> bool:
    return type(node).__name__ == "ErrorNodeImpl"


def _rule_name(node: Any) -> str:
    """MethodDeclarationContext -> 'methoddeclaration'."""
    if node is None:
        return ""
    cls = type(node)
    name = _rule_name_cache.get(cls)
    if name is None:
        name = cls.__name__
        if name.endswith("Context"):
            name = name[: -len("Context")]
        name = name.lower()
        _rule_name_cache[cls] = name
    return name


def _children(node: Any) -> List[Any]:
    kids = getattr(node, "children", None)
    return list(kids) if kids else []


def _start_line(node: Any) -> int:
    start = getattr(node, "start", None)
    return int(getattr(start, "line", 0) or 0)


# --------------------------------------------------------------------------- #
# Phân loại định danh / token
# --------------------------------------------------------------------------- #


def _identifier_role(node: Any) -> str:
    """Xác định vai trò của một IDENTIFIER: FUNC / CLASS / TYPE / PARAM / VAR."""
    parent = getattr(node, "parentCtx", None)
    pname = _rule_name(parent)
    if pname == "typeidentifier":
        return "TYPE"

    owner, oname = parent, pname
    if pname == "identifier":  # bóc lớp bọc để tìm luật thật sự sở hữu tên này
        owner = getattr(parent, "parentCtx", None)
        oname = _rule_name(owner)

    if oname in _FUNC_OWNERS:
        return "FUNC"
    if oname in _CLASS_OWNERS:
        return "CLASS"
    if oname in _TYPE_OWNERS:
        return "TYPE"
    if oname in _PARAM_OWNERS:
        return "PARAM"
    if oname == "variabledeclaratorid":
        grand = _rule_name(getattr(owner, "parentCtx", None))
        return "PARAM" if grand in _PARAM_DECLARATOR_PARENTS else "VAR"
    return "VAR"


def _terminal_token(node: Any) -> NormToken | None:
    """Đổi một lá của cây thành token chuẩn hóa (hoặc None nếu nên bỏ)."""
    sym = node.symbol
    text = sym.text
    if text is None or text == "<EOF>" or text in _DROP_PUNCT:
        return None
    line = int(getattr(sym, "line", 0) or 0)

    if _NUM_RE.match(text):
        return NormToken("NUM", line)
    if text[0] in "\"'":  # chuỗi, text block, ký tự
        return NormToken("STR", line)
    if text in ("true", "false"):
        return NormToken("BOOL", line)

    parent_name = _rule_name(getattr(node, "parentCtx", None))
    if parent_name in _IDENT_WRAPPERS:  # chắc chắn là tên do sinh viên đặt
        return NormToken(_identifier_role(node), line)
    if text in KEYWORDS or text in CONTEXTUAL_KEYWORDS:
        return NormToken(text, line)
    if _IDENT_RE.match(text):  # grammar cũ: IDENTIFIER nằm trực tiếp trong luật
        return NormToken(_identifier_role(node), line)

    return NormToken(text, line)  # toán tử: giữ nguyên


# --------------------------------------------------------------------------- #
# Duyệt cây
# --------------------------------------------------------------------------- #


def _emit(node: Any, out: List[NormToken], sort_members: bool) -> None:
    if _is_terminal(node):
        if _is_error_node(node):
            return
        tok = _terminal_token(node)
        if tok is not None:
            out.append(tok)
        return

    name = _rule_name(node)
    if name in _SKIP_RULES:
        return

    kids = _children(node)
    if len(kids) == 1:  # nút bọc chỉ có 1 con: không thêm thông tin -> đi thẳng xuống
        _emit(kids[0], out, sort_members)
        return

    out.append(NormToken(name, _start_line(node)))

    unit_rules = _SORT_CONTAINERS.get(name) if sort_members else None
    if not unit_rules:
        for child in kids:
            _emit(child, out, sort_members)
        return

    # Container: token của các thành viên độc lập được gom riêng rồi SẮP XẾP theo nội dung,
    # để đảo thứ tự hàm/field không đổi kết quả.
    units: List[List[NormToken]] = []
    for child in kids:
        if not _is_terminal(child) and _rule_name(child) in unit_rules:
            buf: List[NormToken] = []
            _emit(child, buf, sort_members)
            if buf:
                units.append(buf)
        else:
            _emit(child, out, sort_members)
    units.sort(key=lambda unit: tuple(t.value for t in unit))
    for unit in units:
        out.extend(unit)


def normalize_tree_with_lines(tree: Any, *, sort_members: bool = True) -> List[NormToken]:
    """Duyệt parse tree, trả về danh sách NormToken (giá trị + dòng nguồn).

    sort_members=False: giữ nguyên thứ tự thành viên (dùng khi cần so sánh thứ tự thật).
    Lưu ý: hàm đệ quy theo độ sâu cây; độ sâu này bị chặn bởi chính parser ANTLR
    (cũng đệ quy), nên với bài nộp sinh viên bình thường không gây tràn stack.
    """
    out: List[NormToken] = []
    _emit(tree, out, sort_members)
    return out


def normalize_tree(tree: Any, *, sort_members: bool = True) -> List[str]:
    """Như trên nhưng chỉ trả về chuỗi giá trị token (List[str]) — đầu vào của Winnowing."""
    return [t.value for t in normalize_tree_with_lines(tree, sort_members=sort_members)]
