# Advanced Statements

Canonical advanced statements use the `std::` namespace and always lower deterministically to ISA-compatible CSV.

## How to read each page

Every `std::*` page now follows the same contract:

1. **When to use**
2. **Target and assumptions** (`target base;` explicit)
3. **Syntax + Parameters**
4. **Case A** minimal with `CASTM ↔ CSV` tabs
5. **Case B** advanced options with `CASTM ↔ CSV` tabs
6. **Case C** invalid usage (`castm-fail`) with diagnostics guidance
7. **Lowering notes** and related patterns

## CASTM ↔ CSV quick glance

::: code-group
<<< ../../snippets/advanced-statements/route/01-minimal.castm{castm} [CASTM]
<<< ../../snippets/advanced-statements/route/01-minimal.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/advanced-statements/route/01-minimal.csv`.

## Route coverage split

- Core route behavior: [/features/advanced-statements/route](/features/advanced-statements/route)
- Parameterized variants and custom ops: [/features/advanced-statements/route-variants](/features/advanced-statements/route-variants)

## Determinism and artifacts

- CSV shown in docs comes from generated artifacts under `docs-site/snippets/**`.
- No manual CSV should be embedded in `features/advanced-statements/*` pages.
- Use `npm run docs:validate` from `docs-site/` to regenerate artifacts, enforce contracts, and build docs.
