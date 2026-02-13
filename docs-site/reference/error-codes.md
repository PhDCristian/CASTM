# Error Codes

Canonical diagnostics currently exposed by `@openedge/compiler-ir`.

## Parse

- `E2001` Missing target declaration
- `E2002` Invalid syntax
- `E2003` Missing kernel declaration

## Semantic / Lowering

- `E3001` Invalid assignment
- `E3002` Unsupported operation
- `E3003` Coordinate out of bounds
- `E3004` Spatial collision in the same cycle
- `E3005` Unknown opcode
- `E3006` Unknown target profile
- `E3007` Invalid grid specification
- `E3008` Unsupported advanced statement
- `E3009` Unknown label
- `E3010` Duplicate label
- `E3011` Unresolved coordinate expression

## Internal

- `E9001` Unexpected internal state

## Diagnostic Shape

Each diagnostic contains:

- `code`
- `severity`
- `span`
- `message`
- optional `hint`
- optional `hintCode`
