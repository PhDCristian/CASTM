# Plan: Nuevas Características para OpenEdge-DSL

## Contexto
El DSL actual ya tiene buena cobertura de características básicas. El usuario trabaja principalmente con algoritmos criptográficos (Barrett, S-box), donde el **routing de datos entre PEs** y la **composición de kernels** son los principales pain points.

---

## Fase 1: Comunicación y Routing (Prioridad Alta)

### 1.1 `#pragma broadcast` - Difusión a Múltiples PEs

**Problema**: Cargar el mismo valor en múltiples columnas requiere repetición manual.

**Sintaxis**:
```c
// Broadcast a toda una fila (propaga por RCL/RCR)
#pragma broadcast(value=R0, from=(0,0), to=row)
// Genera: @1,0: SADD R0, RCL, ZERO; @2,0: SADD R0, RCL, ZERO; @3,0: SADD R0, RCL, ZERO;

// Broadcast a toda una columna (propaga por RCT/RCB)
#pragma broadcast(value=R0, from=(0,0), to=column)

// Broadcast a todos los PEs (fila + columna)
#pragma broadcast(value=R0, from=(0,0), to=all)
```

**Implementación**:
- Parsear pragma en `dsl-compiler.ts`
- Generar ciclos con `SADD Rx, RCx, ZERO` en cadena
- Calcular número de ciclos según distancia

---

### 1.2 `route` - Routing Multi-Hop (Sintaxis Mixta)

**Problema**: Mover datos entre PEs no adyacentes requiere escribir manualmente cada hop.

**Sintaxis Aprobada** (mezcla de `move` y estilo declarativo):
```c
// Sintaxis principal: route con notación @PE.registro
route @0,0.R0 to @3,3.R1;                    // Automático (ruta óptima)
route @0,0.R0 to @3,3.R1 via horizontal;     // Primero horizontal, luego vertical
route @0,0.R0 to @3,3.R1 via vertical;       // Primero vertical, luego horizontal
route @0,0.R0 to @3,3.R1 via shortest;       // Explícitamente ruta más corta (default)

// Variante con alias de registros
route @src.data to @dest.result;             // Usando alias definidos

// Routing guiado con waypoints (avanzado)
route @0,0.R0 to @3,3.R1 via [(1,1), (2,2)]; // Ruta específica por waypoints
```

**Comportamiento**:
- El compilador calcula la ruta óptima usando `toroidal-routing.ts`
- Genera automáticamente los ciclos necesarios con `SADD ROUT, RCx, ZERO`
- El registro destino puede ser diferente al origen
- Soporta tanto routing automático como guiado

**Implementación**:
- Nueva keyword `route` en tokenizer
- Parser para sintaxis `@col,row.register`
- Integrar `calculateOptimalRoute()` de `toroidal-routing.ts`
- Generar instrucciones intermedias automáticamente
- Manejar opciones `via` para preferencias de ruta

---

### 1.3 `#pragma rotate` / `#pragma shift` - Movimiento de Datos

**Sintaxis**:
```c
// Rotar valores en una fila (con wraparound toroidal)
#pragma rotate(direction=left, amount=1, row=0, register=R0)
// Col0←Col1; Col1←Col2; Col2←Col3; Col3←Col0

#pragma rotate(direction=right, amount=2, row=0, register=R0)

// Shift (sin wraparound, introduce cero)
#pragma shift(direction=left, amount=1, row=0, register=R0)
// Col0←Col1; Col1←Col2; Col2←Col3; Col3←0
```

**Implementación**:
- Similar a broadcast pero con direccionalidad
- Genera cadena de `SADD Rx, RCL/RCR, ZERO`
- Para shift: último PE usa `SADD Rx, ZERO, ZERO`

---

## Fase 2: Composición de Kernels (Prioridad Alta)

### 2.1 `kernel_module` + `inline` - Kernels Componibles

**Problema**: No se pueden combinar kernels (ej: Barrett → S-box) sin overhead de EXIT/reinicio.

**Sintaxis**:
```c
// Definir módulo reutilizable
kernel_module barrett_reduce(input: R0, output: R1) {
    cycle { @0,0: SMUL R2, R0, MU; }
    cycle { @0,0: SRT R2, R2, IMM(16); }
    cycle { @0,0: SADD R1, R0, R2; }
}

kernel_module sbox_lookup(input: R0, output: R1) {
    cycle { @0,0: LWI R1, SBOX_BASE; }
    cycle { @0,0: SADD R1, R1, R0; }
    cycle { @0,0: LWI R1, R1; }
}

// Kernel principal que compone módulos
kernel "crypto_pipeline" {
    config(0xF, 0);

    cycle { @0,0: LWI R0, data[0]; }

    // Inline de Barrett (ciclos se insertan aquí, cero overhead)
    inline barrett_reduce(input=R0, output=R1);

    // Inline de S-box (ciclos continúan secuencialmente)
    inline sbox_lookup(input=R1, output=R2);

    cycle { @0,0: SWI R2, result[0]; }
    cycle { @0,0: EXIT; }
}
```

