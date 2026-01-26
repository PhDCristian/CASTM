# Program Structure

[← Introduction](01-introduction.md) | [Index](../README.md) | [Next: Spatial-Temporal →](03-spatial-temporal.md)

---

A valid program consists of optional preprocessor directives followed by a single `kernel` block.

```c
// Directives
.const THRESHOLD 100
.alias r_acc R3

// Main Kernel
kernel "MyKernel" {
    config(0xF, 0); // Mask, StartAddr

    // ... cycles ...
}
```

---

## Preprocessor Directives

Directives must appear at the top of the file.

| Directive | Syntax | Description |
|:----------|:-------|:------------|
| **Constant** | `.const <NAME> <VALUE>` | Defines a numeric constant. Replaced textually. |
| **Alias** | `.alias <NAME> <REG>` | Defines a semantic name for a register (`R0`-`R3`, `ROUT`). |
| **Limit** | `.limit <CYCLES>` | Sets the maximum execution cycles for the simulation. |

### Examples

```c
.const MAX_ITER 10
.const THRESHOLD 100
.alias i_counter R0
.alias acc_val R1
.limit 100
```

---

## Kernel Configuration

The `config` statement is mandatory and must be the first statement inside `kernel`.

**Syntax:**
```c
config(<column_mask_hex>, <start_address_int>);
```

**Parameters:**
- `column_mask_hex`: Hexadecimal bitmask indicating which columns are active (e.g., `0xF` = all 4 columns)
- `start_address_int`: Starting program counter address

**Example:**
```c
kernel "MyKernel" {
    config(0xF, 0);  // All columns active, start at address 0
    // ...
}
```

---

## Memory Initialization (`.data`)

The `.data` directive allows initializing memory regions with specific values before execution. This is useful for creating self-contained kernels that define their own test data.

### Syntax

```
.data [name] [address] { value1, value2, ... }
```

| Component | Required | Description |
|-----------|----------|-------------|
| `name` | No | Identifier for named access (`input`, `weights`, etc.) |
| `address` | No | Base address in bytes (auto-assigned if omitted) |
| `{ values }` | Yes | Comma-separated initial values |

### Syntax Variants

| Form | Example | Description |
|------|---------|-------------|
| Anonymous, auto-address | `.data { 1, 2, 3 }` | Allocates sequentially |
| Anonymous, explicit address | `.data 100 { 1, 2, 3 }` | Fixed at address 100 |
| Named, auto-address | `.data input { 1, 2, 3 }` | Named array, sequential allocation |
| Named, explicit address | `.data buffer 100 { 0, 0 }` | Named array at address 100 |

### Named Array Access

Named arrays can be accessed by name instead of calculating offsets:

```c
.data input { 5, 10, 3 }
.data weights { 2, 20, 3 }

// Access by name
LWI R0, input[0]     // First element of input
LWI R1, weights[i]   // Element i of weights

// Global access still works
LWI R2, data[0]      // Same as input[0]
LWI R3, data[3]      // Same as weights[0]
```

### Array Properties

Named arrays provide compile-time properties:

| Property | Description | Example |
|----------|-------------|---------|
| `.len()` | Number of elements | `input.len()` → 3 |
| `.base()` | Base address in bytes | `input.base()` → 0 |
| `.size()` | Total size in bytes (len × 4) | `input.size()` → 12 |
| `.last()` | Index of last element (len - 1) | `input.last()` → 2 |

**Usage in loops:**
```c
.data values { 1, 2, 3, 4, 5 }

for i in range(values.len()) {
    cycle { @0,0: LWI R0, values[i]; }
}

// Access last element
cycle { @0,0: LWI R0, values[values.last()]; }
```

### Examples

```c
// Anonymous arrays (legacy syntax)
.data 0 { 1, 2, 3, 4, 5 }
.data { 10, 20, 30 }  // Auto-address at 20

// Named arrays (recommended)
.data input { 5, 10, 3 }
.data output 100 { 0, 0, 0 }
```

---

## IO Configuration (`.io_load` / `.io_store`)

The `.io_load` and `.io_store` directives configure the initial memory pointers for `LWD` (Load Word Direct) and `SWD` (Store Word Direct) operations per column.

### Syntax

```c
.io_load { <addr_col0>, <addr_col1>, ... }
.io_store { <addr_col0>, <addr_col1>, ... }
```

### Behavior

Sets the `loadAddrs` and `storeAddrs` for the simulation. Values correspond to columns 0, 1, 2, etc.

### Examples

```c
// Set load pointers for columns 0 and 1
.io_load { 0, 16 }

// Set store pointers for columns 0 and 1
.io_store { 100, 116 }
```

---

## Complete Example

```c
// Constants & Aliases
.const MAX_ITER 10
.alias i_counter R0
.alias acc_val   R1

// Memory Initialization
.data 0 { 0, 0 } // data[0] -> addr 0, data[1] -> addr 4

// IO Configuration
.io_store { 0, 64 } // Col 1 will store results starting at addr 64

kernel "VectorSum" {
    config(0xF, 0);

    // ... cycles ...
}
```

---

## Navigation

- [← Introduction](01-introduction.md)
- [Index](../README.md)
- [Next: Spatial-Temporal →](03-spatial-temporal.md)
