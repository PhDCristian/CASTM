# Scan + Reduce

Collective statements over lanes.

```openedge
target "uma-cgra-base";

kernel "scan_reduce_example" {
  scan(op=add, src=R0, dest=R1, dir=right, mode=inclusive);
  reduce(op=add, dest=R2, src=R1, axis=row);
  allreduce(op=add, dest=R3, src=R2, axis=col);
}
```