**Comportamiento**:
- `inline` expande el módulo in-place (cero overhead)
- Los parámetros se sustituyen textualmente
- Los ciclos se numeran secuencialmente
- Labels internos se prefijan para evitar colisiones

**Implementación**:
- Nueva keyword `kernel_module` en tokenizer
- Almacenar módulos en symbol table con sus parámetros
- `inline` busca módulo y expande sus tokens
- Renombrar labels: `label` → `_modulename_label`

---

## Fase 3: Mejoras en Pragmas Existentes (Prioridad Media)

### 3.1 Mejoras en `#pragma reduce`

**Problema actual**: `#pragma reduce` solo soporta ADD y MUL.

**Mejoras propuestas**:
```c
// Operación XOR (útil para criptografía)
#pragma reduce(op=XOR, src=R0, dest=R1, row=0)
// Col0 XOR Col1 XOR Col2 XOR Col3 → resultado en Col3.R1

// Selección de fila específica
#pragma reduce(op=ADD, src=R0, dest=R1, row=2)
// Solo reduce la fila 2

// Reducción por columna (vertical)
#pragma reduce(op=ADD, src=R0, dest=R1, column=0)
// Row0 + Row1 + Row2 + Row3 → resultado en Row3.R1

// Operaciones adicionales
#pragma reduce(op=AND, src=R0, dest=R1, row=0)  // AND lógico
#pragma reduce(op=OR, src=R0, dest=R1, row=0)   // OR lógico
#pragma reduce(op=MIN, src=R0, dest=R1, row=0)  // Mínimo
#pragma reduce(op=MAX, src=R0, dest=R1, row=0)  // Máximo
```

**Implementación**:
- Extender `generateReduceTokens()` en `dsl-compiler.ts`
- Añadir casos para XOR, AND, OR, MIN, MAX
- Añadir soporte para reducción vertical (por columna)

---

### 3.2 `#pragma pipeline` - Procesamiento de Streams

**Problema**: Procesar múltiples datos requiere replicar código manualmente.

**Sintaxis**:
```c
// Pipeline de profundidad 4 (4 datos en vuelo simultáneamente)
#pragma pipeline(depth=4) {
    // Etapa 1: Cargar dato
    stage(0) {
        @0,0: LWI R0, input[i];   // i = índice del stream
    }

    // Etapa 2: Procesar
    stage(1) {
        @1,0: SMUL R1, R0, coef;
    }

    // Etapa 3: Reducir
    stage(2) {
        @2,0: SADD R2, R1, acc;
    }

    // Etapa 4: Almacenar
    stage(3) {
        @3,0: SWI R2, output[i];
    }
}
```

**Comportamiento**:
- El compilador genera código para mantener `depth` datos en vuelo
- Cada etapa se ejecuta en un PE diferente (pipeline espacial)
- Automáticamente inserta ciclos de "relleno" al inicio y "vaciado" al final
- Variable `i` disponible para índices de stream

**Implementación**:
- Nueva directiva `#pragma pipeline(depth=N)`
- Parser para bloques `stage(n) { ... }`
- Generar código de prólogo (filling) y epílogo (draining)
- Gestionar dependencias entre etapas

---

## Fase 4: Control de Flujo Avanzado (Prioridad Media)

### 4.1 `switch` Statement - Selección Múltiple

**Problema**: Múltiples condiciones if-else-if son verbosas y difíciles de leer.

**Sintaxis**:
```c
// Switch básico (implementado con saltos)
switch (R0) {
    case 0:
        @0,0: SADD R1, ZERO, IMM(100);
        break;
    case 1:
        @0,0: SADD R1, ZERO, IMM(200);
        break;
    case 2:
        @0,0: SADD R1, ZERO, IMM(300);
        break;
    default:
        @0,0: SADD R1, ZERO, IMM(0);
}

// Switch con rangos (optimización)
switch (R0) {
    case 0..3:   // Rango 0-3
        @0,0: SADD R1, R0, IMM(10);
        break;
    case 4..7:   // Rango 4-7
        @0,0: SMUL R1, R0, IMM(2);
        break;
    default:
        @0,0: NOP;
}
```

