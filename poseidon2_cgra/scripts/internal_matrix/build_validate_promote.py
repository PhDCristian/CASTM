#!/usr/bin/env python3
"""Build + validate + optional promote flow for internal_matrix candidate CSV.

This script is intentionally conservative:
1) Builds candidate CSV from OpenEdgeDSL.
2) Validates candidate against Python oracle (fixed + random vectors).
3) Promotes candidate to instructions.csv only on PASS and only if --promote is set.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def build_pythonpath(root: Path) -> str:
    """Assemble PYTHONPATH needed by poseidon2_cgra driver imports."""
    parts: list[str] = []
    existing = os.environ.get("PYTHONPATH", "")
    if existing:
        parts.extend([p for p in existing.split(os.pathsep) if p])

    # OpenEdgeDSL repo root
    parts.append(str(root))

    # External simulator paths (auto-discovered from workspace layout)
    zkp_root = root.parents[2]  # .../ZKP
    esl_root = zkp_root / "ESL-CGRA-simulator"
    for extra in (esl_root / "src", esl_root / "examples" / "sbox_barrett"):
        if extra.exists():
            parts.append(str(extra))

    # Preserve order, remove duplicates
    dedup: list[str] = []
    seen: set[str] = set()
    for p in parts:
        if p not in seen:
            seen.add(p)
            dedup.append(p)
    return os.pathsep.join(dedup)


def run_step(cmd: list[str], cwd: Path, env: dict[str, str]) -> int:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, env=env).returncode


def main() -> int:
    root = Path(__file__).resolve().parents[3]
    scripts_dir = root / "poseidon2_cgra" / "scripts" / "internal_matrix"
    kernel_dir = root / "poseidon2_cgra" / "kernels" / "linear" / "internal_matrix"

    parser = argparse.ArgumentParser(description="Build/validate/promote internal_matrix CSV candidate")
    parser.add_argument(
        "--edsl",
        default="poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_async.edsl",
        help="Input OpenEdgeDSL file"
    )
    parser.add_argument(
        "--candidate",
        default="poseidon2_cgra/kernels/linear/internal_matrix/instructions_openedge_candidate.csv",
        help="Candidate CSV path"
    )
    parser.add_argument("--format", default="sim-matrix-csv", choices=["sim-matrix-csv", "flat-csv"])
    parser.add_argument("--random", type=int, default=1000, help="Random oracle vectors")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Promote candidate to kernels/linear/internal_matrix/instructions.csv on PASS"
    )
    args = parser.parse_args()

    env = os.environ.copy()
    env["PYTHONPATH"] = build_pythonpath(root)

    build_cmd = [
        sys.executable,
        str(scripts_dir / "build_from_edsl.py"),
        "--edsl",
        args.edsl,
        "--out",
        args.candidate,
        "--format",
        args.format
    ]
    if run_step(build_cmd, root, env) != 0:
        print("Build failed.")
        return 1

    validate_cmd = [
        sys.executable,
        str(scripts_dir / "validate_oracles.py"),
        "--candidate",
        args.candidate,
        "--random",
        str(args.random),
        "--seed",
        str(args.seed)
    ]
    validation_rc = run_step(validate_cmd, root, env)
    if validation_rc != 0:
        print("Validation failed; baseline instructions.csv kept unchanged.")
        return 1

    if not args.promote:
        print("Validation PASS. Candidate kept (no promotion requested).")
        return 0

    candidate_path = (root / args.candidate).resolve()
    target_path = kernel_dir / "instructions.csv"
    shutil.copy2(candidate_path, target_path)
    print(f"Validation PASS. Promoted candidate to {target_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
