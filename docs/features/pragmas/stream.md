# Pragma Stream Load / Stream Store

[← Gather](gather.md) | [Main Index](../../README.md) | [Next: Auto Cycle →](auto-cycle.md)

---

The `#pragma stream_load` and `#pragma stream_store` directives abstract streaming memory access using the hardware's auto-incrementing LWD/SWD instructions.

## Syntax

```c
#pragma stream_load(dest=REG)
#pragma stream_load(dest=REG, row=N)
#pragma stream_load(dest=REG, row=N, count=N)

#pragma stream_store(src=REG)
#pragma stream_store(src=REG, row=N)
#pragma stream_store(src=REG, row=N, count=N)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dest` / `src` | (required) | Register to load into / store from (R0-R3) |
| `row` | 0 | Which row to issue the LWD/SWD instructions |
| `count` | 1 | Number of consecutive load/store cycles |

---

## Prerequisites

Stream load/store relies on the hardware's per-column memory pointers. You **must** configure these with `.io_load` / `.io_store` directives:

```c
.data input { 10, 20, 30, 40 }
.io_load { 0, 4, 8, 12 }    // col 0 → addr 0, col 1 → addr 4, etc.
```

---

## Before vs After

### Without stream_load (verbose)

```c
.data input { 10, 20, 30, 40 }
kernel "Manual" {
    config(0xF, 0);
    cycle { @0,0: LWI R0, input[0]; }
    cycle { @0,1: LWI R0, input[1]; }
    cycle { @0,2: LWI R0, input[2]; }
    cycle { @0,3: LWI R0, input[3]; }
}
```

### With stream_load (1 line)

```c
.data input { 10, 20, 30, 40 }
.io_load { 0, 4, 8, 12 }
kernel "Streaming" {
    config(0xF, 0);
    #pragma stream_load(dest=R0)
}
```

---

## How It Works

Each column has its own memory pointer (`memPointers[col]`):

- `LWD R0` reads from `memPointers[col]` and auto-increments by 4 bytes
- `SWD R0` writes to `storePointers[col]` and auto-increments by 4 bytes

The pragma generates one cycle per `count` iteration:
```c
cycle {
    @row,0: LWD dest;
    @row,1: LWD dest;
    @row,2: LWD dest;
    @row,3: LWD dest;
}
```

---

## Examples

### Basic Load

```c
.data input { 10, 20, 30, 40 }
.io_load { 0, 4, 8, 12 }
kernel "StreamBasic" {
    config(0xF, 0);
    #pragma stream_load(dest=R0)
    // PE(0,0).R0 = 10, PE(0,1).R0 = 20, PE(0,2).R0 = 30, PE(0,3).R0 = 40
    cycle { @0,0: EXIT; }
}
```

### Multiple Loads (count=2)

```c
.data input { 10, 20, 30, 40, 50, 60, 70, 80 }
.io_load { 0, 4, 8, 12 }
kernel "StreamMulti" {
    config(0xF, 0);
    #pragma stream_load(dest=R0, count=2)
    // 2 consecutive LWD cycles — R0 holds the LAST loaded value
    // PE(0,0).R0 = 20 (loaded 10, then 20)
    cycle { @0,0: EXIT; }
}
```

### Load on Different Row

```c
.io_load { 0, 4, 8, 12 }
kernel "StreamRow2" {
    config(0xF, 0);
    #pragma stream_load(dest=R1, row=2)
    // LWD issued on row 2 PEs
    cycle { @0,0: EXIT; }
}
```

### Store

```c
.io_store { 100, 104, 108, 112 }
kernel "StreamStore" {
    config(0xF, 0);
    cycle { all: SADD R0, ZERO, IMM(42); }
    #pragma stream_store(src=R0)
    // Writes R0 from each column to its store pointer
    cycle { @0,0: EXIT; }
}
```

---

## Cycle Count

| Operation | Cycles |
|-----------|--------|
| `stream_load(dest=R0)` | 1 |
| `stream_load(dest=R0, count=N)` | N |
| `stream_store(src=R0)` | 1 |
| `stream_store(src=R0, count=N)` | N |

---

## Registers Used

No temporary registers are used. Only the specified `dest`/`src` register is affected.

---

## Limitations

1. **Requires `.io_load` / `.io_store`**: Memory pointers must be configured before the kernel
2. **4-column grid**: Generates instructions for columns 0-3 in the specified row
3. **Last value wins**: With `count > 1`, the register holds the last loaded value (use different registers for accumulation)

---

## Navigation

- [← Gather](gather.md)
- [Main Index](../../README.md)
- [Next: Auto Cycle →](auto-cycle.md)
