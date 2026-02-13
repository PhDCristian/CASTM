# Canonical Grammar (EBNF, Private)

This grammar defines the canonical OpenEdgeDSL syntax profile.

## Program

```text
program          ::= target_decl declaration* function_def* kernel_decl
target_decl      ::= "target" string_lit ";"
kernel_decl      ::= "kernel" string_lit "{" kernel_item* "}"
kernel_item      ::= config_stmt | runtime_directive | cycle_block | control_stmt | for_stmt | advanced_stmt | pipeline_stmt | function_call
```

## Declarations

```text
declaration      ::= let_const | let_alias | let_data | let_data_fixed | let_data2d | let_data2d_zero
let_const        ::= "let" ident "=" int_expr ";"
let_alias        ::= "let" ident "=" register ";"
let_data         ::= "let" ident "=" "{" int_list "}" ";"
let_data_fixed   ::= "let" ident "@" int_expr "=" "{" int_list "}" ";"
let_data2d       ::= "let" ident "[" int_expr "]" "[" int_expr "]" "=" "{" int_list "}" ";"
let_data2d_zero  ::= "let" ident "[" int_expr "]" "[" int_expr "]" ";"
runtime_directive ::= io_load | io_store | limit | assert
io_load          ::= ".io_load" int_expr "," int_expr ("," int_expr)* 
io_store         ::= ".io_store" int_expr "," int_expr ("," int_expr)* 
limit            ::= ".limit" int_expr
assert           ::= ".assert" assert_expr
```

## Spatial / Cycle

```text
cycle_block      ::= "cycle" "{" cycle_stmt* "}"
cycle_stmt       ::= at_point_stmt | at_row_stmt | at_col_stmt | at_all_stmt | short_point_stmt
coord_expr       ::= int_expr | int_expr ".." int_expr
at_point_stmt    ::= "at" "@" coord_expr "," coord_expr ":" instruction ";"
at_row_stmt      ::= "at" "row" int_expr ":" instruction ";"
at_col_stmt      ::= "at" "col" int_expr ":" instruction ";"
at_all_stmt      ::= "at" "all" ":" instruction ";"
short_point_stmt ::= "@" coord_expr "," coord_expr ":" instruction ";"
```

Notes:

- A single source line inside `cycle { ... }` may contain multiple `cycle_stmt` entries separated by `;`.
- Spatial coordinate expressions are integer expressions; when division appears (for example `@k/4,k%4`) canonical lowering uses integer truncation semantics after loop binding.
- Coordinate ranges expand inclusively. Example: `@0,0..3` expands to `@0,0`, `@0,1`, `@0,2`, `@0,3`; `@1..2,1..2` expands to the cartesian product.
- `at row N: INSTR;` with a single instruction auto-broadcasts across every column in row `N`.

## Control-flow

```text
control_stmt     ::= if_stmt | while_stmt
if_stmt          ::= "if" "(" cond_expr ")" "at" "@" int_expr "," int_expr "{" kernel_item* "}" [ "else" "{" kernel_item* "}" ]
while_stmt       ::= "while" "(" cond_expr ")" "at" "@" int_expr "," int_expr "{" kernel_item* "}"
for_stmt         ::= "for" ident "in" "range" "(" range_args ")" loop_mod* "{" kernel_item* "}"
                  | "for" register "in" "range" "(" range_args ")" "at" "@" int_expr "," int_expr "runtime" "{" kernel_item* "}"
range_args       ::= int_expr | int_expr "," int_expr | int_expr "," int_expr "," int_expr
loop_mod         ::= "unroll" "(" int_expr ")" | "collapse" "(" int_expr ")"
function_def     ::= "function" ident "(" ident_list? ")" "{" kernel_item* "}"
function_call    ::= ident "(" arg_list? ")" ";"
pipeline_stmt    ::= "pipeline" "(" function_call_inline ( "," function_call_inline )* ")" ";"
function_call_inline ::= ident "(" arg_list? ")"
```

Loop modifier semantics:

- `unroll(k)` and `collapse(n)` are canonical modifiers for static loops.
- `collapse(n)` uses deterministic row-major linearization for nested static loops.
- `runtime` loops do not support `unroll(...)` or `collapse(...)` in this phase.

## Advanced Statements

