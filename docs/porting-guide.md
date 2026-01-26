# OpenEdgeDSL Porting Guide

This guide documents patterns and best practices for porting imperative code (Python, C) to OpenEdgeDSL.

## Porting Workflow

```
1. Analyze Original Code    → Identify computational patterns
2. Map to DSL Primitives    → Choose appropriate constructs
3. Implement in DSL         → Write the .edsl code
4. Verify with Simulator    → Run tests
```

## Pattern Mapping

### Python Loop → DSL Parallel

**Python:**
```python
for i in range(4):
    result[i] = a[i] * b[i]
```

**DSL:**
```c
#pragma parallel
for i in range(4) {
    cycle { @0,i: SMUL R2, R0, R1; }
}
```

### Python Multi-Line → DSL Single Cycle

**Python:**
```python
# Extract 4 bytes from 32-bit word (parallel across PEs)
for col in range(4):
    mask = 0xFF << (col * 8)
    result[col] = (word & mask) >> (col * 8)
```

**DSL:**
```c
cycle {
    @0,0: LAND R1, R0, 255;           // byte 0
    @0,1: SRT R1, R0, 8;              // byte 1 (shift + mask)
    @0,2: SRT R1, R0, 16;             // byte 2
    @0,3: SRT R1, R0, 24;             // byte 3
}
cycle {
    @0,1: LAND R1, R1, 255;           // mask bytes 1-3
    @0,2: LAND R1, R1, 255;
    @0,3: LAND R1, R1, 255;
}
```

### Python Cross-PE Communication → DSL Routing

**Python:**
```python
# Send data from PE (0,1) to PE (0,0) and add
result[0][0] = a[0][0] + a[0][1]
```

**DSL (using pragma):**
```c
#pragma route (0,1) -> (0,0) payload(R1) accum(R0)
```

**DSL (manual ROUT):**
```c
cycle { @0,1: SADD ROUT, R1, ZERO; }  // Send
cycle { @0,0: SADD R0, R0, RCL; }     // Receive from left
```

### Python Sequential Addition → DSL Pipelined

**Python:**
```python
# Carry chain
for i in range(4):
    val[i] += carry
    carry = val[i] >> 16
    val[i] &= 0xFFFF
```

**DSL:**
```c
// Pipelined: each column processes when it receives carry
cycle { @0,0: SRT R3, R0, 16; }              // Col 0: extract carry
cycle { @0,0: LAND R0, R0, 65535; @0,1: SADD R0, R0, RCL; }  // Col 0: mask, Col 1: add carry
cycle { @0,1: SRT R3, R0, 16; @0,0: SWI R0, 360; }           // Col 1: extract, Col 0: store
// ... continues
```

## Common Patterns

### 1. Parallel Memory Access

```c
// Load 4 consecutive values in parallel
cycle {
    @0,0: LWI R0, addr;
    @0,1: LWI R0, addr+4;
    @0,2: LWI R0, addr+8;
    @0,3: LWI R0, addr+12;
}
```

### 2. Broadcast (Same Value to All PEs)

```c
// All PEs load from same address
cycle {
    @0,0: LWI R0, value_addr;
    @0,1: LWI R0, value_addr;
    @0,2: LWI R0, value_addr;
    @0,3: LWI R0, value_addr;
}
```

### 3. Multi-Hop Routing

```c
// Route from (0,3) to (0,0) via 3 hops
cycle { @0,3: SADD ROUT, R0, ZERO; }  // Send
cycle { @0,2: SADD ROUT, RCR, ZERO; } // Forward
cycle { @0,1: SADD ROUT, RCR, ZERO; } // Forward
cycle { @0,0: SADD R1, RCR, ZERO; }   // Receive
```

### 4. Conditional Selection (Branchless)

```c
// Select A if negative, B otherwise
cycle { @0,0: SSUB R2, R0, R1; }      // Compute A - B (sets flags)
cycle { @0,0: BSFA R0, A, B, SELF; }  // Select based on sign flag
```

### 5. Accumulation to Single PE

```c
// Sum values from all columns to column 0
#pragma route (0,1) -> (0,0) payload(R0) accum(R3)
#pragma route (0,2) -> (0,0) payload(R0) accum(R3)
#pragma route (0,3) -> (0,0) payload(R0) accum(R3)
cycle { @0,0: SADD R3, R3, R0; }  // Add local value
```

## Verification Checklist

- [ ] Compile without errors: `npx vite-node scripts/verify_<module>.ts`
- [ ] Instruction patterns match expected behavior
- [ ] Run through simulator with test data
- [ ] Compare output with reference implementation
- [ ] Check cycle count is reasonable

## Example: Full Module Port

See `examples/dsl_port/lib/multiplication.edsl` for a complete example of porting Python's `Multiplication.build_full_products_general_parallel()`.

## Related Documentation

- [Spatial-Temporal Model](spec/03-spatial-temporal.md)
- [Instruction Set Reference](spec/04-instruction-set.md)
- [#pragma route](features/pragmas/route.md)
- [Barrett Port](examples/barrett/README.md)
