#!/usr/bin/env python3
"""Hotspot profiler for Poseidon2 internal_matrix kernels.

Reports:
1) Static cycle counts by EDSL comment section.
2) Dynamic utilization/opcode profile from sim-matrix-csv.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def parse_edsl_sections(edsl_path: Path) -> tuple[int, dict[str, int]]:
    cycle_re = re.compile(r"^\s*cycle\s*\{")
    comment_re = re.compile(r"^\s*//\s*(.+?)\s*$")
    separator_re = re.compile(r"^[=\-\s]+$")

    current = "unlabeled"
    total = 0
    section_cycles: dict[str, int] = defaultdict(int)

    for raw in edsl_path.read_text().splitlines():
        cm = comment_re.match(raw)
        if cm:
            text = cm.group(1).strip()
            if text and not separator_re.match(text):
                current = text
            continue
        if cycle_re.match(raw):
            total += 1
            section_cycles[current] += 1

    return total, dict(section_cycles)


def normalize_cell(cell: str) -> str:
    return cell.strip().strip('"').strip()


def parse_opcode(instr: str) -> str:
    token = instr.split()[0] if instr else ""
    token = token.strip().strip(",")
    return token


def parse_sim_matrix_csv(csv_path: Path) -> tuple[int, list[int], Counter[str]]:
    rows = list(csv.reader(csv_path.read_text().splitlines()))
    i = 0
    cycle_count = 0
    active_slots_per_cycle: list[int] = []
    opcodes: Counter[str] = Counter()

    while i < len(rows):
        row = rows[i]
        first = row[0].strip() if row else ""
        if first.isdigit():
            cycle_count += 1
            active = 0
            for r in range(i + 1, min(i + 5, len(rows))):
                cells = rows[r]
                for c in range(min(4, len(cells))):
                    instr = normalize_cell(cells[c])
                    if not instr:
                        continue
                    opcode = parse_opcode(instr)
                    if opcode:
                        opcodes[opcode] += 1
                    if opcode and opcode != "NOP":
                        active += 1
            active_slots_per_cycle.append(active)
            i += 5
        else:
            i += 1

    return cycle_count, active_slots_per_cycle, opcodes


def format_top_sections(section_cycles: dict[str, int], top: int) -> list[str]:
    items = sorted(section_cycles.items(), key=lambda x: x[1], reverse=True)[:top]
    return [f"{name}: {count} cycles" for name, count in items]


def low_utilization_runs(active_slots: list[int], threshold: int = 2) -> list[tuple[int, int, int]]:
    runs: list[tuple[int, int, int]] = []
    start = None
    for idx, active in enumerate(active_slots):
        if active <= threshold:
            if start is None:
                start = idx
        else:
            if start is not None:
                runs.append((start, idx - 1, idx - start))
                start = None
    if start is not None:
        runs.append((start, len(active_slots) - 1, len(active_slots) - start))
    runs.sort(key=lambda x: x[2], reverse=True)
    return runs


def main() -> int:
    parser = argparse.ArgumentParser(description="Profile internal_matrix hotspots")
    parser.add_argument(
        "--edsl",
        default="poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_god_tier.edsl",
        help="EDSL source path (for static section cycle counts)",
    )
    parser.add_argument(
        "--csv",
        default="poseidon2_cgra/kernels/linear/internal_matrix/instructions_god_tier.csv",
        help="sim-matrix-csv path (for dynamic profile)",
    )
    parser.add_argument("--top", type=int, default=12, help="Top N sections/opcodes")
    args = parser.parse_args()

    edsl_path = (ROOT / args.edsl).resolve()
    csv_path = (ROOT / args.csv).resolve()

    if not edsl_path.exists():
        raise FileNotFoundError(f"EDSL not found: {edsl_path}")
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    static_total, section_cycles = parse_edsl_sections(edsl_path)
    cycle_count, active_slots, opcodes = parse_sim_matrix_csv(csv_path)

    avg_active = (sum(active_slots) / len(active_slots)) if active_slots else 0.0
    utilization = (avg_active / 16.0) * 100.0
    low_runs = low_utilization_runs(active_slots, threshold=2)[:8]

    print("=== internal_matrix hotspot profile ===")
    print(f"edsl: {edsl_path}")
    print(f"csv:  {csv_path}")
    print(f"static cycles (edsl): {static_total}")
    print(f"dynamic cycles (csv): {cycle_count}")
    print(f"avg active slots/cycle: {avg_active:.2f}/16 ({utilization:.2f}%)")

    print("\n-- top sections by static cycle count --")
    for line in format_top_sections(section_cycles, args.top):
        print(line)

    print("\n-- top opcodes by dynamic slot usage --")
    for opcode, count in opcodes.most_common(args.top):
        print(f"{opcode}: {count}")

    print("\n-- longest low-utilization runs (active <= 2 slots) --")
    if not low_runs:
        print("none")
    else:
        for s, e, l in low_runs:
            print(f"cycles {s}..{e} (len={l})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
