# OpenEdge-DSL Compiler

Compilador para el lenguaje de dominio específico OpenEdge-DSL, que genera código para el simulador CGRA.

## Arquitectura

```
src/core/dsl/
├── index.ts                    # Punto de entrada y API pública (compile, parse)
│
├── types/                      # Definiciones de tipos
│   ├── tokens.ts               # TokenType enum, Token interface
│   ├── ast.ts                  # CycleBlock, Instruction, PeLocation, Assertion, etc.
│   ├── symbols.ts              # SymbolTable, NamedArray, constantes y aliases
│   ├── errors.ts               # Diagnostic, DiagnosticSeverity, ErrorCodes
│   └── index.ts                # Re-exportaciones
│
├── lexer/                      # Análisis léxico
│   ├── lexer.ts                # tokenize() - convierte código en tokens
│   ├── patterns.ts             # Patrones regex y detección de caracteres
│   └── index.ts                # Re-exportaciones
│
├── parser/                     # Análisis sintáctico
│   ├── parser-state.ts         # ParserState - estado del parser (AST, símbolos, ciclos)
│   ├── token-stream.ts         # TokenStream - wrapper para navegación de tokens
│   ├── cycle-parser.ts         # Parsing de bloques cycle {}
│   ├── instruction-parser.ts   # Parsing de instrucciones individuales
│   ├── for-loop-parser.ts      # Parsing de for loops con range()
│   ├── while-loop-parser.ts    # Parsing de while loops
│   ├── if-else-parser.ts       # Parsing de if-else
│   ├── directive-parser.ts     # Parsing de directivas (.const, .data, .alias, etc.)
│   ├── pragma-parser.ts        # Parsing de pragmas (#pragma parallel, route, etc.)
│   ├── route-generator.ts      # Generador de routing toroidal para #pragma route
│   ├── function-parser.ts      # Parsing de funciones y kernels
│   ├── control-flow-utils.ts   # Utilidades para control de flujo
│   ├── pattern-generators.ts   # Generadores de patrones de código
│   └── index.ts                # Re-exportaciones
│
├── semantic/                   # Análisis semántico
│   ├── symbol-resolver.ts      # Resolución de símbolos y constantes
│   ├── operand-substitution.ts # Sustitución de operandos (aliases, constants)
│   └── index.ts                # Re-exportaciones
│
├── codegen/                    # Generación de código
│   ├── csv-generator.ts        # Genera CSV final para el simulador
│   ├── instruction-emitter.ts  # Formateo de instrucciones, makeCoordKey()
│   └── index.ts                # Re-exportaciones
│
├── diagnostics/                # Validación y errores
│   ├── validator.ts            # Validación de bounds, coordenadas, etc.
│   └── index.ts                # Re-exportaciones
│
└── utils/                      # Utilidades
    ├── expression.ts           # Evaluación de expresiones aritméticas
    ├── string-utils.ts         # Parsing de strings con comillas
    ├── source-location.ts      # Tracking de ubicaciones en código fuente
    └── index.ts                # Re-exportaciones
```

## Pipeline de compilación

```
Código fuente DSL
       │
       ▼
┌──────────────┐
│    LEXER     │  lexer.ts: tokenize()
│              │  Código → Token[]
└──────────────┘
       │
       ▼
┌──────────────┐
│    PARSER    │  parser-state.ts + *-parser.ts
│              │  Token[] → AST (CycleBlock[])
└──────────────┘
       │
       ▼
┌──────────────┐
│   SEMANTIC   │  symbol-resolver.ts, operand-substitution.ts
│              │  Resolución de símbolos, constantes, aliases
└──────────────┘
       │
       ▼
┌──────────────┐
│   CODEGEN    │  csv-generator.ts, instruction-emitter.ts
│              │  AST → CSV para simulador
└──────────────┘
       │
       ▼
  Salida CSV
```

## Representación de coordenadas

Las coordenadas PE se representan como strings `"row,col"` en los Maps:

```typescript
// En ast.ts
interface CycleBlock {
  cycleNumber: number;
  label?: string;
  instructions: Map<string, Instruction>;  // Key: "row,col" ej: "0,0", "1,2"
}

// En instruction-emitter.ts
function makeCoordKey(row: number, col: number): string {
  return `${row},${col}`;
}

function parseCoordKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}
```

