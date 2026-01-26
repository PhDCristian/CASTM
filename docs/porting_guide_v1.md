# OpenEdgeDSL Porting Guide: generator_standalone.py → OpenEdgeDSL

**Fecha**: 2026-01-07  
**Versión**: 1.0  
**Objetivo**: Documentar los requisitos para portar `generator_standalone.py` a OpenEdgeDSL

---

## 1. Contexto

### 1.1 ¿Qué es generator_standalone.py?

Un generador de código CGRA escrito en Python (~4800 líneas) que implementa:
- **Barrett Modular Exponentiation** para criptografía (BabyBear prime)
- Optimizaciones de routing toroidal en mesh 4x4
- Paralelismo a nivel de instrucción (ILP) maximizado

### 1.2 ¿Qué es OpenEdgeDSL?

Un lenguaje de dominio específico (DSL) v1.0 para programar OpenEdgeCGRA:
- Sintaxis tipo C/Verilog
- Modelo espacial-temporal (ciclos × filas × columnas)
- Compilación 1:1 a formato CSV del simulador

---

## 2. Arquitectura del Generador Python

### 2.1 Módulos Principales

```
generator_standalone.py
├── InstructionBuilder      # Emisión de instrucciones
├── LabelManager            # Etiquetas y saltos
├── TileMesh                # Routing toroidal (RCL/RCR/RCT/RCB)
├── AccumulatorRouting      # Init/flush de acumuladores distribuidos
├── MemoryOps               # Zeroing paralelo de memoria
├── ByteExtraction          # Extracción de bytes 32-bit → 4×8-bit
├── BasicOps                # Normalización, operaciones básicas
├── ModularOps              # Operaciones modulares (add, double, mul256)
├── Multiplication          # Productos parciales, acumulación
├── Squaring                # Cuadrado optimizado (10 productos únicos)
├── LimbConversion          # Base 2^8 → Base 2^16
├── QuotientApproximation   # Cálculo de q̂ (Barrett)
├── RemainderComputation    # Cálculo de r = x - q̂·p
└── CGRACodeGenerator       # Orquestador principal
```

### 2.2 Patrones de Programación Clave

#### Patrón 1: Meta-programación con loops Python
```python
# Python genera instrucciones para los 4 bytes
for i in range(4):
    self.gen.add_line(f"LWI R0, {A_BYTES[i]}")
```

→ OpenEdgeDSL v1.0 equivalente:
```c
for i in range(4) {
    cycle { @0,i: LWI R0, A[i]; }
}
```

#### Patrón 2: Emisión multi-fila
```python
# Python emite a las 4 filas simultáneamente
row_maps = [{j: "LWI R0, X" for j in range(4)} for _ in range(4)]
self.gen.add_rows_from_maps(row_maps)
```

→ OpenEdgeDSL v1.0 equivalente:
```c
cycle {
    row 0: LWI R0, X | LWI R0, X | LWI R0, X | LWI R0, X;
    row 1: LWI R0, X | LWI R0, X | LWI R0, X | LWI R0, X;
    row 2: LWI R0, X | LWI R0, X | LWI R0, X | LWI R0, X;
    row 3: LWI R0, X | LWI R0, X | LWI R0, X | LWI R0, X;
}
```

#### Patrón 3: Routing Toroidal (⚠️ CRÍTICO)
```python
# Python calcula ruta automáticamente
self.mesh.route_add(src=(0,1), dst=(2,3), payload="R2", accum="R3")
# Genera: SADD ROUT, R2, ZERO → Forwards → SADD R3, R3, RCL
```

→ OpenEdgeDSL v1.0: **NO HAY EQUIVALENTE DIRECTO**  
Workaround manual (verboso y propenso a errores):
```c
// Ruta (0,1) → (0,2) → (0,3) → (1,3) → (2,3)
cycle { @0,1: SADD ROUT, R2, ZERO; }      // Send
cycle { @0,2: SADD ROUT, RCL, ZERO; }     // Forward
cycle { @0,3: SADD ROUT, RCL, ZERO; }     // Forward
cycle { @1,3: SADD ROUT, RCT, ZERO; }     // Forward (vertical)
cycle { @2,3: SADD R3, R3, RCT; }         // Accumulate
```

---

## 3. Capacidades de OpenEdgeDSL v1.0

### 3.1 ✅ Soportado

