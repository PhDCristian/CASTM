# Formal Grammar (BNF)

[← Compilation](05-compilation.md) | [Index](../README.md)

---

This document provides a formal specification of the OpenEdgeDSL syntax using Extended Backus-Naur Form (EBNF) notation.

## Notation

The grammar uses the following EBNF conventions:

| Symbol | Meaning |
|--------|---------|
| `::=` | "is defined as" |
| `|` | Alternation (OR) |
| `[ ]` | Optional (zero or one occurrence) |
| `{ }` | Repetition (zero or more occurrences) |
| `( )` | Grouping |
| `+` | One or more occurrences |
| `*` | Zero or more occurrences |
| `" "` | Terminal symbol (literal text) |
| `< >` | Non-terminal symbol |

---

## Program Structure

```ebnf
<program> ::= { <top-level-item> }* <kernel>

<top-level-item> ::= <directive>
                   | <pragma>
                   | <function-def>

<kernel> ::= "kernel" [ <string> ] "{" <config> { <kernel-item> }* "}"

<kernel-item> ::= <directive>
                | <pragma>
                | <for-loop>
                | <while-loop>
                | <if-else>
                | <function-call>
                | <labeled-cycle>
                | <cycle>

<config> ::= "config" "(" <number> "," <number> ")" ";"
```

---

## Directives

```ebnf
<directive> ::= ".const" <identifier> <expression>
              | ".alias" <identifier> <register>
              | ".data" [ <identifier> ] [ <number> ] "{" <number-list> "}"
              | ".data2d" <identifier> <array-dims> [ "{" <number-list> "}" ]
              | ".io_load" "{" <number-list> "}"
              | ".io_store" "{" <number-list> "}"
              | ".limit" <number>
              | ".assert" <assertion>

<array-dims> ::= "[" <number> "]" [ "[" <number> "]" ]

<number-list> ::= <number> { "," <number> }*

<assertion> ::= <identifier> "[" <expression> "]" "==" <expression>
              | "@" <number> "," <number> ":" <register> "==" <expression>
```

---

## Pragmas

```ebnf
<pragma> ::= "#pragma" <pragma-name> [ <pragma-modifiers> ] [ <pragma-args> ]

<pragma-name> ::= "unroll"
                | "no_unroll"
                | "inline"
                | "no_fuse"
                | "parallel"
                | "reduce"
                | "stencil"
                | "route"
                | "scan"
                | "broadcast"

<pragma-modifiers> ::= <pragma-modifier> { <pragma-modifier> }*

<pragma-modifier> ::= <identifier> [ "(" <number> ")" ]

<pragma-args> ::= "(" <pragma-arg-list> ")"

<pragma-arg-list> ::= <pragma-arg> { "," <pragma-arg> }*

<pragma-arg> ::= <number>
               | <identifier>
               | <string>
               | <register>
               | <coordinate>
               | <pragma-keyword-arg>

<pragma-keyword-arg> ::= <identifier> "=" <pragma-arg>

<route-pragma-args> ::= <route-point> "->" <route-point> "payload" "(" <register> ")" ( <route-accum> | <route-custom-op> )

<route-point> ::= "@" <number> "," <number>
                | "(" <number> "," <number> ")"

<route-accum> ::= "accum" "(" <register> ")"

<route-custom-op> ::= "dest" "(" <register> ")" "op" "(" <identifier> <register> "," <operand> "," <operand> ")"
```

---

## Kernel Body

### Cycles

```ebnf
<labeled-cycle> ::= <label> ":" <cycle>

<cycle> ::= "cycle" "{" <cycle-body> "}"

<cycle-body> ::= <instruction-row>
               | <coordinate-instruction>
               | <column-instruction>
               | <inline-for-loop>
               | { <cycle-body-item> }+

<cycle-body-item> ::= <instruction-row>
                    | <coordinate-instruction>
                    | <column-instruction>
                    | <inline-for-loop>

<inline-for-loop> ::= "for" <identifier> "in" <range> "{" { <cycle-body-item> }* "}"

<instruction-row> ::= "row" <number> ":" <instruction-list> ";"

<coordinate-instruction> ::= <coordinate> ":" <instruction> ";"

<column-instruction> ::= "col" <number> ":" <instruction> ";"

<instruction-list> ::= <instruction> { "|" <instruction> }*
```

