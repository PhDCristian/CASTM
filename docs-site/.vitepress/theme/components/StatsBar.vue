<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Stat {
  label: string
  value: string
  suffix?: string
}

const stats: Stat[] = [
  { label: 'ISA Opcodes', value: '27' },
  { label: 'Advanced Statements', value: '22' },
  { label: 'Contract Tests', value: '318' },
  { label: 'Grid Targets', value: 'NxM' },
]

const visible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) visible.value = true
    },
    { threshold: 0.3 }
  )
  const el = document.querySelector('.stats-bar')
  if (el) observer.observe(el)
})
</script>

<template>
  <div class="stats-bar" :class="{ visible }">
    <div v-for="(s, i) in stats" :key="i" class="stat-item">
      <div class="stat-value">{{ s.value }}{{ s.suffix || '' }}</div>
      <div class="stat-label">{{ s.label }}</div>
    </div>
  </div>
</template>

<style scoped>
.stats-bar {
  display: flex;
  justify-content: center;
  gap: 48px;
  padding: 40px 24px;
  margin: 0 auto;
  max-width: 800px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.stats-bar.visible {
  opacity: 1;
  transform: translateY(0);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 4px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .stats-bar {
    gap: 24px;
    flex-wrap: wrap;
  }
  .stat-value {
    font-size: 1.5rem;
  }
}
</style>
