---
layout: home

hero:
  name: CASTM
  text: Canonical CGRA Compiler Language
  tagline: Canon-only DSL for CGRA kernels. Deterministic lowering to ISA-compatible CSV with structured compilation artifacts.
  image:
    src: /logo.svg
    alt: CASTM
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/getting-started
    - theme: alt
      text: Language Spec
      link: /language/overview

features:
  - icon:
      src: /icons/grid.svg
      width: 32
      height: 32
    title: Canonical Syntax Only
    details: Unified declarations with let, explicit spatial namespace with at, and typed advanced statements across the full compiler pipeline.
    link: /language/overview
    linkText: Read the language overview
  - icon:
      src: /icons/zap.svg
      width: 32
      height: 32
    title: Deterministic Compilation Pipeline
    details: Source → Tokens → Structured AST → Flat AST → HIR → MIR → LIR → CSV, with diagnostics and artifacts exposed in the public API.
    link: /language/compilation
    linkText: See the pipeline
  - icon:
      src: /icons/refresh.svg
      width: 32
      height: 32
    title: Advanced Spatial Statements
    details: route, reduce, scan, stencil, collect, normalize, carry_chain, latency_hide, stash, and more, all lowered through the same stable pass pipeline.
    link: /features/pragmas/
    linkText: Explore advanced statements
  - icon:
      src: /icons/file-code.svg
      width: 32
      height: 32
    title: Executable Documentation
    details: Documentation examples are canonical and aligned with compiler contracts. Snippets are intended to match real compiler behavior.
    link: /examples/basic
    linkText: Run the examples
  - icon:
      src: /icons/terminal.svg
      width: 32
      height: 32
    title: CLI + API Workflow
    details: Use castm emit/check/analyze from CLI or compile/parse/analyze/emit from @castm/compiler-api with typed artifacts.
    link: /guide/cli-reference
    linkText: CLI reference
  - icon:
      src: /icons/puzzle.svg
      width: 32
      height: 32
    title: Simulator-Ready Output
    details: Emit flat CSV or simulator matrix CSV from the same canonical source without changing DSL semantics.
    link: /guide/library-usage
    linkText: Integration usage
---

<StatsBar />

## Quick DSL ↔ CSV

Use this minimal canonical snippet as a fast sanity check of the toolchain.
Snippet target: `target base;`.

::: code-group
<<< ./snippets/home/01-main.castm{castm} [CASTM]
<<< ./snippets/home/01-main.excerpt.csv{csv} [CSV excerpt]
:::

Full CSV: `docs-site/snippets/home/01-main.csv`.
