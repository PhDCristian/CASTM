---
layout: home

hero:
  name: OpenEdge DSL
  text: CGRA Compiler Toolchain
  tagline: A high-level domain-specific language for programming Coarse-Grained Reconfigurable Arrays. Write intuitive spatial-temporal code, compile to optimized CGRA configurations.
  image:
    src: /logo.svg
    alt: OpenEdge DSL — 4x4 CGRA Grid
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/PhDCristian/OpenEdgeDSL

features:
  - icon:
      src: /icons/grid.svg
      width: 32
      height: 32
    title: Spatial-Temporal Model
    details: Express computations in cycles and PE coordinates. Map algorithms directly onto a 4×4 mesh of Reconfigurable Cells with toroidal interconnects.
    link: /language/spatial-temporal
    linkText: Learn about the model
  - icon:
      src: /icons/zap.svg
      width: 32
      height: 32
    title: Zero-Overhead Compilation
    details: Deterministic 1:1 compilation to native CSV format. No runtime overhead — what you write is exactly what executes on the CGRA.
    link: /language/compilation
    linkText: How compilation works
  - icon:
      src: /icons/refresh.svg
      width: 32
      height: 32
    title: Pragma Pattern Generators
    details: Reduce, stencil, broadcast, route, scan, rotate — high-level directives that expand into optimized multi-PE spatial patterns.
    link: /features/pragmas/
    linkText: Explore pragmas
  - icon:
      src: /icons/file-code.svg
      width: 32
      height: 32
    title: C-like Expression Syntax
    details: "Write R1 = R2 + R3 instead of SADD R1, R2, R3. Familiar syntax sugar that desugars to native ISA instructions."
    link: /features/expressions
    linkText: View syntax guide
  - icon:
      src: /icons/terminal.svg
      width: 32
      height: 32
    title: Premium CLI & TUI
    details: Interactive double-column explorer, side-by-side preview, 8 themes, watch mode, and real-time compilation feedback.
    link: /guide/cli-reference
    linkText: CLI reference
  - icon:
      src: /icons/puzzle.svg
      width: 32
      height: 32
    title: VSCode Extension
    details: Full Language Server with syntax highlighting, autocomplete, hover documentation, and real-time error diagnostics.
    link: /guide/getting-started
    linkText: Get started
---

<StatsBar />



<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #2563EB 0%, #7C3AED 50%, #EC4899 100%);
  --vp-home-hero-image-background-image: linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(124, 58, 237, 0.25) 50%, rgba(236, 72, 153, 0.25) 100%);
  --vp-home-hero-image-filter: blur(44px);
}

.dark {
  --vp-home-hero-image-background-image: linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(124, 58, 237, 0.15) 50%, rgba(236, 72, 153, 0.15) 100%);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>