**Implementación con Jump Table**:
```assembly
// Código generado para switch(R0) con casos 0,1,2
    BLT R0, 0, _default      // Si R0 < 0, ir a default
    BGE R0, 3, _default      // Si R0 >= 3, ir a default
    JUMP _case_table[R0]     // Salto indexado (si ISA lo soporta)
    // O alternativamente:
    BEQ R0, 0, _case_0
    BEQ R0, 1, _case_1
    BEQ R0, 2, _case_2
    JUMP _default
_case_0:
    SADD R1, ZERO, IMM(100)
    JUMP _end_switch
_case_1:
    SADD R1, ZERO, IMM(200)
    JUMP _end_switch
_case_2:
    SADD R1, ZERO, IMM(300)
    JUMP _end_switch
_default:
    SADD R1, ZERO, IMM(0)
_end_switch:
```

**Optimizaciones**:
- Para casos consecutivos: usar salto indexado si la ISA lo permite
- Para casos dispersos: usar cadena de BEQ
- Detectar casos sin break (fall-through) y generar código continuo

**Implementación**:
- Nueva keyword `switch`, `case`, `default`, `break` en tokenizer
- Parser para estructura switch-case
- Análisis de casos para elegir estrategia de saltos
- Generar labels únicos: `_switch_N_case_X`, `_switch_N_default`, `_switch_N_end`

---

## Fase 5: Sintaxis Simplificada (Prioridad Baja)

### 5.1 Rangos de PEs en Coordenadas

**Sintaxis**:
```c
// Aplicar misma instrucción a múltiples PEs
cycle {
    @[0-3],0: LWI R0, data[col];  // col = 0,1,2,3 para cada PE
}

// También soporta:
@[0,2],0: ...   // Solo columnas 0 y 2
@[0-1],[0-1]: ... // Cuadrante 2x2
```

**Implementación**:
- Expandir rangos en parser
- Variable especial `col` y `row` disponibles en contexto de rango
- Generar instrucciones individuales por PE

---

### 5.2 `#pragma gather` / `#pragma scatter`

**Sintaxis**:
```c
// Gather: cargar valores de direcciones dispersas en paralelo
#pragma gather(base=data, indices=[0,4,8,12], dest=R0)
// Col0: LWI R0, data[0]; Col1: LWI R0, data[4]; ...

// Scatter: almacenar en direcciones dispersas
#pragma scatter(src=R0, base=result, indices=[0,4,8,12])
// Col0: SWI R0, result[0]; Col1: SWI R0, result[4]; ...
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/utils/dsl-compiler.ts` | route, switch, pragmas mejorados, kernel_module |
| `src/utils/dsl-language-service.ts` | Autocomplete y validación |
| `src/utils/toroidal-routing.ts` | Integrar en compilación |
| `docs/OpenEdgeDSL/OPENEDGE_DSL_SPEC.md` | Documentar nuevas características |

---

## Orden de Implementación Revisado

### Iteración 1: Routing Básico
1. `#pragma broadcast` (~100-150 líneas)
2. `route @PE.reg to @PE.reg` básico (~200-300 líneas)

### Iteración 2: Composición de Kernels
3. `kernel_module` + `inline` (~300-400 líneas)

### Iteración 3: Control de Flujo
4. `switch` statement (~200-250 líneas)

### Iteración 4: Mejoras en Pragmas
5. `#pragma reduce` con XOR, AND, OR, MIN, MAX (~100-150 líneas)
6. `#pragma pipeline(depth=N)` (~250-350 líneas)

### Iteración 5: Routing Avanzado
7. `route` con opciones `via` (~100-150 líneas)
8. `#pragma rotate/shift` (~100-150 líneas)

### Iteración 6: Utilidades
9. Rangos de PEs `@[0-3],0` (~100-150 líneas)
10. `#pragma gather/scatter` (~150-200 líneas)

---

## Complejidad Estimada Total

| Característica | Complejidad | Líneas |
|----------------|-------------|--------|
| `#pragma broadcast` | Baja | ~100-150 |
| `route` básico | Media | ~200-300 |
| `route` con `via` | Baja | ~100-150 |
| `kernel_module` + `inline` | Media-Alta | ~300-400 |
| `switch` statement | Media | ~200-250 |
| `#pragma reduce` mejoras | Baja | ~100-150 |
| `#pragma pipeline` | Media-Alta | ~250-350 |
| `#pragma rotate/shift` | Baja | ~100-150 |
| Rangos de PEs | Baja | ~100-150 |
| `#pragma gather/scatter` | Baja-Media | ~150-200 |
| **Total** | | **~1600-2250** |

---

## Notas de Implementación

- Ya existe `#pragma reduce` y `#pragma stencil` - seguir mismo patrón
- `toroidal-routing.ts` tiene `calculateOptimalRoute()` listo para usar
- `generateReduceTokens()` y `generateStencilTokens()` son buenos ejemplos
- El tokenizer ya soporta `#pragma` - solo añadir nuevos tipos
- Para `switch`: analizar si la ISA soporta salto indexado o usar cadena de BEQ
