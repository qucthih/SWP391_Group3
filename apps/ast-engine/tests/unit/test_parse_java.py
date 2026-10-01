"""Kiểm tra grammar Java parse được code thật (Java 8 -> 17) và báo lỗi khi code sai."""
from pathlib import Path

import pytest

from ast_engine.parsing import parse_java

FIXTURES = Path(__file__).parent.parent / "fixtures" / "java"


@pytest.mark.parametrize("name", ["AllInOne8.java", "RecordsTesting.java", "SwitchExpression.java"])
def test_parse_file_hop_le(name):
    result = parse_java((FIXTURES / name).read_text(encoding="utf-8"))
    assert result.ok, [f"{i.line}:{i.column} {i.message}" for i in result.issues[:3]]


def test_bai_sinh_vien_don_gian():
    code = """
    import java.util.*;
    public class Main {
        static int tong(int[] a) { int s = 0; for (int x : a) s += x; return s; }
        public static void main(String[] args) {
            var list = new ArrayList<Integer>();
            list.forEach(v -> System.out.println(v));
        }
    }"""
    assert parse_java(code).ok


def test_code_sai_cu_phap_phai_bao_loi():
    result = parse_java("public class A { void f( { } }")
    assert not result.ok and result.issues[0].line == 1
