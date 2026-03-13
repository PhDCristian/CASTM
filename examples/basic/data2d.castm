// 2D Arrays
//
// Demonstrates: .data2d directive, 2D array access with A[row][col],
//               row-major memory layout.

.data2d matrix[2][2] { 1, 2, 3, 4 }
// Memory layout (row-major):
//   matrix[0][0] = 1  (addr 0)
//   matrix[0][1] = 2  (addr 4)
//   matrix[1][0] = 3  (addr 8)
//   matrix[1][1] = 4  (addr 12)

kernel "Data2D" {
    config(0xF, 0);

    // Load diagonal elements
    bundle {
        @0,0: LWI R0, matrix[0][0];   // = 1
        @0,1: LWI R0, matrix[1][1];   // = 4
    }

    // Add diagonal elements
    bundle {
        @0,0: SADD ROUT, R0, ZERO;
    }

    bundle {
        @0,1: SADD R1, R0, RCL;       // R1 = 1 + 4 = 5
    }

    bundle {
        @0,0: EXIT;
    }
}
