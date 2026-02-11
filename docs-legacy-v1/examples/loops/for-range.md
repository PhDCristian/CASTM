# Example: For Range Patterns

[← Examples Index](../README.md) | [Main Index](../../README.md)

---

Various patterns using compile-time for loops.

## Basic Range

```c
kernel "BasicFor" {
    config(0xF, 0);

    for i in range(4) {
        cycle {
            row 0: SADD R0, R0, i | _ | _ | _;
        }
    }
}
// Generates 4 cycles: R0 += 0, R0 += 1, R0 += 2, R0 += 3
```

## Range with Start/End

```c
for i in range(2, 6) {
    cycle {
        row 0: LWI R0, i | _ | _ | _;
    }
}
// i = 2, 3, 4, 5
```

## Range with Step

```c
for i in range(0, 10, 2) {
    cycle {
        row 0: SADD R0, ZERO, i | _ | _ | _;
    }
}
// i = 0, 2, 4, 6, 8
```

## Descending Range

```c
for i in range(5, 0, -1) {
    cycle {
        row 0: SADD R0, ZERO, i | _ | _ | _;
    }
}
// i = 5, 4, 3, 2, 1
```

## Ignored Variable

```c
for _ in range(4) {
    cycle {
        row 0: SADD R0, R0, IMM(1) | _ | _ | _;
    }
}
// Just repeats 4 times
```

## Data Reference Arithmetic

<!-- expect: ROUT@0,0=90 -->
```c
.data 0 { 10, 20, 30, 40, 50, 60 }

kernel "DataArithmetic" {
    config(0xF, 0);

    for i in range(3) {
        // Load pairs: (0,3), (1,4), (2,5)
        cycle { @0,0: LWI R0, data[i]; }
        cycle { @0,0: LWI R1, data[i + 3]; }
        cycle { @0,0: SADD ROUT, R0, R1; }
        cycle { @0,0: SWD ROUT; }
    }

    cycle { @0,0: EXIT; }
}
// Computes: 10+40=50, 20+50=70, 30+60=90
```

## With Functions

```c
function INIT_AND_STORE(addr) {
    cycle { @0,0: LWI R0, addr; }
    cycle { @0,0: SADD ROUT, R0, R0; }
    cycle { @0,0: SWD ROUT; }
}

kernel "ForWithFunc" {
    config(0xF, 0);

    for i in range(0, 16, 4) {
        INIT_AND_STORE(i);  // i = 0, 4, 8, 12
    }

    cycle { @0,0: EXIT; }
}
```

## Nested Loops

```c
for row_idx in range(2) {
    for col_idx in range(4) {
        cycle {
            @col_idx, row_idx: SADD R0, ZERO, row_idx;
        }
    }
}
// Generates 8 cycles, filling grid row by row
```

---

## Navigation

- [← Examples Index](../README.md)
- [Main Index](../../README.md)
