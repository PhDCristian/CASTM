// Vertical (Column) Reduce
//
// Demonstrates: #pragma reduce with axis=col, reducing across rows in column 0.
// Computes the sum of values in rows 0-3 of column 0.

kernel "ReduceVertical" {
    config(0xF, 0);

    // Load values into column 0 across all rows
    bundle {
        @0,0: SADD R0, ZERO, 10;
    }
    bundle {
        @1,0: SADD R0, ZERO, 20;
    }
    bundle {
        @2,0: SADD R0, ZERO, 30;
    }
    bundle {
        @3,0: SADD R0, ZERO, 40;
    }

    // Vertical reduce: R1 at (0,0) = 10 + 20 + 30 + 40 = 100
    #pragma reduce(sum, R1, R0, axis=col)

    bundle {
        @0,0: EXIT;
    }
}
