<script setup>
import { ref, onMounted } from 'vue'

const code = `target "uma-cgra-base";
let input = { 10, 20, 30, 40 };
let output @100 = { 0 };

function stage_load(src) {
    bundle { @0,0: SADD R2, src, ZERO; }
}

kernel "vector_reduce" {
    pipeline(stage_load(R0));
    reduce(op=add, dest=R1, src=R2, axis=row);

    bundle {
        @0,0: output[0] = R1;
    }
}`

const displayed = ref('')
const showCursor = ref(true)
const isComplete = ref(false)

onMounted(() => {
  let i = 0
  const speed = 18

  function type() {
    if (i < code.length) {
      displayed.value = code.slice(0, i + 1)
      i++
      setTimeout(type, code[i - 1] === '\n' ? speed * 3 : speed)
    } else {
      isComplete.value = true
    }
  }

  // Start after a small delay
  setTimeout(type, 800)

  // Blink cursor
  setInterval(() => { showCursor.value = !showCursor.value }, 530)
})
</script>

<template>
  <div class="code-showcase">
    <div class="code-window">
      <div class="window-chrome">
        <div class="traffic-lights">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <span class="filename">vector_reduce.dsl</span>
      </div>
      <div class="code-body">
        <pre><code>{{ displayed }}<span v-if="!isComplete && showCursor" class="cursor">▎</span></code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-showcase {
  margin: 2rem auto 0;
  max-width: 640px;
  perspective: 1000px;
}

.code-window {
  border-radius: 12px;
  overflow: hidden;
  background: #1a1b26;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.05),
    0 20px 60px -10px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(37, 99, 235, 0.08);
  transform: rotateX(2deg) rotateY(-1deg);
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.code-window:hover {
  transform: rotateX(0deg) rotateY(0deg) translateY(-4px);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.08),
    0 30px 80px -10px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(37, 99, 235, 0.12);
}

.window-chrome {
  padding: 12px 16px;
  background: #16171f;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.traffic-lights {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }

.filename {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.02em;
}

.code-body {
  padding: 20px 24px;
  overflow-x: auto;
  min-height: 300px;
}

.code-body pre {
  margin: 0;
  background: transparent !important;
}

.code-body code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.7;
  color: #a9b1d6;
  white-space: pre;
}

.cursor {
  color: #7aa2f7;
  animation: blink 1.06s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@media (max-width: 768px) {
  .code-showcase {
    margin: 1.5rem 1rem 0;
  }
  .code-window {
    transform: none;
  }
  .code-body code {
    font-size: 0.7rem;
  }
}
</style>
