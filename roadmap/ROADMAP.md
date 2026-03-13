# ROADMAP CASTM (4 sprints) — Baseline + mejoras de lenguaje

Fecha de actualización: 2026-02-19

## Resumen
- Entregable: `CASTM/roadmap/ROADMAP.md`.
- Objetivo funcional: añadir mejoras reales del lenguaje con integración completa, tests específicos por sprint y gate de cobertura global al 100%.
- Baseline detectado antes de arrancar features:
  - 3 tests rojos iniciales en `tests/branch-coverage-round3.test.ts:284`, `tests/issues/feat-18-expansion-mode.test.ts:60`, `tests/issues/feat-18-expansion-mode.test.ts:136`.
  - Gate de cobertura previo < 100% (`vitest.config.ts` estaba en 70/70/80/60).
- Decisiones fijadas: 4 sprints, labels en `for/if/while`, cobertura global 100%, estabilización primero.

## Reglas de estado y cierre
- Estados permitidos por tarea: `todo`, `in_progress`, `blocked`, `done`.
- Regla de cierre por tarea: solo puede pasar a `done` si su test asociado está verde en CI y no rompe cobertura global 100%.
- Regla global: no cerrar sprint/roadmap sin evidencia ejecutable (archivo tocado + test verde).

## Estado de validación local (última ejecución)
- `npm run test`: ✅ verde (`75/75` archivos, `449/449` tests).
- `npm run test:coverage`: ✅ verde (`lines/statements/functions/branches = 100/100/100/100`).
- `npm run check:boundaries`: ✅ verde.
- `(cd docs-site && npm run docs:validate)`: ✅ verde.
- Nota técnica: `docs-site/package.json` dejó de usar `npx tsx` y ahora usa `vite-node` local para validación reproducible sin depender de red.

---

## Sprint 1 — Estabilización y gate de calidad

### Objetivo
Dejar baseline estable, eliminar ambigüedad del contrato `JUMP`, y endurecer gates de calidad antes de seguir con features.

### Tareas

#### T1.1 Corregir baseline rojo y dejar suite verde sin nuevas features
- Estado: `done`
- Subtareas:
  - Alinear expectativas de tests rojos con el lowering real.
  - Revalidar la suite completa local.
- Evidencia mínima:
  - Archivo tocado: `tests/branch-coverage-round3.test.ts`
  - Test asociado: `npm run test` (incluye `tests/branch-coverage-round3.test.ts` y `tests/issues/feat-18-expansion-mode.test.ts`)

#### T1.2 Normalizar contrato `JUMP` en código, comentarios y docs
- Estado: `done`
- Subtareas:
  - Unificar convención `JUMP pred, label` en especificación y docs.
  - Eliminar expectativas contradictorias en referencias.
- Evidencia mínima:
  - Archivo tocado: `packages/lang-spec/src/instruction-set.json`
  - Test asociado: `tests/compiler-api.contract.test.ts`

#### T1.3 Actualizar tests desalineados con contrato de lowering
- Estado: `done`
- Subtareas:
  - Actualizar asserts de operandos `JUMP` en tests de regresión.
  - Validar que no hay regresión funcional.
- Evidencia mínima:
  - Archivo tocado: `tests/issues/feat-18-expansion-mode.test.ts`
  - Test asociado: `tests/issues/feat-18-expansion-mode.test.ts`

#### T1.4 Subir cobertura global a 100% en `vitest.config.ts`
- Estado: `done`
- Subtareas:
  - Configurar umbrales `lines/statements/functions/branches = 100`.
  - Cerrar gaps de cobertura reales en `compiler-api`, `compiler-front`, `compiler-ir`.
- Evidencia mínima:
  - Archivo tocado: `vitest.config.ts`
  - Test asociado: `npm run test:coverage`

#### T1.5 Añadir gate estricto en scripts/CI (tests + cobertura 100%)
- Estado: `done`
- Subtareas:
  - Confirmar pipeline CI bloquea merge con tests rojos.
  - Confirmar pipeline CI bloquea merge si cobertura global < 100%.
- Evidencia mínima:
  - Archivo tocado: `vitest.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/docs.yml`
  - Test asociado: `npm run test:coverage` + pipeline CI

#### T1.6 Sincronizar matrices de estado/paridad (FEAT-18..22)
- Estado: `done`
- Subtareas:
  - Actualizar matrices `feature-parity`, `issue-status`, `issue-closure`.
  - Verificar consistencia de nomenclatura y estados.
- Evidencia mínima:
  - Archivo tocado: `docs/feature-parity-matrix.md`
  - Test asociado: `tests/docs-features-examples-contract.test.ts`

