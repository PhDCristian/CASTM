# Internal Matrix Hotspots (Cycle-First)

Date: 2026-02-15

## Scope

Profiling and optimization for:

- `/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL/poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_opt.edsl`
- `/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL/poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_golden.edsl`
- `/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL/poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_god_tier.edsl`

## Repro Commands

```bash
cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL

# Build
python3 poseidon2_cgra/scripts/internal_matrix/build_from_edsl.py \
  --edsl poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_opt.edsl \
  --out /tmp/internal_matrix_opt_rebuilt.csv --format sim-matrix-csv

python3 poseidon2_cgra/scripts/internal_matrix/build_from_edsl.py \
  --edsl poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_golden.edsl \
  --out poseidon2_cgra/kernels/linear/internal_matrix/instructions_golden.csv --format sim-matrix-csv

python3 poseidon2_cgra/scripts/internal_matrix/build_from_edsl.py \
  --edsl poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_god_tier.edsl \
  --out poseidon2_cgra/kernels/linear/internal_matrix/instructions_god_tier.csv --format sim-matrix-csv

# Oracle validation (requires simulator + sbox_barrett generator on PYTHONPATH)
PYTHONPATH=.:/Users/ccampos/UMA/ZKP/ESL-CGRA-simulator/src:/Users/ccampos/UMA/ZKP/ESL-CGRA-simulator/examples/sbox_barrett \
python3 poseidon2_cgra/scripts/internal_matrix/validate_oracles.py \
  --candidate poseidon2_cgra/kernels/linear/internal_matrix/instructions_god_tier.csv \
  --random 10000 --seed 42

# Hotspots
python3 poseidon2_cgra/scripts/internal_matrix/profile_hotspots.py \
  --edsl poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_god_tier.edsl \
  --csv poseidon2_cgra/kernels/linear/internal_matrix/instructions_god_tier.csv --top 20

# Theoretical lower bound (bit-serial model)
python3 poseidon2_cgra/scripts/internal_matrix/analyze_constmul_bound.py
```

## Results

| Kernel | Cycles | Oracle |
|---|---:|---|
| `internal_matrix_opt` | 255 | PASS (baseline reference) |
| `internal_matrix_golden` | 217 | PASS (12 + 10000 random) |
| `internal_matrix_god_tier` | 212 | PASS (12 + 10000 random) |
| `internal_matrix_async` | 182 | PASS (12 + 10000 random) |

Net improvement baseline -> async: **-73 cycles**.

Principal kernel switch:

- Active default CSV (`instructions.csv`) now points to async candidate (`instructions_async.csv` content).
- Baseline snapshot kept as:
  - `/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL/poseidon2_cgra/kernels/linear/internal_matrix/instructions_baseline_255.csv`

## Hotspot Breakdown (`god_tier`)

From `profile_hotspots.py`:

- Total cycles: 212
- Average active slots: 13.27/16 (82.96%)
- Top section:
  - `Full constant-multiply schedule (baseline-correct)`: **185 cycles**
- Top opcodes:
  - `SSUB`: 991
  - `BSFA`: 991
  - `SADD`: 722

Interpretation:

- The primary bottleneck is the per-lane constant modular multiplication schedule.
- Remaining sections (global sum reduction + staging) are secondary.

## Deep Structural Analysis of Constant-Multiply Block

Using:

```bash
python3 poseidon2_cgra/scripts/internal_matrix/analyze_constmul_schedule.py \
  --edsl poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_god_tier.edsl
```

Observed for `god_tier` multiplier section:

- Section cycles: **185**
- Pattern counts:
  - `masked_add_r1_plus_r2`: 31
  - `reduce_r1_ssub`: 31
  - `reduce_r1_bsfa`: 31
  - `double_r2`: 30
  - `reduce_r2_ssub`: 30
  - `reduce_r2_bsfa`: 30
  - `other`: 2
- Masked add density: **227 / 496 slots = 45.77%**
- Structural floor from observed pattern counts: **183 cycles**

Implication:

- In the current bit-serial + per-step canonical reduction model, the 185-cycle block is only ~2 cycles above structural floor.
- This explains why local edits (NOP cleanup / minor reorders) stop yielding meaningful gains.

## Async-Lane Schedule (Implemented)

A new candidate was generated:

- `/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL/poseidon2_cgra/kernels/linear/internal_matrix/internal_matrix_async.edsl`
- `/Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/OpenEdgeDSL/poseidon2_cgra/kernels/linear/internal_matrix/instructions_async.csv`

Key idea:

- Keep the same arithmetic primitives and exact modular semantics.
- Remove global lock-step in the constant multiply block.
- Let each PE/lane progress independently through its own bit-serial chain.

Measured result:

- Total cycles: **182**
- Oracle: **PASS (12 + 10000 random)**

Multiplier section analysis (`analyze_constmul_schedule.py`):

- Selected section cycles: **154**
- Structural floor for this asynchronous schedule model: **153**
- Slot-level counts:
  - `masked_add_slots`: 227
  - `double_slots`: 480
  - `reduce_r1_ssub_slots`: 227
  - `reduce_r1_bsfa_slots`: 227
  - `reduce_r2_ssub_slots`: 480
  - `reduce_r2_bsfa_slots`: 480

Interpretation:

- This confirms the major win came from schedule topology (lane-async), not from changing arithmetic correctness model.
- Additional gains from this exact model are now expected to be marginal.

## Lower-Bound Analysis (Bit-Serial Model)

From `analyze_constmul_bound.py`:

- Constants: 16
- Max bit length: 31
- Active bit positions (union across lanes): 31
- Lower bound:
  - add+reduce: 93 cycles
  - double+reduce: 90 cycles
  - total: **183 cycles**

Observed schedule in `god_tier`: 185 cycles.

Conclusion:

- Under current bit-serial + canonical-per-step reduction model, the multiplier block is already close to the theoretical floor (**~2 cycles from LB**).
- Large additional gains require changing arithmetic strategy, not local tweaks.

## What Not to Do (Validated)

- Aggressive shortcut variants that reduce to ~68-71 cycles failed oracle validation (massive mismatch rates).
- Replacing reduction tree with naive `allreduce(row)+allreduce(col)` in this kernel context changed semantics.

## Next Optimization Frontier

To push significantly below 212 cycles, focus on one of:

1. New non-bit-serial modular constant multiplication lowering (major change).
2. Pseudo-Mersenne reduction strategy specialized to BabyBear prime form (major change).
3. New fused compiler primitive/pass for modular add+reduce chains (major change).

Incremental local edits in the existing bit-serial schedule are expected to deliver only marginal gains.
