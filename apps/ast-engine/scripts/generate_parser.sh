#!/usr/bin/env bash
# Sinh lại lexer/parser Python từ grammar Java bằng ANTLR CHÍNH THỨC 4.13.2.
# Yêu cầu: Java 11+ và `pip install antlr4-tools antlr4-python3-runtime==4.13.2`
# Trên Windows hãy chạy bằng Git Bash hoặc WSL.
# KHÔNG ghi đè JavaParserBase.py (file viết tay) — script này chỉ sinh các file còn lại.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=src/ast_engine/parsing/java_parser
antlr4 -v 4.13.2 -Dlanguage=Python3 -visitor -o "$OUT" grammar/JavaLexer.g4 grammar/JavaParser.g4
git checkout -- "$OUT/JavaParserBase.py" 2>/dev/null || true
echo "Đã sinh parser. Chạy: pnpm --filter @swp391/ast-engine test"