| Característica | Sintaxis | Notas |
|---------------|----------|-------|
| Constantes | `.const NAME VALUE` | Reemplazo textual |
| Aliases | `.alias name REG` | Nombres semánticos |
| Named arrays | `.data arr { 1,2,3 }` | Acceso: `arr[i]` |
| Propiedades | `arr.len()`, `arr.base()` | Compile-time |
| Ciclos | `cycle { ... }` | Auto-incrementales |
| Row visual | `row N: A \| B \| C \| D;` | Datos densos |
| Row estructural | `row N { col M: X; }` | Datos sparse |
| Coordenadas | `@row,col: INSTR;` | Punto específico |
| Funciones | `function F(p) { }` | Inlining automático |
| For loops | `for i in range(N) { }` | Unroll compile-time |
| While loops | `while (cond) @r,c { }` | Runtime branches |
| Labels/Branches | `label: cycle { }`, `JUMP label` | Forward/backward |
| `#pragma parallel` | Sobre for loops | Distribución en cols |
| `#pragma reduce` | Después de parallel | Tree reduction |

### 3.2 ❌ NO Soportado (Gaps)

| Gap | Impacto | Descripción |
|-----|---------|-------------|
| **G1: Routing abstracto** | 🔴 Crítico | No hay `route(src, dst)` |
| **G2: Cálculo dinámico de rutas** | 🔴 Crítico | Rutas toroidales manuales |
| **G3: Coords con expresiones** | 🟡 Alto | `@i+1,j*2:` no funciona |
| **G4: Constantes computadas** | 🟢 Medio | `.const X BASE+60` no funciona |

---

## 4. Análisis de Viabilidad por Módulo

| Módulo | Viabilidad | Notas |
|--------|------------|-------|
| InstructionBuilder | ✅ 100% | Implícito en DSL |
| LabelManager | ✅ 100% | Labels nativos |
| **TileMesh** | ❌ 0% | **Requiere extensión** |
| AccumulatorRouting | 🟡 60% | Routing manual necesario |
| MemoryOps | ✅ 90% | `#pragma parallel` |
| ByteExtraction | ✅ 90% | Funciones + loops |
| BasicOps | ✅ 80% | Funciones |
| ModularOps | ✅ 85% | Funciones |
| Multiplication | ❌ 30% | Routing complejo |
| Squaring | ❌ 30% | Routing complejo |
| LimbConversion | 🟡 70% | Carry chain expresable |
| QuotientApprox | ❌ 40% | Multi-row routing |
| RemainderComp | ❌ 40% | Pipelining complejo |

---

## 5. Mejoras Propuestas para OpenEdgeDSL

### 5.1 P0: `#pragma route` (Crítico)

**Propósito**: Abstracción de routing toroidal automático.

```c
// Sintaxis propuesta
#pragma route (src_row, src_col) -> (dst_row, dst_col) payload(REG) accum(REG)

// Ejemplo de uso
#pragma route (0,1) -> (2,3) payload(R2) accum(R3)
```

**Semántica**:
1. Compilador calcula ruta más corta en torus 4x4
2. Genera instrucciones SADD/ROUT intermedias
3. Añade acumulación final con registros especificados

**Implementación sugerida**:
```python
def generate_route(src, dst, payload, accum):
    path = compute_toroidal_path(src, dst)  # Lista de (row, col)
    for i, (r, c) in enumerate(path):
        if i == 0:
            emit(r, c, f"SADD ROUT, {payload}, ZERO")
        elif i < len(path) - 1:
            neighbor_reg = incoming_register(path[i-1], (r,c))
            emit(r, c, f"SADD ROUT, {neighbor_reg}, ZERO")
        else:
            neighbor_reg = incoming_register(path[i-1], (r,c))
            emit(r, c, f"SADD {accum}, {accum}, {neighbor_reg}")
```

### 5.2 P1: Expresiones en Coordenadas

**Actual** (limitado):
```c
for i in range(4) {
    cycle { @i,0: SADD R0, R0, R1; }  // OK
}
```

**Propuesto**:
```c
for i in range(4) {
    cycle { @i, (i+1)%4: SADD R0, R0, R1; }  // Expresión matemática
}
```

### 5.3 P2: Constantes Computadas

**Propuesto**:
```c
.const BASE 300
.const L_OFFSET BASE + 60     // = 360
.const STRIDE 4
.const L_SIZE STRIDE * 5      // = 20
```

---

## 6. Ejemplo de Port Parcial: ByteExtraction

