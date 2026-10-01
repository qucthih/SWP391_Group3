"""Tiện ích dùng chung cho test: đọc fixture và lấy parse tree qua analyzer._run_parser."""
from pathlib import Path

from ast_engine.analyzer import _run_parser

FIXTURES = Path(__file__).parent / "fixtures" / "plagiarism"


def read_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def get_tree(source: str):
    tree, errors = _run_parser(source)
    assert errors == 0, f"Mã nguồn test có lỗi cú pháp: {errors}"
    return tree
