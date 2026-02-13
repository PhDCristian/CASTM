# Formal Grammar

Canonical grammar source-of-truth lives in:

- `docs/language/grammar.md`

This page mirrors the public-facing subset used by the current compiler.

## Program

```text
program          ::= target_decl declaration* function_def* kernel_decl
target_decl      ::= "target" string_lit ";"
kernel_decl      ::= "kernel" string_lit "{" kernel_item* "}"
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

## Spatial Cycle Statements

```text
cycle_block      ::= "cycle" "{" cycle_stmt* "}"
cycle_stmt       ::= at_point_stmt | at_row_stmt | at_col_stmt | at_all_stmt | short_point_stmt
at_point_stmt    ::= "at" "@" coord_expr "," coord_expr ":" instruction ";"
short_point_stmt ::= "@" coord_expr "," coord_expr ":" instruction ";"
at_row_stmt      ::= "at" "row" int_expr ":" instruction ";"
at_col_stmt      ::= "at" "col" int_expr ":" instruction ";"
at_all_stmt      ::= "at" "all" ":" instruction ";"
```

## Control Flow

```text
if_stmt          ::= "if" "(" cond_expr ")" "at" "@" int_expr "," int_expr "{" kernel_item* "}" [ "else" "{" kernel_item* "}" ]
while_stmt       ::= "while" "(" cond_expr ")" "at" "@" int_expr "," int_expr "{" kernel_item* "}"
for_stmt         ::= "for" ident "in" "range" "(" range_args ")" "{" kernel_item* "}"
                  | "for" register "in" "range" "(" range_args ")" "at" "@" int_expr "," int_expr "runtime" "{" kernel_item* "}"
```

## Advanced Statements

```text
advanced_stmt    ::= route_stmt | reduce_stmt | scan_stmt | broadcast_stmt | ...
route_stmt       ::= "route" "(" route_edge "," "payload" "=" register "," ( "accum" "=" register | "dest" "=" register "," "op" "=" op_call ) ")" ";"
latency_hide_stmt ::= "latency_hide" "(" ( "window" "=" int_expr ["," "mode" "=" "conservative"] | "mode" "=" "conservative" ) ")" ";"
stash_stmt       ::= "stash" "(" "action" "=" ("save"|"restore") "," "reg" "=" register "," "addr" "=" operand ["," "target" "=" stash_target] ")" ";"
```

For the full up-to-date EBNF and all statement forms, use `docs/language/grammar.md`.
