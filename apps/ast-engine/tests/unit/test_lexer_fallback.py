"""Test cho normalization/lexer_fallback.py."""

from ast_engine.normalization.lexer_fallback import normalize_lexical, tokenize_fallback


def test_ten_thanh_ID_literal_gop_comment_bo():
    toks = normalize_lexical('int total = 5; // ghi chu\n String s = "abc"; /* x */')
    assert toks == ["int", "ID", "=", "NUM", "ID", "ID", "=", "STR"]


def test_doi_ten_khong_doi_ket_qua():
    assert normalize_lexical("int a = b + 1;") == normalize_lexical("int zz = qq + 77;")


def test_chuoi_chua_dau_comment_khong_bi_nham():
    assert normalize_lexical('String u = "http://x.y/*z*/";') == ["ID", "ID", "=", "STR"]


def test_text_block_va_char():
    assert normalize_lexical("var t = \"\"\"\nhello // no\n\"\"\"; char c = 'x';") == \
           ["var", "ID", "=", "STR", "char", "ID", "=", "STR"]


def test_import_package_bi_bo():
    assert normalize_lexical("package a.b;\nimport java.util.*;\nclass X { }") == ["class", "ID"]


def test_khong_bao_gio_nem_loi_voi_rac():
    junk = "int x = ;;; @@@ {{{ \u200b\u2603 \"chua dong\n /* chua dong"
    assert isinstance(normalize_lexical(junk), list)


def test_so_thuc_va_he_16():
    assert normalize_lexical("x = 3.14f + 0xFF + 1e-5 + 100L;") == ["ID", "=", "NUM", "+", "NUM", "+", "NUM", "+", "NUM"]


def test_toan_tu_nhieu_ky_tu():
    assert normalize_lexical("a >>>= 2; b -> c; d :: e; f && g;") == \
           ["ID", ">>>=", "NUM", "ID", "->", "ID", "ID", "::", "ID", "ID", "&&", "ID"]


def test_so_dong():
    toks = tokenize_fallback("int a;\n\n/* c1\nc2 */\nint b;")
    assert [t.line for t in toks] == [1, 1, 5, 5]
