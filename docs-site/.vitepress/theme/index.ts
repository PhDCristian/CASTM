import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import CgraGrid from './components/CgraGrid.vue'
import CodeShowcase from './components/CodeShowcase.vue'
import StatsBar from './components/StatsBar.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h('div', {
        style: 'display:flex;justify-content:center;padding:0 24px 48px;'
      }, h(CgraGrid)),
    })
  },
  enhanceApp({ app }) {
    app.component('CodeShowcase', CodeShowcase)
    app.component('StatsBar', StatsBar)
  },
} satisfies Theme