### Tests obligatorios Sprint 1
- `npm run test`
- `npm run test:coverage`
- `npm run check:boundaries`
- `(cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/CASTM/docs-site && npm run docs:validate)`

### Comando de validación
```bash
cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/CASTM
npm run test
npm run test:coverage
npm run check:boundaries
cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/CASTM/docs-site && npm run docs:validate
```

### Criterio de cierre
- Todas las tareas en `done`.
- Tests obligatorios en verde en CI.
- Cobertura global 100% mantenida.

---

## Sprint 2 — Labels en `for/if/while`

### Objetivo
Extender labels estructurados a `for`, `if`, `while` y preservar resolubilidad en lowering.

### Tareas

#### T2.1 Parser: permitir `label:` delante de `for/if/while`
- Estado: `done`
- Subtareas:
  - Extender parseo de statement etiquetado para control-flow.
  - Mantener compatibilidad con labels previos.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/statements/control-handler.ts`
  - Test asociado: `tests/issues/feat-23-labeled-control-flow.test.ts`

#### T2.2 AST: propagar `label` en nodos estructurados de control
- Estado: `done`
- Subtareas:
  - Añadir `label?: string` en AST de `for/if/while`.
  - Ajustar tipos consumidores.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-ir/src/ast.ts`
  - Test asociado: `tests/compiler-front.structured.test.ts`

#### T2.3 Lowering: adjuntar label al primer ciclo emitido por cada bloque
- Estado: `done`
- Subtareas:
  - Propagar labels en lowering de `for`, `if`, `while`.
  - Verificar comportamiento con control-flow anidado.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/lowering/function-expand-for.ts`
  - Test asociado: `tests/issues/feat-23-labeled-control-flow.test.ts`

#### T2.4 Edge-case: for estático etiquetado sin ciclos -> ciclo vacío etiquetado
- Estado: `done`
- Subtareas:
  - Detectar caso de expansión vacía.
  - Emitir ciclo vacío con label para preservar resolubilidad.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/lowering/function-expand-for.ts`
  - Test asociado: `tests/issues/feat-23-labeled-control-flow.test.ts`

#### T2.5 Conversión structured→entries y docs de gramática/control-flow
- Estado: `done`
- Subtareas:
  - Ajustar conversión estructurada.
  - Actualizar `docs` y `docs-site` de gramática/features.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/conversion.ts`
  - Test asociado: `tests/compiler-api.contract.test.ts`

### Tests obligatorios Sprint 2
- `tests/issues/feat-23-labeled-control-flow.test.ts`
- `tests/compiler-front.structured.test.ts`
- `tests/compiler-api.contract.test.ts`
- `tests/lsp.contract.test.ts`

### Comando de validación
```bash
cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/CASTM
npm run test -- tests/issues/feat-23-labeled-control-flow.test.ts
npm run test -- tests/compiler-front.structured.test.ts tests/compiler-api.contract.test.ts tests/lsp.contract.test.ts
```

### Criterio de cierre
- Labels en `for/if/while` integrados extremo a extremo.
- Tests obligatorios del sprint en verde en CI.
- Cobertura global 100% intacta.

---

## Sprint 3 — `break` / `continue` (con y sin label)

### Objetivo
Introducir control de bucle explícito con semántica clara y diagnósticos robustos.

### Tareas

#### T3.1 Gramática + parser para `break` / `continue` con label opcional
- Estado: `done`
- Subtareas:
  - Parsear `break;`, `continue;`, `break ident;`, `continue ident;`.
  - Registrar keywords reservadas y tokens.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/statements.ts`
  - Test asociado: `tests/issues/feat-24-loop-control.test.ts`

#### T3.2 Contexto de bucle en lowering (stack con start/end/label)
- Estado: `done`
- Subtareas:
  - Introducir scope de control de bucle compartido.
  - Propagar contexto en expanders de `for` y `while`.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/lowering/loop-control-scope.ts`
  - Test asociado: `tests/issues/feat-24-loop-control.test.ts`

#### T3.3 Lowering de saltos
- Estado: `done`
- Subtareas:
  - `break` -> salto a fin de bucle objetivo.
  - `continue` -> salto a inicio/continue-label de bucle objetivo.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-front/src/structured-core/lowering/function-expand-loop-control.ts`
  - Test asociado: `tests/issues/feat-24-loop-control.test.ts`

