# Pragma Route

[← Stencil](stencil.md) | [Main Index](../../README.md) | [Next: Rotate →](rotate.md)

---

The `#pragma route` directive generates automatic toroidal routing between PEs, eliminating manual ROUT chain management.

## Syntax

### Standard Syntax (Accumulation)

```c
#pragma route (src_row, src_col) -> (dst_row, dst_col) payload(srcReg) accum(dstReg)
```

### Extended Syntax (Custom Operation)

```c
#pragma route (src_row, src_col) -> (dst_row, dst_col) payload(srcReg) dest(dstReg) op(OPCODE Rd, Rs1, Rs2)
```

Use `INCOMING` as a placeholder for the routed value in the operation.

| Parameter | Description |
|-----------|-------------|
| `src_row, src_col` | Source PE coordinates |
| `dst_row, dst_col` | Destination PE coordinates |
| `payload(R)` | Register to send from source |
| `accum(R)` | Register to accumulate into at destination (standard) |
| `dest(R)` | Destination register (extended) |
| `op(...)` | Custom operation at destination (extended) |

---

## Routing Algorithm

The compiler uses **toroidal shortest-path routing**:

1. Calculates Manhattan distance with wrap-around (4x4 torus)
2. Generates `SADD ROUT, ..., ZERO` for intermediate hops
3. Generates `SADD accum, accum, RCx` at destination

### Toroidal Wrap-Around

```
Distance from col 0 to col 3:
  - Right: 3 hops (0→1→2→3)
  - Left:  1 hop  (0→3 via wrap)
  
Compiler chooses LEFT (shorter).
```

---

## Examples

### Local Accumulation (0 hops)

```c
#pragma route (0,0) -> (0,0) payload(R1) accum(R0)

// Generated:
cycle { @0,0: SADD R0, R0, R1; }
```

### Neighbor Routing (1 hop)

```c
#pragma route (0,0) -> (0,1) payload(R1) accum(R0)

// Generated:
cycle { @0,0: SADD ROUT, R1, ZERO; }  // Send right
cycle { @0,1: SADD R0, R0, RCL; }      // Receive from left
```

### Wrap-Around Routing

```c
#pragma route (0,0) -> (0,3) payload(R1) accum(R0)

// Generated (1 hop via left wrap):
cycle { @0,0: SADD ROUT, R1, ZERO; }  // Send left (wraps)
cycle { @0,3: SADD R0, R0, RCR; }      // Receive from right
```

### Multi-Hop Routing

```c
#pragma route (0,0) -> (1,1) payload(R1) accum(R0)

// Generated (2 hops: right, then down):
cycle { @0,0: SADD ROUT, R1, ZERO; }      // Send right
cycle { @0,1: SADD ROUT, RCL, ZERO; }     // Forward down
cycle { @1,1: SADD R0, R0, RCT; }          // Receive from top
```

---

## Neighbor Register Selection

At each hop, the incoming data register is determined by direction:

| Direction | Incoming Register |
|-----------|------------------|
| From Left (→) | `RCL` |
| From Right (←) | `RCR` |
| From Top (↓) | `RCT` |
| From Bottom (↑) | `RCB` |

---

## Cycle Cost

| Path Length | Cycles |
|-------------|--------|
| 0 (local) | 1 |
| 1 hop | 2 |
| 2 hops | 3 |
| N hops | N+1 |

---

## Use Cases

### Distributed Accumulation (Barrett Reduction)

```c
// Accumulate products from row 0 into diagonal accumulators
#pragma route (0,0) -> (0,0) payload(R2) accum(R3)  // Local
#pragma route (0,1) -> (1,1) payload(R2) accum(R3)  // 1 hop
#pragma route (0,2) -> (2,2) payload(R2) accum(R3)  // 2 hops
```

### Cross-PE Communication

```c
// Broadcast from corner to opposite corner
#pragma route (0,0) -> (3,3) payload(R0) accum(R1)
// Uses 4 hops (2 right + 2 down, or 2 left + 2 up via wrap)
```

---

## Comparison with Other Pragmas

| Pragma | Pattern | Use Case |
|--------|---------|----------|
| `reduce` | All PEs → one PE | Sum/max/min across grid |
| `stencil` | Neighbors → center | Image filtering |
| `route` | Point-to-point | Arbitrary PE communication |

---

## Extended Syntax Examples

### Custom Multiplication at Destination

Route a value and multiply it with a local register:

```c
#pragma route (0,1) -> (0,0) payload(R3) dest(R1) op(SMUL R1, R0, INCOMING)

// Generated:
cycle { @0,1: SADD ROUT, R3, ZERO; }  // Send R3
cycle { @0,0: SMUL R1, R0, RCR; }      // Multiply R0 with incoming
```

### Cross-Column Squaring (Barrett Reduction)

For distributed squaring, multiply values from different columns:

```c
// A0 * A1: multiply values from column 0 and column 1
cycle { @0,0: LWI R3, 100; }  // Load A0
cycle { @0,1: LWI R3, 104; }  // Load A1

// Route A1 to column 0 and multiply with A0
#pragma route (0,1) -> (0,0) payload(R3) dest(R0) op(SMUL R0, R3, INCOMING)

cycle { @0,0: SWI R0, 400; }  // Store product
```

---

## Limitations

1. **Sequential hops:** Each hop requires a separate cycle
2. **No broadcast:** For 1-to-many, use multiple route directives

---

## Implementation Details

- **Parser:** `src/core/dsl/parser/pragma-parser.ts` (`parseRoutePragmaArgs`)
- **Generator:** `src/core/dsl/parser/route-generator.ts` (`generateRouteTokens`)
- **Pathfinding:** `computeToroidalPath()` in route-generator.ts

---

## Navigation

- [← Stencil](stencil.md)
- [Main Index](../../README.md)
- [Next: Rotate →](rotate.md)
