import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'CASTM',
  description: 'Canonical CASTM and compiler toolchain for CGRA targets',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap', rel: 'stylesheet' }],
  ],

  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: false,

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'CASTM',

    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Language', link: '/language/overview', activeMatch: '/language/' },
      { text: 'Features', link: '/features/index', activeMatch: '/features/' },
      { text: 'Examples', link: '/examples/index', activeMatch: '/examples/' },
      { text: 'Reference', link: '/reference/error-codes', activeMatch: '/reference/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'CLI Reference', link: '/guide/cli-reference' },
            { text: 'Library Usage', link: '/guide/library-usage' },
          ]
        }
      ],
      '/language/': [
        {
          text: 'Language',
          items: [
            { text: 'Overview', link: '/language/overview' },
            { text: 'Program Structure', link: '/language/program-structure' },
            { text: 'Configuration in Source', link: '/language/configuration' },
            { text: 'Target Profiles', link: '/language/target-profiles' },
            { text: 'Spatial-Temporal Model', link: '/language/spatial-temporal' },
            { text: 'Instruction Set', link: '/language/instruction-set' },
            { text: 'Compilation Pipeline', link: '/language/compilation' },
            { text: 'CASTM to CSV Equivalence', link: '/language/castm-csv-equivalence' },
            { text: 'Formal Grammar', link: '/language/grammar' },
          ]
        }
      ],
      '/features/': [
        {
          text: 'Start Here',
          items: [
            { text: 'Features Overview', link: '/features/index' },
          ]
        },
        {
          text: 'Core Syntax',
          items: [
            { text: 'Expressions', link: '/features/expressions' },
            { text: 'Memory Sugar', link: '/features/memory-sugar' },
            { text: 'Unified Declarations', link: '/features/named-arrays' },
            { text: '2D Arrays', link: '/features/2d-arrays' },
            { text: 'Computed Constants', link: '/features/computed-constants' },
            { text: 'Coordinate Expressions', link: '/features/coordinate-expressions' },
            { text: 'Dynamic Coordinates', link: '/features/dynamic-coordinates' },
            { text: 'Spatial Short Forms', link: '/features/spatial-short-forms' },
            { text: 'Row Auto-Broadcast', link: '/features/broadcast-syntax' },
            { text: 'Functions', link: '/features/functions' },
            { text: 'Loops', link: '/features/loops' },
            { text: 'Control Flow', link: '/features/control-flow' },
            { text: 'Runtime Statements', link: '/features/assertions' },
          ]
        },
        {
          text: 'Advanced Statements',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/features/advanced-statements/index' },
            { text: 'route(...)', link: '/features/advanced-statements/route' },
            { text: 'route variants', link: '/features/advanced-statements/route-variants' },
            { text: 'broadcast(...)', link: '/features/advanced-statements/broadcast' },
            { text: 'reduce(...)', link: '/features/advanced-statements/reduce' },
            { text: 'scan(...)', link: '/features/advanced-statements/scan' },
            { text: 'rotate(...)', link: '/features/advanced-statements/rotate' },
            { text: 'shift(...)', link: '/features/advanced-statements/shift' },
            { text: 'stencil(...)', link: '/features/advanced-statements/stencil' },
            { text: 'allreduce(...)', link: '/features/advanced-statements/allreduce' },
            { text: 'transpose(...)', link: '/features/advanced-statements/transpose' },
            { text: 'gather(...)', link: '/features/advanced-statements/gather' },
            { text: 'stream_load/store(...)', link: '/features/advanced-statements/stream' },
            { text: 'accumulate(...)', link: '/features/advanced-statements/accumulate' },
            { text: 'mulacc_chain(...)', link: '/features/advanced-statements/mulacc-chain' },
            { text: 'carry_chain(...)', link: '/features/advanced-statements/carry-chain' },
            { text: 'conditional_sub(...)', link: '/features/advanced-statements/conditional-sub' },
            { text: 'collect(...)', link: '/features/advanced-statements/collect' },
            { text: 'normalize(...)', link: '/features/advanced-statements/normalize' },
            { text: 'extract_bytes(...)', link: '/features/advanced-statements/extract-bytes' },
            { text: 'guard(...)', link: '/features/advanced-statements/guard' },
            { text: 'triangle(...)', link: '/features/advanced-statements/triangle' },
            { text: 'latency_hide(...)', link: '/features/advanced-statements/auto-bundle' },
            { text: 'stash(...)', link: '/features/advanced-statements/stash' },
            { text: 'pipeline(...)', link: '/features/advanced-statements/pipeline' },
          ]
        },
        {
          text: 'Loop Composition',
          collapsed: true,
          items: [
            { text: 'Loop Composition Patterns', link: '/features/advanced-statements/parallel' },
            { text: 'Loop Expansion Model', link: '/features/advanced-statements/unroll' },
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Examples Index (Start Here)', link: '/examples/index' },
            { text: 'Overview', link: '/examples/overview' },
            { text: 'Basic: Load + Add + Store', link: '/examples/basic' },
            { text: 'Loops: Static and Runtime', link: '/examples/loops' },
            { text: 'Loops: Unroll and Collapse', link: '/examples/loop-strategies' },
            { text: 'Control Flow with For/If/While', link: '/examples/for-control-flow' },
            { text: 'Scheduler Profiles', link: '/examples/scheduler-modes' },
            { text: 'Scheduler Practical Cases', link: '/examples/scheduler-practical' },
            { text: 'Optimization Profiles (Same Kernel)', link: '/examples/optimization-profiles' },
            { text: 'Kernel Compaction Patterns', link: '/examples/kernel-compaction' },
            { text: 'Pipeline with Functions', link: '/examples/parallel' },
            { text: 'Scan + Reduce + Allreduce', link: '/examples/scan' },
            { text: 'Stencil + Guard + Triangle', link: '/examples/stencil' },
            { text: 'Carry + Normalize + CondSub', link: '/examples/barrett' },
            { text: 'Streaming + Route Transfer', link: '/examples/fft' },
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Error Codes', link: '/reference/error-codes' },
            { text: 'Canonical Style Guide', link: '/reference/porting-guide' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/PhDCristian/CASTM' },
    ],

    editLink: {
      pattern: 'https://github.com/PhDCristian/CASTM/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Private research documentation. Canonical syntax only.',
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
    languageAlias: {
      castm: 'ts',
      'castm-fail': 'ts',
      castm: 'ts',
      'castm-fail': 'ts',
      castm: 'ts',
      cgra: 'ts'
    },
    defaultHighlightLang: 'ts',
    lineNumbers: true,
  },
})
