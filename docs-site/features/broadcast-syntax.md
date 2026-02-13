# Row Auto-Broadcast

A single placement at `at row N:` auto-broadcasts across all columns in that row.

## Example

```openedge
target "uma-cgra-base";
kernel "row_broadcast" {
  cycle {
    at row 1: NOP;
  }
}
```

This lowers to one placement per column at row `1`.

## Notes

- Applies to `at row` form with one instruction payload.
- `at col` and `at all` also expand spatially over their target sets.
