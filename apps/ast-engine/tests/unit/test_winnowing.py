"""Test cho fingerprint/winnowing.py."""

import random

from ast_engine.fingerprint.winnowing import (
    Fingerprint,
    build_fingerprint,
    kgram_hashes,
    winnow,
)


def _naive_kgram_hashes(tokens, k):
    """Bản chậm để đối chiếu rolling hash: băm lại từng k-gram từ đầu."""
    from ast_engine.fingerprint import winnowing as w

    result = []
    for i in range(len(tokens) - k + 1):
        h = 0
        for t in tokens[i : i + k]:
            h = (h * w._BASE + w._token_hash(t)) % w._MOD
        result.append(h & w._MASK_52)
    return result


def test_kgram_count_va_rolling_khop_ban_chay_cham():
    tokens = [f"t{i % 7}" for i in range(60)]
    got = kgram_hashes(tokens, 5)
    assert len(got) == 60 - 5 + 1
    assert got == _naive_kgram_hashes(tokens, 5)


def test_chuoi_ngan_hon_k_khong_co_kgram():
    assert kgram_hashes(["a", "b"], 3) == []
    fp = build_fingerprint(["a", "b"], k=3, window=4)
    assert fp.entries == [] and fp.too_short


def test_hash_deterministic_va_vua_52_bit():
    tokens = ["for", "VAR", "NUM"] * 20
    a = kgram_hashes(tokens, 4)
    assert a == kgram_hashes(tokens, 4)
    assert all(0 <= h < (1 << 52) for h in a)


def test_winnow_lay_vi_tri_phai_nhat_khi_trung_hash():
    #            idx: 0  1  2  3  4  5
    hashes = [7, 3, 9, 3, 8, 5]
    # cửa sổ 5: [7,3,9,3,8] min=3 -> vị trí phải nhất = 3;  [3,9,3,8,5] min=3 -> vẫn 3
    assert winnow(hashes, 5) == [(3, 3)]


def test_winnow_khong_ghi_lai_cung_vi_tri():
    hashes = [1, 5, 6, 7, 8, 9]
    assert winnow(hashes, 3) == [(1, 0), (5, 1), (6, 2), (7, 3)]


def test_winnow_cua_so_lon_hon_so_hash():
    assert winnow([4, 2, 9], 10) == [(2, 1)]


def test_dam_bao_phat_hien_doan_chung_dai_w_cong_k_tru_1():
    """Tính chất cốt lõi: chung >= w + k - 1 token => chia sẻ >= 1 hash."""
    rng = random.Random(42)
    k, w = 5, 8
    vocab = [f"tok{i}" for i in range(500)]
    for _ in range(200):
        shared = [rng.choice(vocab) for _ in range(w + k - 1)]
        a = [rng.choice(vocab) for _ in range(rng.randint(0, 30))] + shared + \
            [rng.choice(vocab) for _ in range(rng.randint(0, 30))]
        b = [rng.choice(vocab) for _ in range(rng.randint(0, 30))] + shared + \
            [rng.choice(vocab) for _ in range(rng.randint(0, 30))]
        fa = build_fingerprint(a, k=k, window=w)
        fb = build_fingerprint(b, k=k, window=w)
        assert fa.hash_set & fb.hash_set


def test_hai_chuoi_khac_han_khong_trung():
    a = build_fingerprint([f"a{i}" for i in range(200)], k=5, window=8)
    b = build_fingerprint([f"b{i}" for i in range(200)], k=5, window=8)
    assert not (a.hash_set & b.hash_set)


def test_to_dict_from_dict_khu_hoi():
    fp = build_fingerprint([f"x{i % 11}" for i in range(120)], list(range(120)), k=5, window=8)
    assert Fingerprint.from_dict(fp.to_dict()) == fp