#### T3.4 Alcance v1 explícito + error `E3012`
- Estado: `done`
- Subtareas:
  - Soportar en `while` y `for runtime`.
  - Rechazar en `for` estático con diagnóstico claro.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-ir/src/diagnostics.ts`
  - Test asociado: `tests/issues/feat-24-loop-control.test.ts`

#### T3.5 Documentación de semántica y ejemplos
- Estado: `done`
- Subtareas:
  - Actualizar páginas de control-flow/labels/grammar.
  - Añadir ejemplos con/sin label.
- Evidencia mínima:
  - Archivo tocado: `docs-site/features/control-flow.md`
  - Test asociado: `tests/docs-loop-features.contract.test.ts`

### Tests obligatorios Sprint 3
- `tests/issues/feat-24-loop-control.test.ts`
- `tests/issues/feat-21-for-control-flow-contract.test.ts`

### Comando de validación
```bash
cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/CASTM
npm run test -- tests/issues/feat-24-loop-control.test.ts tests/issues/feat-21-for-control-flow-contract.test.ts
```

### Criterio de cierre
- `break`/`continue` con y sin label estables según alcance v1.
- Diagnóstico `E3012` cubierto por tests en CI.
- Cobertura global 100% mantenida.

---

## Sprint 4 — `collect` multi-hop determinista

### Objetivo
Extender `collect` con path explícito y hops acotados, manteniendo backward compatibility.

### Tareas

#### T4.1 Parsing de `collect(path, max_hops)`
- Estado: `done`
- Subtareas:
  - Extender args parser y tipos.
  - Soportar defaults (`path=single_hop`).
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-api/src/passes-shared/advanced-args/collectives.ts`
  - Test asociado: `tests/issues/feat-25-collect-multi-hop.test.ts`

#### T4.2 Lowering multi-hop determinista por eje (`row`/`col`)
- Estado: `done`
- Subtareas:
  - Implementar hops deterministas con orden estable.
  - Verificar secuencia de ciclos por distancia.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-api/src/passes-shared/collective/collect.ts`
  - Test asociado: `tests/issues/feat-25-collect-multi-hop.test.ts`

#### T4.3 Backward compatibility (`single_hop` por defecto)
- Estado: `done`
- Subtareas:
  - Mantener comportamiento heredado si no se declara `path`.
  - Proteger regresiones del contrato anterior.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-api/src/passes-shared/collective/collect.ts`
  - Test asociado: `tests/issues/feat-12-collect.test.ts`

#### T4.4 Diagnósticos explícitos `E3013`
- Estado: `done`
- Subtareas:
  - Validar hops inválidos, ruta imposible y límites.
  - Emitir diagnóstico consistente en parser/lowering.
- Evidencia mínima:
  - Archivo tocado: `packages/compiler-ir/src/diagnostics.ts`
  - Test asociado: `tests/issues/feat-25-collect-multi-hop.test.ts`

#### T4.5 Documentación + snippets ejecutables
- Estado: `done`
- Subtareas:
  - Documentar `single_hop` vs `multi_hop` en `docs` y `docs-site`.
  - Validar snippets/artifacts en pipeline docs.
- Evidencia mínima:
  - Archivo tocado: `docs/language/collect-statement.md`
  - Test asociado: `tests/docs-snippets.contract.test.ts`

### Tests obligatorios Sprint 4
- `tests/issues/feat-25-collect-multi-hop.test.ts`
- `tests/issues/feat-12-collect.test.ts`
- `tests/compiler-api.collective-builders.test.ts`
- `tests/compiler-api.expand-pragmas.handlers.test.ts`

### Comando de validación
```bash
cd /Users/ccampos/UMA/ZKP/cgra-thesis-workspace/submodules/CASTM
npm run test -- tests/issues/feat-25-collect-multi-hop.test.ts tests/issues/feat-12-collect.test.ts tests/compiler-api.collective-builders.test.ts tests/compiler-api.expand-pragmas.handlers.test.ts
```

### Criterio de cierre
- `collect` multi-hop estable y determinista.
- Diagnóstico `E3013` cubierto por tests en CI.
- Cobertura global 100% y docs validadas.

---

## Criterio de Done global (todos los sprints)
- Suite completa verde.
- Cobertura global 100% en `packages/compiler-api`, `packages/compiler-front`, `packages/compiler-ir`.
- Docs y contratos validados.
- Sin tareas marcadas como `done` sin evidencia ejecutable.

## Suposiciones y defaults
- Compatibilidad hacia atrás preservada salvo validaciones explícitas nuevas.
- No se introduce sintaxis legacy.
- El objetivo 100% de cobertura aplica al compilador completo (no solo archivos tocados).
- Cualquier cambio semántico de opcode/label se documenta y se valida con tests de contrato antes de cerrar Sprint 1.