### Control Flow

```ebnf
<for-loop> ::= [ <pragma> ] "for" <identifier> "in" <range> "{" { <kernel-item> }* "}"

<range> ::= "range" "(" <expression> [ "," <expression> [ "," <expression> ] ] ")"

<while-loop> ::= [ <pragma> ] "while" "(" <condition> ")" "{" { <kernel-item> }* "}"

<if-else> ::= "if" "(" <condition> ")" "{" { <kernel-item> }* "}" [ "else" "{" { <kernel-item> }* "}" ]

<condition> ::= <operand> <comparison-op> <operand>

<comparison-op> ::= "==" | "!=" | "<" | ">" | "<=" | ">="
```

### Functions

```ebnf
<function-def> ::= [ <pragma> ] "function" <identifier> "(" [ <param-list> ] ")" "{" { <function-body-item> }* "}"

<param-list> ::= <param> { "," <param> }*

<param> ::= <identifier> [ ":" <type> ]

<type> ::= <identifier>

<function-body-item> ::= <cycle>
                       | <labeled-cycle>

<function-call> ::= <identifier> "(" [ <arg-list> ] ")"

<arg-list> ::= <expression> { "," <expression> }*
```

---

## Spatial Syntax

```ebnf
<coordinate> ::= "@" <row-expr> "," <col-expr>

<row-expr> ::= <number>
             | <identifier>
             | <expression>

<col-expr> ::= <number>
             | <identifier>
             | <expression>
```

---

## Instructions

```ebnf
<instruction> ::= <opcode> [ <operand-list> ]
                | "_"
                | /* empty */
                | <memory-assignment>

<opcode> ::= "NOP" | "EXIT"
           | "SADD" | "SSUB" | "SMUL" | "FXPMUL"
           | "LAND" | "LOR" | "LXOR" | "LNAND" | "LNOR" | "LXNOR"
           | "SLT" | "SRT" | "SRA"
           | "LWD" | "SWD" | "LWI" | "SWI"
           | "BSFA" | "BZFA"
           | "BEQ" | "BNE" | "BLT" | "BGE"
           | "JUMP"

<operand-list> ::= <operand> { "," <operand> }*

<memory-assignment> ::= <register> "=" <memory-ref>
                      | <memory-ref> "=" <register>

<memory-ref> ::= <array-access>
               | "[" <expression> "]"
```

---

## Operands

```ebnf
<operand> ::= <register>
            | <neighbor>
            | <immediate>
            | <data-ref>
            | <array-access>
            | <label>
            | <identifier>

<register> ::= "R0" | "R1" | "R2" | "R3" | "ROUT"

<neighbor> ::= "SELF" | "RCL" | "RCR" | "RCT" | "RCB"

<immediate> ::= "IMM" "(" <expression> ")"
              | <number>

<data-ref> ::= "data" "[" <expression> "]"

<array-access> ::= <identifier> "[" <expression> "]" [ "[" <expression> "]" ]

<array-property> ::= <identifier> "." <property-name> "(" ")"

<property-name> ::= "len" | "base" | "size" | "last" | "rows" | "cols"
```

---

## Expressions

```ebnf
<expression> ::= <term> { <additive-op> <term> }*

<term> ::= <factor> { <multiplicative-op> <factor> }*

<factor> ::= <number>
           | <identifier>
           | <array-property>
           | "(" <expression> ")"

<additive-op> ::= "+" | "-"

<multiplicative-op> ::= "*" | "/" | "%"
```

---

## Lexical Elements

### Identifiers

