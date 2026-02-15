#!/usr/bin/env python3
"""Analyze theoretical lower bound for bit-serial constant multiply schedule.

For constants c_i and shared multiplicand x:
  acc_i = (c_i * x) mod p
using bit-serial double-and-add with canonical reduction after each add/double.
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
C_IMPL = ROOT / "poseidon2_C" / "c_implementation" / "poseidon2_babybear.c"


def parse_diag_constants(path: Path) -> list[int]:
    text = path.read_text()
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"//.*?$", "", text, flags=re.M)
    m = re.search(r"MAT_DIAG16_M_1\s*\[16\]\s*=\s*\{([^}]+)\}", text, re.S)
    if not m:
        raise RuntimeError("MAT_DIAG16_M_1 not found")
    vals = [int(x, 16) for x in re.findall(r"0x[0-9a-fA-F]+", m.group(1))]
    if len(vals) != 16:
        raise RuntimeError(f"expected 16 constants, got {len(vals)}")
    return vals


def main() -> int:
    vals = parse_diag_constants(C_IMPL)
    max_bits = max(v.bit_length() for v in vals)
    bit_coverage = []
    for b in range(max_bits):
        ones = sum((v >> b) & 1 for v in vals)
        bit_coverage.append(ones)
    active_bits = sum(1 for ones in bit_coverage if ones > 0)

    # Lower bound for bit-serial + per-step canonical modular reduction:
    # - active bit: at least 1 add cycle + 2 reduction cycles => 3
    # - bit advance (except after last processed bit): at least 1 double + 2 reduction => 3
    lb_add_reduce = 3 * active_bits
    lb_double_reduce = 3 * (max_bits - 1)
    lower_bound = lb_add_reduce + lb_double_reduce

    print("=== const-multiply lower-bound analysis ===")
    print(f"constants: {len(vals)}")
    print(f"max bit-length: {max_bits}")
    print(f"active bit positions (union over lanes): {active_bits}")
    print(f"LB add+reduce: {lb_add_reduce} cycles")
    print(f"LB double+reduce: {lb_double_reduce} cycles")
    print(f"TOTAL lower bound (bit-serial model): {lower_bound} cycles")
    print()
    print("bit coverage (bit -> lanes with '1'):")
    for b, ones in enumerate(bit_coverage):
        print(f"  b{b:02d}: {ones}/16 lanes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
