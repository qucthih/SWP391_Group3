"""
JavaParserBase (Python) — port từ Java/JavaParserBase.java của antlr/grammars-v4.

Vì sao cần file này?
  Grammar Java hiện đại (java/java trong grammars-v4) khai báo `superClass = JavaParserBase`
  và dùng 2 semantic predicate trong JavaParser.g4:
      - self.IsNotIdentifierAssign()
      - self.DoLastRecordComponent()
  Repo chính thức đã bỏ target Python3, nên ta tự viết lại 2 hàm này.
"""
from antlr4 import Parser, TokenStream

# Các từ khóa "ngữ cảnh" (contextual keywords) vẫn có thể được dùng làm tên biến
_CONTEXTUAL_TOKENS = (
    "IDENTIFIER", "MODULE", "OPEN", "REQUIRES", "EXPORTS", "OPENS", "TO", "USES",
    "PROVIDES", "WHEN", "WITH", "TRANSITIVE", "YIELD", "SEALED", "PERMITS", "RECORD", "VAR",
)


class JavaParserBase(Parser):
    def __init__(self, input: TokenStream, output=None):
        super().__init__(input, output) if output is not None else super().__init__(input)

    def DoLastRecordComponent(self) -> bool:
        """Chỉ component CUỐI của record mới được phép có '...' (varargs)."""
        ctx = self._ctx
        if type(ctx).__name__ != "RecordComponentListContext":
            return True
        components = ctx.recordComponent()
        if not components:
            return True
        last = len(components) - 1
        for i, rc in enumerate(components):
            if rc.ELLIPSIS() is not None and i < last:
                return False
        return True

    def IsNotIdentifierAssign(self) -> bool:
        """
        Trả về False nếu 2 token tiếp theo có dạng `identifier = ...`
        (để phân biệt annotation `@A(x = 1)` với `@A(1)`).
        """
        la1 = self._input.LA(1)
        allowed = {getattr(self, name) for name in _CONTEXTUAL_TOKENS}
        if la1 not in allowed:
            return True
        return self._input.LA(2) != self.ASSIGN