### 6.1 Código Python Original
```python
def extract_bytes_to_mem(self, in_addr: int, out_bases: List[int]):
    self.gen.add_line(
        f"LWI R0, {in_addr}", f"LWI R0, {in_addr}", 
        f"LWI R0, {in_addr}", f"LWI R0, {in_addr}"
    )
    self.gen.add_line(
        "LAND R3, R0, 255", "SRT R3, R0, 8", 
        "SRT R1, R0, 16", "SRT R3, R0, 24"
    )
    self.gen.add_line(
        f"SWI R3, {out_bases[0]}", "LAND R3, R3, 255", 
        "LAND R1, R1, 255", "LAND R3, R3, 255"
    )
    self.gen.add_line(
        "NOP", f"SWI R3, {out_bases[1]}", 
        f"SWI R1, {out_bases[2]}", f"SWI R3, {out_bases[3]}"
    )
```

### 6.2 OpenEdgeDSL v1.0 Equivalente
```c
// Definición como función reutilizable
function EXTRACT_BYTES(in_addr, out0, out1, out2, out3) {
    // Cycle 1: Load word into all columns
    cycle {
        row 0: LWI R0, in_addr | LWI R0, in_addr | LWI R0, in_addr | LWI R0, in_addr;
    }
    
    // Cycle 2: Extract bytes in parallel
    cycle {
        row 0: LAND R3, R0, 255 | SRT R3, R0, 8 | SRT R1, R0, 16 | SRT R3, R0, 24;
    }
    
    // Cycle 3: Store byte 0, mask others
    cycle {
        row 0: SWI R3, out0 | LAND R3, R3, 255 | LAND R1, R1, 255 | LAND R3, R3, 255;
    }
    
    // Cycle 4: Store bytes 1, 2, 3
    cycle {
        row 0: _ | SWI R3, out1 | SWI R1, out2 | SWI R3, out3;
    }
}

// Uso
kernel "ByteExtractionDemo" {
    config(0xF, 0);
    
    .data input 0 { 0x12345678 }
    .data output 100 { 0, 0, 0, 0 }
    
    EXTRACT_BYTES(0, 100, 104, 108, 112);
    
    cycle { @0,0: EXIT; }
}
```

---

## 7. Plan de Implementación Incremental

### Fase 1: Port de Módulos Simples (Sin routing)
1. `ByteExtraction.extract_bytes_to_mem` → Función DSL
2. `MemoryOps.zero_addresses_parallel` → `#pragma parallel`
3. `ModularOps.safe_add_mod` → Función DSL (usa BSFA)

### Fase 2: Implementar `#pragma route`
1. Diseñar gramática del pragma
2. Implementar `compute_toroidal_path()` en compilador
3. Generar código de routing automático
4. Tests con casos simples (1-hop, 2-hop, wrap-around)

### Fase 3: Port de Módulos con Routing
1. `AccumulatorRouting.init_accumulators` → `#pragma parallel collapse`
2. `AccumulatorRouting.flush_accumulators` → `#pragma route`
3. `Squaring.accumulate_c_square_inregs_and_route` → Múltiples `#pragma route`

### Fase 4: Port Completo
1. `LimbConversion` (carry chain)
2. `QuotientApproximation` (multi-row routing)
3. `RemainderComputation` (borrow chain pipelined)
4. `CGRACodeGenerator` (orquestación)

---

## 8. Verificación

### 8.1 Tests Unitarios
Para cada módulo portado:
```c
// Test assertion syntax
.assert { cycle: 5, location: 0,0, register: R3, value: 0x78 }
```

### 8.2 Comparación con Simulador
1. Generar CSV con Python (baseline)
2. Compilar OpenEdgeDSL a CSV
3. Ejecutar ambos en simulador
4. Comparar resultados ciclo a ciclo

---

## 9. Referencias

- **OpenEdgeDSL Docs**: `docs/docs/OpenEdgeDSL/`
  - [Spec](docs/docs/OpenEdgeDSL/spec/)
  - [Features](docs/docs/OpenEdgeDSL/features/)
  - [Examples](docs/docs/OpenEdgeDSL/examples/)
  
- **Generador Python**: `examples/sbox_barrett/generator_standalone.py`

- **Knowledge Item**: [Scalable Modular Arithmetic Hardware Design](~/.gemini/antigravity/knowledge/modular_arithmetic_hardware_design/)
