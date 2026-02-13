# Loop Patterns

Compile-time and runtime loop forms in canonical syntax.

```openedge
target "uma-cgra-base";

kernel "loops_example" {
  for i in range(0, 4) {
    cycle { @0,i: NOP; }
  }

  for k in range(0, 16) {
    cycle { @k/4,k%4: NOP; }
  }

  for R0 in range(0, 3) at @0,0 runtime {
    cycle { at @0,1: R1 = R0 + 1; }
  }
}
```
