"""
Bước 1 của Phân hệ 4: nhận mã nguồn Java -> trả về parse tree + danh sách lỗi cú pháp.

Khái niệm cần nhớ:
  - Lexer  : cắt chuỗi ký tự thành các token (từ khóa, tên, số, dấu...).
  - Parser : ghép token thành cây theo luật ngữ pháp trong JavaParser.g4.
  - Cây ANTLR là "concrete syntax tree" (giữ cả dấu ; ( ) ...). Ở bước chuẩn hóa sau này
    ta sẽ bỏ tên biến/hàm, comment... để chỉ giữ lại CẤU TRÚC.
"""
from dataclasses import dataclass, field
from typing import List

from antlr4 import CommonTokenStream, InputStream
from antlr4.error.ErrorListener import ErrorListener

from .java_parser.JavaLexer import JavaLexer
from .java_parser.JavaParser import JavaParser


@dataclass
class SyntaxIssue:
    line: int
    column: int
    message: str


class _CollectingErrorListener(ErrorListener):
    """Gom lỗi thay vì in ra console (mặc định ANTLR chỉ in stderr)."""

    def __init__(self):
        super().__init__()
        self.issues: List[SyntaxIssue] = []

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        self.issues.append(SyntaxIssue(line, column, msg))


@dataclass
class ParseResult:
    tree: object                      # CompilationunitContext (gốc của cây)
    parser: JavaParser
    token_stream: CommonTokenStream
    issues: List[SyntaxIssue] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues


def parse_java(source: str) -> ParseResult:
    """Parse 1 file Java. Không ném exception: lỗi cú pháp nằm trong `result.issues`."""
    listener = _CollectingErrorListener()

    lexer = JavaLexer(InputStream(source))
    lexer.removeErrorListeners()
    lexer.addErrorListener(listener)

    stream = CommonTokenStream(lexer)
    parser = JavaParser(stream)
    parser.removeErrorListeners()
    parser.addErrorListener(listener)

    tree = parser.compilationunit()          # luật gốc (grammar chính thức đặt tên viết thường)
    return ParseResult(tree, parser, stream, listener.issues)


def dump_rules(result: ParseResult, max_depth: int = 6) -> str:
    """In cây dạng thụt lề (chỉ tên luật) — dùng để kiểm tra bằng mắt."""
    from antlr4.tree.Tree import TerminalNode

    names = result.parser.ruleNames
    lines: List[str] = []

    def walk(node, depth):
        if depth > max_depth:
            return
        if isinstance(node, TerminalNode):
            return
        lines.append("  " * depth + names[node.getRuleIndex()])
        for i in range(node.getChildCount()):
            walk(node.getChild(i), depth + 1)

    walk(result.tree, 0)
    return "\n".join(lines)
