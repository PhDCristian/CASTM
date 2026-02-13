# Kernel Compaction Patterns

This page shows how to replace repetitive spatial boilerplate with canonical compact statements while keeping deterministic output.

## 1) Verbose Pattern (manual placements)

```text
function extract_bytes_row(src, dst) {
  cycle {
    @0,0: SRT dst, src, 0;   @0,1: SRT dst, src, 0;   @0,2: SRT dst, src, 0;   @0,3: SRT dst, src, 0;
    @1,0: SRT dst, src, 8;   @1,1: SRT dst, src, 8;   @1,2: SRT dst, src, 8;   @1,3: SRT dst, src, 8;
    @2,0: SRT dst, src, 16;  @2,1: SRT dst, src, 16;  @2,2: SRT dst, src, 16;  @2,3: SRT dst, src, 16;
    @3,0: SRT dst, src, 24;  @3,1: SRT dst, src, 24;  @3,2: SRT dst, src, 24;  @3,3: SRT dst, src, 24;
  }
  cycle {
    @0,0: LAND dst, dst, 255; @0,1: LAND dst, dst, 255; @0,2: LAND dst, dst, 255; @0,3: LAND dst, dst, 255;
    @1,0: LAND dst, dst, 255; @1,1: LAND dst, dst, 255; @1,2: LAND dst, dst, 255; @1,3: LAND dst, dst, 255;
    @2,0: LAND dst, dst, 255; @2,1: LAND dst, dst, 255; @2,2: LAND dst, dst, 255; @2,3: LAND dst, dst, 255;
    @3,0: LAND dst, dst, 255; @3,1: LAND dst, dst, 255; @3,2: LAND dst, dst, 255; @3,3: LAND dst, dst, 255;
  }
}
```

## 2) Canonical Compact Form (`std::extract_bytes`)

```openedge
target "uma-cgra-base";

function extract_bytes_row(valueSrc, valueDst) {
  std::extract_bytes(src=valueSrc, dest=valueDst, axis=row, byteWidth=8, mask=255);
}

kernel "compact_extract" {
  extract_bytes_row(R0, R1);
}
```

## 3) Equivalent Explicit Form with `for` Inside `cycle`

```openedge
target "uma-cgra-base";
kernel "explicit_extract" {
  cycle {
    for k in range(0, 16) {
      at @k/4,k%4: SRT R1, R0, (k/4)*8;
    }
  }
  cycle {
    for k in range(0, 16) {
      at @k/4,k%4: LAND R1, R1, 255;
    }
  }
}
```

Both canonical forms compile to the same effective two-cycle extraction pattern.

## 4) Representative `sim-matrix-csv`

```csv
0,,,
"SRT R1, R0, 0","SRT R1, R0, 0","SRT R1, R0, 0","SRT R1, R0, 0"
"SRT R1, R0, 8","SRT R1, R0, 8","SRT R1, R0, 8","SRT R1, R0, 8"
"SRT R1, R0, 16","SRT R1, R0, 16","SRT R1, R0, 16","SRT R1, R0, 16"
"SRT R1, R0, 24","SRT R1, R0, 24","SRT R1, R0, 24","SRT R1, R0, 24"
1,,,
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
"LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255","LAND R1, R1, 255"
```

## 5) Practical Rule

- Prefer `std::extract_bytes(...)` for byte-lane extraction.
- Use explicit `for` + coordinate expressions when you need custom placement geometry beyond the built-in contract.
- Keep `std::` statements for canonical style and stable docs.

## 6) One-Line Full-Grid Loads

You do not need a dedicated `parallel` pragma for this pattern.

```openedge
target "uma-cgra-base";

function load_all(reg, addr) {
  cycle {
    at all: LWI reg, addr;
  }
}

kernel "load_all_demo" {
  load_all(R0, 360);
}
```

That expands to one placement per PE in the same cycle.

## 7) Compact `compute_qhat_inregs` Pattern

This is the compact canonical rewrite of the repeated preload block:

```openedge
target "uma-cgra-base";
let L = { 10, 20, 30, 40, 50, 60 };

function compute_qhat_inregs() {
  cycle {
    for c in range(0, 4) {
      at @0..2,c: R0 = L[c+1];
    }
  }
}

kernel "qhat_demo" {
  compute_qhat_inregs();
}
```

Benefits:

- same single-cycle behavior as the explicit 12-placement form,
- drastically fewer lines,
- explicit deterministic mapping remains visible (`row range + column index`).

## 8) SBOX K7 v10 Snapshot (Measured)

Current optimized v10 kernels in `UMA-CGRA-Simulator`:

- `examples/dsl_port/sbox_k7_v10_compact.edsl`
- `examples/dsl_port/sbox_k7_v10_nocompact.edsl`

Measured cycle budget (2026-02-13):

- `safe`: **205**
- `balanced`: **205**
- `aggressive`: **205**

Reproduction:

```bash
npx tsx scripts/sbox/stats.ts --file ./examples/dsl_port/sbox_k7_v10_compact.edsl --scheduler safe
npx tsx scripts/sbox/stats.ts --file ./examples/dsl_port/sbox_k7_v10_nocompact.edsl --scheduler safe
```

Hotspot and differential profiling:

```bash
npx tsx scripts/sbox/profile-hotspots.ts --file ./examples/dsl_port/sbox_k7_v10_compact.edsl --scheduler safe
npx tsx scripts/sbox/profile-deltas.ts --file ./examples/dsl_port/sbox_k7_v10_compact.edsl --scheduler safe
```
