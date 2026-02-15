#!/usr/bin/env python3
"""Detailed pattern analysis for the internal_matrix constant-multiply block."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def extract_cycles(edsl_text: str) -> list[tuple[int, list[str]]]:
    lines = edsl_text.splitlines()
    cycles: list[tuple[int, list[str]]] = []
    i = 0
    while i < len(lines):
        if re.match(r"^\s*cycle\s*\{", lines[i]):
            start_line = i + 1
            block: list[str] = []
            i += 1
            while i < len(lines) and not re.match(r"^\s*\}", lines[i]):
                block.append(lines[i].strip())
                i += 1
            cycles.append((start_line, block))
        i += 1
    return cycles


def classify_cycle(block: list[str]) -> str:
    text = " ".join(block)
    # Priority order matters
    if "SADD R2, R2, R2" in text:
        return "double_r2"
    if "SSUB R0, R2, R3" in text:
        return "reduce_r2_ssub"
    if "BSFA R2, R2, R0, SELF" in text:
        return "reduce_r2_bsfa"
    if "SSUB R0, R1, R3" in text:
        return "reduce_r1_ssub"
    if "BSFA R1, R1, R0, SELF" in text:
        return "reduce_r1_bsfa"
    if "SADD R1, R1, R2" in text:
        return "masked_add_r1_plus_r2"
    return "other"


def masked_add_density(block: list[str]) -> tuple[int, int]:
    total = 0
    active = 0
    for line in block:
        if "|" not in line:
            continue
        rhs = line.split(":", 1)[1] if ":" in line else line
        cells = [c.strip().rstrip(";") for c in rhs.split("|")]
        for cell in cells:
            if not cell:
                continue
            total += 1
            if "SADD R1, R1, R2" in cell:
                active += 1
    return active, total


def slot_level_counts(blocks: list[list[str]]) -> dict[str, int]:
    counts: dict[str, int] = {
        "masked_add_slots": 0,
        "double_slots": 0,
        "reduce_r1_ssub_slots": 0,
        "reduce_r1_bsfa_slots": 0,
        "reduce_r2_ssub_slots": 0,
        "reduce_r2_bsfa_slots": 0,
        "nop_slots": 0,
        "other_slots": 0,
        "total_slots": 0,
    }
    for block in blocks:
        for line in block:
            if "|" not in line:
                continue
            rhs = line.split(":", 1)[1] if ":" in line else line
            cells = [c.strip().rstrip(";") for c in rhs.split("|")]
            for cell in cells:
                if not cell:
                    continue
                counts["total_slots"] += 1
                if cell == "NOP":
                    counts["nop_slots"] += 1
                elif "SADD R1, R1, R2" in cell:
                    counts["masked_add_slots"] += 1
                elif "SADD R2, R2, R2" in cell:
                    counts["double_slots"] += 1
                elif "SSUB R0, R1, R3" in cell:
                    counts["reduce_r1_ssub_slots"] += 1
                elif "BSFA R1, R1, R0, SELF" in cell:
                    counts["reduce_r1_bsfa_slots"] += 1
                elif "SSUB R0, R2, R3" in cell:
                    counts["reduce_r2_ssub_slots"] += 1
                elif "BSFA R2, R2, R0, SELF" in cell:
                    counts["reduce_r2_bsfa_slots"] += 1
                else:
                    counts["other_slots"] += 1
    return counts


def slice_by_markers(
    text: str,
    start_marker: str | None,
    end_marker: str | None,
) -> tuple[str, int]:
    start_idx = 0
    if start_marker:
        pos = text.find(start_marker)
        if pos >= 0:
            start_idx = pos
    end_idx = len(text)
    if end_marker:
        pos = text.find(end_marker, start_idx if start_idx else 0)
        if pos >= 0:
            end_idx = pos
    return text[start_idx:end_idx], start_idx


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Analyze constant multiply schedule structure")
    parser.add_argument(
        "--edsl",
        default="poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_god_tier.edsl",
        help="EDSL kernel path",
    )
    parser.add_argument(
        "--start-marker",
        default="Full constant-multiply schedule",
        help="Substring marker where multiplier section starts",
    )
    parser.add_argument(
        "--end-marker",
        default="5. ESCRITURA EN PARALELO",
        help="Substring marker where multiplier section ends",
    )
    args = parser.parse_args()

    edsl_path = (ROOT / args.edsl).resolve()
    full_text = edsl_path.read_text()
    scoped_text, start_char = slice_by_markers(full_text, args.start_marker, args.end_marker)
    cycles = extract_cycles(scoped_text)
    if not cycles:
        print("No cycles found in selected section.")
        return 0

    sub = [c for _, c in cycles]
    sub_labels = [classify_cycle(c) for c in sub]

    counts: dict[str, int] = {}
    for l in sub_labels:
        counts[l] = counts.get(l, 0) + 1

    masked_cycles = [sub[i] for i, l in enumerate(sub_labels) if l == "masked_add_r1_plus_r2"]
    active_slots = 0
    total_slots = 0
    for b in masked_cycles:
        a, t = masked_add_density(b)
        active_slots += a
        total_slots += t

    avg_mask_density = (active_slots / total_slots * 100.0) if total_slots else 0.0
    slots = slot_level_counts(sub)
    active_non_nop = slots["total_slots"] - slots["nop_slots"]
    util = (active_non_nop / slots["total_slots"] * 100.0) if slots["total_slots"] else 0.0

    print("=== const-multiply schedule analysis ===")
    print(f"edsl: {edsl_path}")
    print(f"section marker start char offset: {start_char}")
    print(f"cycles in selected section: {len(sub)}")
    print("pattern counts:")
    for k in [
        "masked_add_r1_plus_r2",
        "reduce_r1_ssub",
        "reduce_r1_bsfa",
        "double_r2",
        "reduce_r2_ssub",
        "reduce_r2_bsfa",
        "other",
    ]:
        if k in counts:
            print(f"  {k}: {counts[k]}")
    print(f"masked-add density: {active_slots}/{total_slots} slots ({avg_mask_density:.2f}%)")
    print("slot-level counts:")
    for k in [
        "masked_add_slots",
        "double_slots",
        "reduce_r1_ssub_slots",
        "reduce_r1_bsfa_slots",
        "reduce_r2_ssub_slots",
        "reduce_r2_bsfa_slots",
        "nop_slots",
        "other_slots",
    ]:
        print(f"  {k}: {slots[k]}")
    print(f"  active utilization in section: {active_non_nop}/{slots['total_slots']} ({util:.2f}%)")

    # Heuristic lower bound from observed structural counts:
    # If every masked_add and every double requires paired reduce cycles, this is near-min.
    lb_from_structure = (
        counts.get("masked_add_r1_plus_r2", 0)
        + counts.get("reduce_r1_ssub", 0)
        + counts.get("reduce_r1_bsfa", 0)
        + counts.get("double_r2", 0)
        + counts.get("reduce_r2_ssub", 0)
        + counts.get("reduce_r2_bsfa", 0)
    )
    print(f"structural floor (current model): {lb_from_structure} cycles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
