#!/usr/bin/env python3
"""Compile internal_matrix OpenEdgeDSL source into CSV via compiler-api.

Usage:
  python3 poseidon2_cgra/scripts/internal_matrix/build_from_edsl.py
  python3 poseidon2_cgra/scripts/internal_matrix/build_from_edsl.py --edsl <path> --out <path>
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[3]
    script = root / "poseidon2_cgra" / "scripts" / "internal_matrix" / "build_from_edsl.ts"

    parser = argparse.ArgumentParser(description="Build internal_matrix CSV from OpenEdgeDSL source")
    parser.add_argument(
        "--edsl",
        default="poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_async.edsl",
        help="Input .edsl file"
    )
    parser.add_argument(
        "--out",
        default="poseidon2_cgra/kernels/linear/internal_matrix/instructions_openedge_candidate.csv",
        help="Output CSV file"
    )
    parser.add_argument(
        "--format",
        default="sim-matrix-csv",
        choices=["sim-matrix-csv", "flat-csv"],
        help="Output CSV format"
    )
    args = parser.parse_args()

    cmd = [
        "npx",
        "tsx",
        str(script),
        "--edsl",
        args.edsl,
        "--out",
        args.out,
        "--format",
        args.format,
    ]

    proc = subprocess.run(cmd, cwd=root)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