## Tipos clave

### Token (tokens.ts)
```typescript
interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

enum TokenType {
  KEYWORD,      // for, while, if, cycle, etc.
  IDENTIFIER,   // nombres de variables, registros
  NUMBER,       // literales numéricos
  STRING,       // strings con comillas
  OPERATOR,     // +, -, *, /, etc.
  AT_SYMBOL,    // @ para coordenadas
  DIRECTIVE,    // .const, .data, etc.
  PRAGMA,       // #pragma
  // ...
}
```

### Instruction (ast.ts)
```typescript
interface Instruction {
  opcode: string;
  dest?: string;
  srcA?: string;
  srcB?: string;
  immediate?: number;
  label?: string;
}
```

### CycleBlock (ast.ts)
```typescript
interface CycleBlock {
  cycleNumber: number;
  label?: string;
  instructions: Map<string, Instruction>;  // Key: "row,col"
}
```

### SymbolTable (symbols.ts)
```typescript
interface SymbolTable {
  constants: Map<string, string>;      // .const NAME VALUE
  aliases: Map<string, string>;        // .alias NAME REG
  namedArrays: Map<string, NamedArray>; // .data NAME { values }
  labels: Map<string, number>;         // label: → cycle number
}
```

## Expansión de loops

Los for loops se expanden en tiempo de compilación mediante tres estrategias:

### 1. generateUnrolledLoop() (default)
Expansión completa: cada iteración genera ciclos separados.
```
for i in range(4) { cycle { @0,0: SADD R0, ZERO, i; } }
↓
cycle { @0,0: SADD R0, ZERO, IMM(0); }
cycle { @0,0: SADD R0, ZERO, IMM(1); }
cycle { @0,0: SADD R0, ZERO, IMM(2); }
cycle { @0,0: SADD R0, ZERO, IMM(3); }
```

### 2. generateParallelLoop() (#pragma parallel)
Distribución paralela: iteraciones en diferentes PEs.
```
#pragma parallel
for i in range(4) { cycle { @i,0: SADD R0, ZERO, i; } }
↓
cycle {
  @0,0: SADD R0, ZERO, IMM(0);
  @1,0: SADD R0, ZERO, IMM(1);
  @2,0: SADD R0, ZERO, IMM(2);
  @3,0: SADD R0, ZERO, IMM(3);
}
```

### 3. generateRuntimeLoop() (#pragma no_unroll)
Loop en tiempo de ejecución con branch/jump.

## Coordenadas dinámicas

El compilador soporta variables de loop como coordenadas PE:

```c
// Sin pragma: expansión secuencial
for i in range(4) {
    cycle { @i,0: SADD R0, ZERO, i; }  // 4 ciclos separados
}

// Con pragma parallel: colapso en un ciclo
#pragma parallel
for i in range(4) {
    for j in range(4) {
        cycle { @i,j: SADD R0, ZERO, i; }  // 1 ciclo, 16 PEs
    }
}
```

### Expresiones en coordenadas
```c
@i+1,j      // Offset
@i*2,j      // Stride
@k%4,k/4    // Mapeo lineal a 2D
@j,i        // Transposición
@N-1,0      // Constantes
```

## API pública

```typescript
import { compile, parse } from '@core/dsl';

// Compilar a CSV
const csv = compile(dslCode, { gridWidth: 4, gridHeight: 4 });

// Solo parsear (obtener AST)
const { cycles, symbols, diagnostics } = parse(dslCode);
```

## Diagnósticos

El compilador emite diagnósticos con información de ubicación:

```typescript
interface Diagnostic {
  severity: DiagnosticSeverity;  // Error, Warning, Info
  message: string;
  range: SourceRange;
  code?: string;  // ErrorCode
}
```

Códigos de error comunes:
- `UNDEFINED_SYMBOL`: Variable/constante no definida
- `OUT_OF_BOUNDS`: Coordenada fuera del grid
- `COLLISION`: Múltiples instrucciones en mismo PE (con #pragma parallel)
- `DIVISION_BY_ZERO`: División por cero en expresión de coordenada
