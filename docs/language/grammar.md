# Canonical Grammar (EBNF, Private)

This grammar defines the canonical OpenEdgeDSL syntax profile.

## Program

```text
program          ::= target_decl declaration* kernel_decl
target_decl      ::= "target" string_lit ";"
kernel_decl      ::= "kernel" string_lit "{" kernel_item* "}"
kernel_item      ::= config_stmt | cycle_block | control_stmt | for_stmt | advanced_stmt | function_call
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
```

## Spatial / Cycle

```text
cycle_block      ::= "cycle" "{" cycle_stmt* "}"
cycle_stmt       ::= at_point_stmt | at_row_stmt | at_col_stmt | at_all_stmt | short_point_stmt
at_point_stmt    ::= "at" "@" int_expr "," int_expr ":" instruction ";"
at_row_stmt      ::= "at" "row" int_expr ":" instruction ";"
at_col_stmt      ::= "at" "col" int_expr ":" instruction ";"
at_all_stmt      ::= "at" "all" ":" instruction ";"
short_point_stmt ::= "@" int_expr "," int_expr ":" instruction ";"
```

## Control-flow

```text
control_stmt     ::= if_stmt | while_stmt
if_stmt          ::= "if" "(" cond_expr ")" "at" "@" int_expr "," int_expr "{" kernel_item* "}" [ "else" "{" kernel_item* "}" ]
while_stmt       ::= "while" "(" cond_expr ")" "at" "@" int_expr "," int_expr "{" kernel_item* "}"
for_stmt         ::= "for" ident "in" "range" "(" range_args ")" "{" kernel_item* "}"
                  | "for" register "in" "range" "(" range_args ")" "at" "@" int_expr "," int_expr "runtime" "{" kernel_item* "}"
range_args       ::= int_expr | int_expr "," int_expr | int_expr "," int_expr "," int_expr
```

## Advanced Statements

```text
advanced_stmt    ::= route_stmt | reduce_stmt | scan_stmt | broadcast_stmt
                  | rotate_stmt | shift_stmt | stencil_stmt | allreduce_stmt
                  | transpose_stmt | gather_stmt | stream_load_stmt | stream_store_stmt

route_stmt       ::= "route" "(" route_edge "," "payload" "=" register "," ( "accum" "=" register | "dest" "=" register "," "op" "=" op_call ) ")" ";"
route_edge       ::= "@" int_expr "," int_expr "->" "@" int_expr "," int_expr
op_call          ::= ident "(" operand "," operand "," operand ")"

reduce_stmt      ::= "reduce" "(" "op" "=" ident "," "dest" "=" register "," "src" "=" register [ "," "axis" "=" ("row" | "col") ] ")" ";"
scan_stmt        ::= "scan" "(" "op" "=" ident "," "src" "=" register "," "dest" "=" register "," "dir" "=" ident [ "," "mode" "=" ident ] ")" ";"
```

## Executable snippet

```dsl
target "uma-cgra-base";
let A = { 10, 20, 30, 40 };
kernel "grammar_example" {
  route(@0,1 -> @0,0, payload=R3, accum=R1);
  cycle {
    at @0,0: R1 = A[1];
    at row 1: NOP;
  }
}
```