```ebnf
<identifier> ::= <letter> { <letter> | <digit> | "_" }*

<letter> ::= "a" | "b" | ... | "z" | "A" | "B" | ... | "Z"
```

### Numbers

```ebnf
<number> ::= <decimal-number> | <hex-number>

<decimal-number> ::= <digit> { <digit> }*

<hex-number> ::= "0x" <hex-digit> { <hex-digit> }*
               | "0X" <hex-digit> { <hex-digit> }*

<digit> ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

<hex-digit> ::= <digit> | "a" | "b" | "c" | "d" | "e" | "f"
              | "A" | "B" | "C" | "D" | "E" | "F"
```

### Strings

```ebnf
<string> ::= '"' { <string-char> }* '"'

<string-char> ::= <any-char-except-quote-or-backslash>
                | <escape-sequence>

<escape-sequence> ::= "\n" | "\t" | "\\" | '\"'
```

### Labels

```ebnf
<label> ::= <identifier>
```

### Comments

```ebnf
<comment> ::= <single-line-comment> | <multi-line-comment>

<single-line-comment> ::= "//" { <any-char> }* <newline>

<multi-line-comment> ::= "/*" { <any-char> }* "*/"
```

---

## Keywords

The following identifiers are reserved keywords and cannot be used as identifiers:

```
kernel, config, cycle, row, col, for, in, range, while, function, if, else
```

---

## Operators

### Arithmetic

```
+  -  *  /  %
```

### Comparison

```
==  !=  <  >  <=  >=
```

### Separators

```
;  :  |  ,  @  (  )  {  }  [  ]
```

---

## Special Symbols

| Symbol | Name | Usage |
|--------|------|-------|
| `_` | Underscore | Visual NOP placeholder in instruction lists |
| `@` | At symbol | Spatial coordinate prefix |
| `.` | Dot | Directive prefix or property accessor |
| `#` | Hash | Pragma prefix |

---

## Grammar Notes

1. **Case Sensitivity**: Keywords are case-insensitive. Register names and opcodes are case-insensitive. Identifiers are case-sensitive.

2. **Whitespace**: Whitespace (spaces, tabs, newlines) is ignored except where required to separate tokens.

3. **Comments**: Both single-line (`//`) and multi-line (`/* */`) comments are supported and are treated as whitespace.

4. **Coordinate Syntax**: The `@row,col` syntax provides absolute positioning within the PE grid.

5. **Pipe Syntax**: The `row N: inst1 | inst2 | inst3 | inst4` syntax represents instructions for columns 0-3 in the specified row.

6. **Expression Evaluation**: Expressions in directives, array indices, and loop bounds are evaluated at compile time.

7. **Label Resolution**: Labels are resolved to absolute cycle numbers during compilation. Both forward and backward references are supported.

8. **Function Expansion**: Function calls are expanded inline during compilation by default.

9. **Loop Unrolling**: For loops are unrolled by default unless `#pragma no_unroll` is specified.

10. **Array Properties**: Named arrays support compile-time property access (`.len()`, `.base()`, `.size()`, `.last()`, `.rows()`, `.cols()`).

---

## Example Program

```c
// Directives
.const MAX_ITER 10
.alias acc R1
.data input { 1, 2, 3, 4 }
.limit 100

// Function definition
function add_values(a, b) {
    cycle {
        @0,0: SADD R0, a, b;
    }
}

// Main kernel
kernel "Example" {
    config(0xF, 0);

    // For loop with pragma
    #pragma parallel
    for i in range(input.len()) {
        cycle {
            @0,i: LWI R0, input[i];
        }
    }

    // While loop
    while (R0 < IMM(MAX_ITER)) {
        cycle {
            row 0: SADD R0, R0, IMM(1) | _ | _ | _;
        }
    }

    // Labeled cycle
    end:
    cycle {
        @0,0: EXIT;
    }
}
```

---

## Navigation

- [← Compilation](05-compilation.md)
- [Index](../README.md)
