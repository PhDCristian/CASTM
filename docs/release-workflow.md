# CASTM Release Workflow

## Arquitectura de repositorios

```
CASTM-dev (privado)                    CASTM (público)
PhDCristian/CASTM-dev                  PhDCristian/CASTM
────────────────────                   ─────────────────
  desarrollo normal                      solo releases
  commits frecuentes                     1 commit por release
  branches, WIP, tests                   historial limpio
  roadmap, CI, coverage                  solo código publicable
         │                                      ▲
         └──── ./publish-release.sh ────────────┘
                 (squash-publish)
```

- **CASTM-dev**: repo de trabajo. Todo el desarrollo se hace aquí con flujo git normal.
- **CASTM**: repo público. Recibe snapshots limpios — sin historial de desarrollo, sin archivos internos.

## Publicar una release

Desde la raíz de CASTM-dev:

```bash
# Con versión y mensaje
./publish-release.sh v0.1.0 "Initial CASTM release"

# Con versión (mensaje auto-generado: "Release v0.2.0")
./publish-release.sh v0.2.0

# Release rápida (versión = fecha actual)
./publish-release.sh
```

### Qué hace el script

1. Clona (o actualiza) una copia local del repo público en `/tmp/castm-release`
2. Exporta el estado actual de CASTM-dev (`git archive`, solo archivos tracked)
3. Elimina los archivos/carpetas listados en `.release-ignore`
4. Genera un **changelog** con los commits de dev desde la última publicación
5. Crea un **único commit** en el repo público con el changelog como cuerpo
6. Pide confirmación antes de hacer push

### Ejemplo de commit resultante en CASTM

```
Release v0.2.0

## What's Changed

- feat: add support for torus routing
- fix: correct Barrett reduction edge case
- refactor: split compiler into phases

---
Published from CASTM-dev @ a1b2c3d on 2026-03-13
```

## Configurar exclusiones (.release-ignore)

El archivo `.release-ignore` en la raíz de CASTM-dev controla qué se excluye del repo público.
Formato: un patrón glob por línea, `#` para comentarios.

```
# Ejemplo actual:
coverage        # reportes de test coverage
.github         # CI/CD workflows internos
.vscode         # configuración IDE
roadmap         # planificación interna
```

Para excluir algo nuevo, añadir el patrón al archivo. Para incluir algo que estaba excluido,
comentarlo con `#` o eliminarlo.

### Archivos siempre excluidos (hardcoded)

El script siempre elimina estos archivos del release aunque no estén en `.release-ignore`:

- `publish-release.sh` — el propio script de publicación
- `.last-release-sha` — estado interno del tracking de releases
- `.release-ignore` — el archivo de exclusiones

## Estado del tracking (.last-release-sha)

Después de cada push exitoso, el script guarda el SHA del commit actual de CASTM-dev
en `.last-release-sha`. La próxima release usa este SHA para generar el changelog
(solo commits nuevos desde el último publish).

Este archivo está en `.gitignore` — es estado local, no se comparte.

Si se pierde o se quiere resetear:

```bash
# Regenerar changelog desde los últimos N commits
rm .last-release-sha
./publish-release.sh v0.3.0
# → incluirá los últimos 50 commits en el changelog
```

## Flujo de trabajo recomendado

```
1. Desarrollar en CASTM-dev normalmente (commits, branches, PRs)
2. Cuando haya un conjunto estable de cambios → publicar release
3. Verificar el diff mostrado por el script antes de confirmar el push
4. El repo público CASTM siempre refleja la última release publicada
```