```text
advanced_stmt    ::= route_stmt | reduce_stmt | scan_stmt | broadcast_stmt
                  | accumulate_stmt | carry_chain_stmt | conditional_sub_stmt | collect_stmt | normalize_stmt | extract_bytes_stmt | rotate_stmt | shift_stmt | stencil_stmt | guard_stmt | triangle_stmt | allreduce_stmt
                  | transpose_stmt | gather_stmt | stream_load_stmt | stream_store_stmt | latency_hide_stmt | stash_stmt

std_prefix       ::= "std::" | ""
route_stmt       ::= std_prefix "route" "(" route_edge "," "payload" "=" register "," ( "accum" "=" register | "dest" "=" register "," "op" "=" op_call ) ")" ";"
route_edge       ::= "@" int_expr "," int_expr "->" "@" int_expr "," int_expr
op_call          ::= ident "(" operand "," operand "," operand ")"

accumulate_stmt  ::= std_prefix "accumulate" "(" "pattern" "=" ("row" | "col" | "anti_diagonal") "," "products" "=" register "," "accum" "=" register "," "out" "=" register [ "," "combine" "=" ("add" | "sum" | "sub" | "and" | "or" | "xor" | "mul") ] ")" ";"
carry_chain_stmt ::= std_prefix "carry_chain" "(" "src" "=" register "," "carry" "=" register "," "store" "=" ident "," "limbs" "=" int_expr "," "width" "=" int_expr "," "row" "=" int_expr [ "," "mask" "=" int_expr ] [ "," "start" "=" int_expr ] [ "," "dir" "=" ("right" | "left") ] ")" ";"
conditional_sub_stmt ::= std_prefix "conditional_sub" "(" "value" "=" register "," "sub" "=" register "," "dest" "=" register [ "," "target" "=" ("all" | "row(" int_expr ")" | "col(" int_expr ")" | "point(" int_expr "," int_expr ")") ] ")" ";"
collect_stmt     ::= std_prefix "collect" "(" "from" "=" lane_ref [ "," "to" "=" lane_ref ] "," "via" "=" register "," "local" "=" register "," "into" "=" register [ "," "combine" "=" collect_combine ] ")" ";"
lane_ref         ::= ("row" | "col") "(" int_expr ")"
collect_combine  ::= "copy" | "add" | "sum" | "sub" | "and" | "or" | "xor" | "mul" | "shift_add"
normalize_stmt   ::= std_prefix "normalize" "(" "reg" "=" register "," "carry" "=" register "," "width" "=" int_expr "," "lane" "=" int_expr [ "," "mask" "=" int_expr ] [ "," "axis" "=" ("row" | "col") ] [ "," "dir" "=" ("right" | "left" | "down" | "up") ] ")" ";"
extract_bytes_stmt ::= std_prefix "extract_bytes" "(" "src" "=" register "," "dest" "=" register [ "," "axis" "=" ("row" | "col") ] [ "," "byteWidth" "=" int_expr ] [ "," "mask" "=" int_expr ] ")" ";"
latency_hide_stmt ::= std_prefix "latency_hide" "(" ( "window" "=" int_expr [ "," "mode" "=" "conservative" ] | "mode" "=" "conservative" ) ")" ";"
stash_stmt      ::= std_prefix "stash" "(" "action" "=" ("save" | "restore") "," "reg" "=" register "," "addr" "=" operand [ "," "target" "=" stash_target ] ")" ";"
stash_target    ::= "all" | "row(" int_expr ")" | "col(" int_expr ")" | "point(" int_expr "," int_expr ")"

reduce_stmt      ::= std_prefix "reduce" "(" "op" "=" ident "," "dest" "=" register "," "src" "=" register [ "," "axis" "=" ("row" | "col") ] ")" ";"
scan_stmt        ::= std_prefix "scan" "(" "op" "=" ident "," "src" "=" register "," "dest" "=" register "," "dir" "=" ident [ "," "mode" "=" ident ] ")" ";"
guard_stmt       ::= std_prefix "guard" "(" "cond" "=" cond_expr "," "op" "=" ident "," "dest" "=" register "," "srcA" "=" register "," "srcB" "=" register ")" ";"
triangle_stmt    ::= std_prefix "triangle" "(" "shape" "=" ("upper" | "lower") [ "," "inclusive" "=" ("true" | "false" | "inclusive" | "exclusive") ] "," "op" "=" ident "," "dest" "=" register "," "srcA" "=" register "," "srcB" "=" register ")" ";"
```

## Executable snippet

```dsl
target "uma-cgra-base";
let A = { 10, 20, 30, 40 };
kernel "grammar_example" {
  std::route(@0,1 -> @0,0, payload=R3, accum=R1);
  cycle {
    at @0,0: R1 = A[1];
    at row 1: NOP;
  }
}
```
