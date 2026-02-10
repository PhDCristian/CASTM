import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OpenEdge DSL',
  description: 'A Domain-Specific Language for Programming Coarse-Grained Reconfigurable Arrays',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap', rel: 'stylesheet' }],
  ],

  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'OpenEdge DSL',

    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Language', link: '/language/overview', activeMatch: '/language/' },
      { text: 'Features', link: '/features/expressions', activeMatch: '/features/' },
      { text: 'Examples', link: '/examples/basic', activeMatch: '/examples/' },
      { text: 'Reference', link: '/reference/error-codes', activeMatch: '/reference/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'CLI Reference', link: '/guide/cli-reference' },
            { text: 'Library Usage', link: '/guide/library-usage' },
          ]
        }
      ],
      '/language/': [
        {
          text: 'Language Specification',
          items: [
            { text: 'Overview', link: '/language/overview' },
            { text: 'Program Structure', link: '/language/program-structure' },
            { text: 'Spatial-Temporal Model', link: '/language/spatial-temporal' },
            { text: 'Instruction Set', link: '/language/instruction-set' },
            { text: 'Compilation', link: '/language/compilation' },
            { text: 'Formal Grammar', link: '/language/grammar' },
          ]
        }
      ],
      '/features/': [
        {
          text: 'Core Features',
          items: [
            { text: 'C-like Expressions', link: '/features/expressions' },
            { text: 'Memory Sugar', link: '/features/memory-sugar' },
            { text: 'Named Arrays', link: '/features/named-arrays' },
            { text: 'Functions', link: '/features/functions' },
            { text: 'Control Flow', link: '/features/control-flow' },
            { text: 'Loops', link: '/features/loops' },
            { text: '2D Arrays', link: '/features/2d-arrays' },
            { text: 'Broadcast Syntax', link: '/features/broadcast-syntax' },
            { text: 'Computed Constants', link: '/features/computed-constants' },
            { text: 'Coordinate Expressions', link: '/features/coordinate-expressions' },
            { text: 'Dynamic Coordinates', link: '/features/dynamic-coordinates' },
            { text: 'Assertions', link: '/features/assertions' },
          ]
        },
        {
          text: 'Pragma Directives',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/features/pragmas/' },
            { text: '#pragma parallel', link: '/features/pragmas/parallel' },
            { text: '#pragma reduce', link: '/features/pragmas/reduce' },
            { text: '#pragma allreduce', link: '/features/pragmas/allreduce' },
            { text: '#pragma stencil', link: '/features/pragmas/stencil' },
            { text: '#pragma route', link: '/features/pragmas/route' },
            { text: '#pragma rotate', link: '/features/pragmas/rotate' },
            { text: '#pragma shift', link: '/features/pragmas/shift' },
            { text: '#pragma broadcast', link: '/features/pragmas/broadcast' },
            { text: '#pragma gather', link: '/features/pragmas/gather' },
            { text: '#pragma scan', link: '/features/pragmas/scan' },
            { text: '#pragma unroll', link: '/features/pragmas/unroll' },
            { text: '#pragma auto_cycle', link: '/features/pragmas/auto-cycle' },
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic Kernels', link: '/examples/basic' },
            { text: 'Loop Patterns', link: '/examples/loops' },
            { text: 'Parallel Patterns', link: '/examples/parallel' },
            { text: 'Stencil Operations', link: '/examples/stencil' },
            { text: 'Scan & Broadcast', link: '/examples/scan' },
            { text: 'Barrett Reduction', link: '/examples/barrett' },
            { text: 'FFT Kernels', link: '/examples/fft' },
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Error Codes', link: '/reference/error-codes' },
            { text: 'Porting Guide', link: '/reference/porting-guide' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/PhDCristian/OpenEdgeDSL' },
    ],

    editLink: {
      pattern: 'https://github.com/PhDCristian/OpenEdgeDSL/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2024-present Cristian Campos · Universidad de Málaga',
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
    },
  },

  markdown: {
    theme: {
      light: 'vitesse-light',
      dark: 'vitesse-dark',
    },
    lineNumbers: true,
  },
})
