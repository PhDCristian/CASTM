<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

// ── Types ──
interface MemState {
  input: (number | null)[]    // input array values (null = not yet loaded)
  output: (number | null)[]   // output array values
  readIdx?: number[]          // indices being read this cycle
  writeIdx?: number[]         // indices being written this cycle
}

interface bundle {
  label: string
  codeLine: number
  codeEnd?: number
  grid: string[][]
  vals: (number | null)[][] // 4×4 register values visible in each PE
  mem: MemState
}

// ── Kernel data ──
// Sum4: input = {10, 20, 30, 40} → output = sum = 100
// #pragma parallel: column j loads input[j]
// #pragma reduce(sum, R0): compiler generates tree reduction (2 cycles)
const cycles: Cycle[] = [
  {
    label: 'LOAD', codeLine: 8, codeEnd: 10,
    grid: [
      ['LWI','LWI','LWI','LWI'],
      ['LWI','LWI','LWI','LWI'],
      ['LWI','LWI','LWI','LWI'],
      ['LWI','LWI','LWI','LWI'],
    ],
    vals: [
      [10, 20, 30, 40],
      [10, 20, 30, 40],
      [10, 20, 30, 40],
      [10, 20, 30, 40],
    ],
    mem: {
      input: [10, 20, 30, 40],
      output: [null],
      readIdx: [0, 1, 2, 3],
    },
  },
  {
    label: 'REDUCE', codeLine: 13, codeEnd: 13,
    // Tree step 1: pair-wise add. col0 += col1 (10+20=30), col2 += col3 (30+40=70)
    // ROUT PEs forward value to their left neighbor
    grid: [
      ['SADD','ROUT','SADD','ROUT'],
      ['SADD','ROUT','SADD','ROUT'],
      ['SADD','ROUT','SADD','ROUT'],
      ['SADD','ROUT','SADD','ROUT'],
    ],
    vals: [
      [30, 20, 70, 40],
      [30, 20, 70, 40],
      [30, 20, 70, 40],
      [30, 20, 70, 40],
    ],
    mem: {
      input: [10, 20, 30, 40],
      output: [null],
    },
  },
  {
    label: 'REDUCE', codeLine: 13, codeEnd: 13,
    // Tree step 2: col0 += col2 (30+70=100). Only col0 active.
    grid: [
      ['SADD','NOP','ROUT','NOP'],
      ['SADD','NOP','ROUT','NOP'],
      ['SADD','NOP','ROUT','NOP'],
      ['SADD','NOP','ROUT','NOP'],
    ],
    vals: [
      [100, null, 70, null],
      [100, null, 70, null],
      [100, null, 70, null],
      [100, null, 70, null],
    ],
    mem: {
      input: [10, 20, 30, 40],
      output: [null],
    },
  },
  {
    label: 'STORE', codeLine: 15, codeEnd: 17,
    grid: [
      ['SWD','NOP','NOP','NOP'],
      ['NOP','NOP','NOP','NOP'],
      ['NOP','NOP','NOP','NOP'],
      ['NOP','NOP','NOP','EXIT'],
    ],
    vals: [
      [100, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    mem: {
      input: [10, 20, 30, 40],
      output: [100],
      writeIdx: [0],
    },
  },
]

// ── Source code tokens ──
// Simplified kernel: load, reduce, store — 17 lines
type Token = { text: string; type: 'kw' | 'instr' | 'reg' | 'num' | 'dir' | 'pragma' | 'cmt' | 'str' | 'op' | 'plain' | 'neigh' }

const codeLines: Token[][] = [
  // 1: .data input { 10, 20, 30, 40 }
  [{ text: '.data', type: 'dir' }, { text: ' input ', type: 'plain' }, { text: '{ ', type: 'op' }, { text: '10', type: 'num' }, { text: ', ', type: 'op' }, { text: '20', type: 'num' }, { text: ', ', type: 'op' }, { text: '30', type: 'num' }, { text: ', ', type: 'op' }, { text: '40', type: 'num' }, { text: ' }', type: 'op' }],
  // 2: .data output { 0 }
  [{ text: '.data', type: 'dir' }, { text: ' output ', type: 'plain' }, { text: '{ ', type: 'op' }, { text: '0', type: 'num' }, { text: ' }', type: 'op' }],
  // 3: (empty)
  [],
  // 4: kernel "Sum4" {
  [{ text: 'kernel', type: 'kw' }, { text: ' ', type: 'plain' }, { text: '"Sum4"', type: 'str' }, { text: ' {', type: 'op' }],
  // 5:   config(0xF, 0);
  [{ text: '  config', type: 'kw' }, { text: '(', type: 'op' }, { text: '0xF', type: 'num' }, { text: ', ', type: 'op' }, { text: '0', type: 'num' }, { text: ');', type: 'op' }],
  // 6:   #pragma parallel
  [{ text: '  ', type: 'plain' }, { text: '#pragma parallel', type: 'pragma' }],
  // 7:   for j in range(4) {
  [{ text: '  ', type: 'plain' }, { text: 'for', type: 'kw' }, { text: ' j ', type: 'plain' }, { text: 'in', type: 'kw' }, { text: ' range(', type: 'plain' }, { text: '4', type: 'num' }, { text: ') {', type: 'op' }],
  // 8: (empty)
  [],
  // 9:     bundle {  // Load
  [{ text: '    ', type: 'plain' }, { text: 'cycle', type: 'kw' }, { text: ' {', type: 'op' }, { text: '  ', type: 'plain' }, { text: '// Load values', type: 'cmt' }],
  // 10:       @0,j: R0 = LWI input[j];
  [{ text: '      @', type: 'plain' }, { text: '0', type: 'num' }, { text: ',j: ', type: 'op' }, { text: 'R0', type: 'reg' }, { text: ' = ', type: 'op' }, { text: 'LWI', type: 'instr' }, { text: ' input[j];', type: 'plain' }],
  // 11:     }
  [{ text: '    }', type: 'op' }],
  // 12:   }
  [{ text: '  }', type: 'op' }],
  // 13: (empty)
  [],
  // 14:   #pragma reduce(sum, R0)     ← highlighted for both REDUCE cycles
  [{ text: '  ', type: 'plain' }, { text: '#pragma reduce', type: 'pragma' }, { text: '(sum, ', type: 'plain' }, { text: 'R0', type: 'reg' }, { text: ')', type: 'op' }],
  // 15: (empty)
  [],
  // 16:   bundle {  // Store result
  [{ text: '  ', type: 'plain' }, { text: 'cycle', type: 'kw' }, { text: ' {', type: 'op' }, { text: '  ', type: 'plain' }, { text: '// Store result', type: 'cmt' }],
  // 17:     @0,0: SWD output[0] = R0;
  [{ text: '    @', type: 'plain' }, { text: '0', type: 'num' }, { text: ',', type: 'op' }, { text: '0', type: 'num' }, { text: ': ', type: 'op' }, { text: 'SWD', type: 'instr' }, { text: ' output[', type: 'plain' }, { text: '0', type: 'num' }, { text: '] = ', type: 'op' }, { text: 'R0', type: 'reg' }, { text: ';', type: 'op' }],
  // 18:   }
  [{ text: '  }', type: 'op' }],
  // 19: }
  [{ text: '}', type: 'op' }],
]

// ── State ──
const currentCycle = ref(0)
let timer: ReturnType<typeof setInterval>

const cycle = computed(() => cycles[currentCycle.value])

function isHighlighted(lineIdx: number): boolean {
  const c = cycle.value
  const start = c.codeLine
  const end = c.codeEnd ?? c.codeLine
  return lineIdx >= start && lineIdx <= end
}

function peType(instr: string): string {
  if (instr === 'NOP') return 'idle'
  if (instr.startsWith('LWI') || instr.startsWith('LWD')) return 'load'
  if (instr.startsWith('ROUT')) return 'route'
  if (instr.startsWith('SWD')) return 'store'
  if (instr === 'EXIT') return 'exit'
  return 'compute'
}

function isMemRead(idx: number): boolean {
  return (cycle.value.mem.readIdx ?? []).includes(idx)
}

function isMemWrite(idx: number): boolean {
  return (cycle.value.mem.writeIdx ?? []).includes(idx)
}

function advance() {
  currentCycle.value = (currentCycle.value + 1) % cycles.length
}

onMounted(() => { timer = setInterval(advance, 2400) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="showcase">
    <!-- Header -->
    <div class="sc-header">
      <div class="window-dots">
        <span class="wdot red"></span>
        <span class="wdot yellow"></span>
        <span class="wdot green"></span>
      </div>
      <div class="sc-title">sum4.edsl</div>
      <div class="sc-badge" :key="cycle.label">{{ cycle.label }}</div>
    </div>

    <div class="sc-body">
      <!-- Code panel -->
      <div class="code-panel">
        <div class="code-lines">
          <div
            v-for="(line, i) in codeLines"
            :key="i"
            class="code-line"
            :class="{ highlighted: isHighlighted(i), dimmed: !isHighlighted(i) }"
          >
            <span class="line-num">{{ i + 1 }}</span>
            <span class="line-content">
              <template v-if="line.length === 0">&nbsp;</template>
              <span
                v-for="(tok, j) in line"
                :key="j"
                :class="'tok-' + tok.type"
              >{{ tok.text }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Arrow -->
      <div class="connector">
        <div class="conn-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="conn-label">CC {{ currentCycle }}</div>
      </div>

      <!-- Right side: CGRA + Memory -->
      <div class="hw-panel">
        <!-- CGRA grid -->
        <div class="cgra-grid">
          <div v-for="r in 4" :key="r" class="cgra-row">
            <div
              v-for="c in 4"
              :key="c"
              class="pe"
              :class="peType(cycle.grid[r-1][c-1])"
            >
              <span class="pe-text">{{ cycle.grid[r-1][c-1] }}</span>
              <span v-if="cycle.vals[r-1][c-1] !== null" class="pe-val">= {{ cycle.vals[r-1][c-1] }}</span>
            </div>
          </div>
        </div>

        <!-- Memory visualization -->
        <div class="mem-section">
          <div class="mem-row">
            <span class="mem-label">input[]</span>
            <div class="mem-cells">
              <div
                v-for="(val, i) in cycle.mem.input"
                :key="'in' + i"
                class="mem-cell"
                :class="{ reading: isMemRead(i) }"
              >
                <span class="mem-val">{{ val ?? '—' }}</span>
              </div>
            </div>
          </div>
          <div class="mem-row">
            <span class="mem-label">output[]</span>
            <div class="mem-cells">
              <div
                v-for="(val, i) in cycle.mem.output"
                :key="'out' + i"
                class="mem-cell out"
                :class="{ writing: isMemWrite(i) }"
              >
                <span class="mem-val">{{ val ?? '—' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="sc-footer">
      <div class="progress">
        <div
          v-for="(c, i) in cycles"
          :key="i"
          class="progress-dot"
          :class="{ active: i === currentCycle }"
          @click="currentCycle = i"
        ></div>
      </div>
      <div class="legend">
        <span class="lg"><i class="sw compute"></i>ALU</span>
        <span class="lg"><i class="sw load"></i>Load</span>
        <span class="lg"><i class="sw route"></i>Route</span>
        <span class="lg"><i class="sw store"></i>Store</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.showcase {
  width: 660px;
  border-radius: 14px;
  overflow: hidden;
  background: #0c111b;
  border: 1px solid rgba(96, 165, 250, 0.12);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02),
    0 32px 64px -16px rgba(0,0,0,0.55),
    0 0 48px rgba(96,165,250,0.05);
  font-family: 'Inter', sans-serif;
  user-select: none;
}

/* ── Header ── */
.sc-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 8px;
}
.window-dots { display: flex; gap: 5px; }
.wdot { width: 9px; height: 9px; border-radius: 50%; }
.wdot.red { background: #FF5F57; }
.wdot.yellow { background: #FEBC2E; }
.wdot.green { background: #28C840; }
.sc-title {
  flex: 1; text-align: center;
  font-size: 0.65rem; font-weight: 500;
  color: rgba(255,255,255,0.35);
  font-family: 'JetBrains Mono', monospace;
}
.sc-badge {
  font-size: 0.5rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #60A5FA;
  background: rgba(96,165,250,0.1);
  padding: 2px 8px; border-radius: 4px;
  border: 1px solid rgba(96,165,250,0.2);
}

/* ── Body ── */
.sc-body { display: flex; min-height: 280px; }

/* ── Code Panel ── */
.code-panel {
  flex: 1; padding: 8px 0; overflow: hidden;
  border-right: 1px solid rgba(255,255,255,0.04);
}
.code-lines { display: flex; flex-direction: column; }
.code-line {
  display: flex; padding: 0 10px; line-height: 1.45;
  font-size: 0.6rem;
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.4s ease;
  border-left: 2px solid transparent;
}
.code-line.highlighted {
  background: rgba(96, 165, 250, 0.07);
  border-left-color: #60A5FA;
}
.code-line.dimmed { opacity: 0.35; }
.line-num {
  width: 22px; text-align: right;
  color: rgba(255,255,255,0.15);
  margin-right: 10px; flex-shrink: 0;
  font-size: 0.55rem;
}
.line-content { white-space: pre; }

/* ── Syntax colors ── */
.tok-kw { color: #60A5FA; }
.tok-instr { color: #C084FC; }
.tok-reg { color: #4ADE80; }
.tok-neigh { color: #22D3EE; }
.tok-num { color: #FB923C; }
.tok-dir { color: #F472B6; }
.tok-pragma { color: #F472B6; }
.tok-cmt { color: #6B7280; font-style: italic; }
.tok-str { color: #D4A574; }
.tok-op { color: rgba(255,255,255,0.5); }
.tok-plain { color: rgba(255,255,255,0.7); }

/* ── Connector ── */
.connector {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  width: 36px; gap: 6px;
  color: rgba(255,255,255,0.2);
}
.conn-arrow { animation: pulse-arrow 2.4s ease-in-out infinite; }
@keyframes pulse-arrow {
  0%, 100% { opacity: 0.3; transform: translateX(0); }
  50% { opacity: 0.8; transform: translateX(3px); }
}
.conn-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.5rem; font-weight: 600;
  color: rgba(255,255,255,0.25);
}

/* ── Hardware panel (CGRA + Memory) ── */
.hw-panel {
  width: 220px;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 8px;
  justify-content: center;
}

/* ── CGRA Grid ── */
.cgra-grid { display: flex; flex-direction: column; gap: 3px; }
.cgra-row { display: flex; gap: 3px; }
.pe {
  flex: 1; aspect-ratio: 1;
  border-radius: 5px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(255,255,255,0.04);
  background: rgba(30,41,59,0.4);
  gap: 1px;
}
.pe-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.44rem; font-weight: 600;
  transition: all 0.4s ease;
  line-height: 1;
}
.pe-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.42rem; font-weight: 700;
  color: rgba(255,255,255,0.65);
  line-height: 1;
  transition: all 0.4s ease;
}

.pe.idle { background: rgba(30,41,59,0.35); }
.pe.idle .pe-text { color: rgba(255,255,255,0.12); }
.pe.compute {
  background: linear-gradient(135deg, rgba(37,99,235,0.3), rgba(124,58,237,0.2));
  border-color: rgba(96,165,250,0.3);
  box-shadow: 0 0 10px rgba(96,165,250,0.08);
}
.pe.compute .pe-text { color: #93C5FD; }
.pe.load {
  background: linear-gradient(135deg, rgba(16,185,129,0.25), rgba(52,211,153,0.15));
  border-color: rgba(52,211,153,0.3);
  box-shadow: 0 0 10px rgba(52,211,153,0.06);
}
.pe.load .pe-text { color: #6EE7B7; }
.pe.route {
  background: linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,191,36,0.15));
  border-color: rgba(251,191,36,0.3);
  box-shadow: 0 0 10px rgba(251,191,36,0.06);
}
.pe.route .pe-text { color: #FCD34D; }
.pe.store {
  background: linear-gradient(135deg, rgba(236,72,153,0.25), rgba(244,114,182,0.15));
  border-color: rgba(244,114,182,0.3);
  box-shadow: 0 0 10px rgba(236,72,153,0.06);
}
.pe.store .pe-text { color: #F9A8D4; }
.pe.exit {
  background: linear-gradient(135deg, rgba(239,68,68,0.25), rgba(248,113,113,0.15));
  border-color: rgba(248,113,113,0.3);
}
.pe.exit .pe-text { color: #FCA5A5; }

/* ── Memory ── */
.mem-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.mem-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mem-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.45rem;
  font-weight: 600;
  color: rgba(255,255,255,0.3);
  width: 42px;
  flex-shrink: 0;
  text-align: right;
}

.mem-cells {
  display: flex;
  gap: 3px;
  flex: 1;
}

.mem-cell {
  flex: 1;
  height: 22px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255,255,255,0.04);
  transition: all 0.45s ease;
}

.mem-cell.reading {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(52, 211, 153, 0.35);
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.15);
}

.mem-cell.out {
  max-width: 50px;
}

.mem-cell.writing {
  background: rgba(236, 72, 153, 0.15);
  border-color: rgba(244, 114, 182, 0.35);
  box-shadow: 0 0 8px rgba(236, 72, 153, 0.15);
}

.mem-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.48rem;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  transition: color 0.4s ease;
}

.mem-cell.reading .mem-val { color: #6EE7B7; }
.mem-cell.writing .mem-val { color: #F9A8D4; }

/* ── Footer ── */
.sc-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 14px;
  border-top: 1px solid rgba(255,255,255,0.04);
  background: rgba(255,255,255,0.015);
}
.progress { display: flex; gap: 6px; }
.progress-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,0.1);
  cursor: pointer; transition: all 0.3s ease;
}
.progress-dot.active {
  background: #60A5FA;
  box-shadow: 0 0 8px rgba(96,165,250,0.5);
  transform: scale(1.3);
}
.legend { display: flex; gap: 8px; }
.lg {
  display: flex; align-items: center; gap: 3px;
  font-size: 0.5rem; color: rgba(255,255,255,0.3);
}
.sw { width: 5px; height: 5px; border-radius: 2px; display: inline-block; }
.sw.compute { background: #60A5FA; }
.sw.load { background: #34D399; }
.sw.route { background: #FBBF24; }
.sw.store { background: #F472B6; }

/* ── Light mode ── */
:root:not(.dark) .showcase {
  background: #fafbfe;
  border-color: rgba(37,99,235,0.12);
  box-shadow: 0 32px 64px -16px rgba(0,0,0,0.12), 0 0 48px rgba(37,99,235,0.04);
}
:root:not(.dark) .sc-header { background: rgba(0,0,0,0.02); border-bottom-color: rgba(0,0,0,0.06); }
:root:not(.dark) .sc-title { color: rgba(0,0,0,0.4); }
:root:not(.dark) .code-panel { border-right-color: rgba(0,0,0,0.05); }
:root:not(.dark) .code-line.highlighted { background: rgba(37,99,235,0.06); border-left-color: #2563EB; }
:root:not(.dark) .code-line.dimmed { opacity: 0.3; }
:root:not(.dark) .line-num { color: rgba(0,0,0,0.15); }
:root:not(.dark) .tok-kw { color: #2563EB; }
:root:not(.dark) .tok-instr { color: #7C3AED; }
:root:not(.dark) .tok-reg { color: #059669; }
:root:not(.dark) .tok-neigh { color: #0891B2; }
:root:not(.dark) .tok-num { color: #EA580C; }
:root:not(.dark) .tok-dir { color: #DB2777; }
:root:not(.dark) .tok-pragma { color: #DB2777; }
:root:not(.dark) .tok-cmt { color: #9CA3AF; }
:root:not(.dark) .tok-str { color: #B45309; }
:root:not(.dark) .tok-op { color: rgba(0,0,0,0.45); }
:root:not(.dark) .tok-plain { color: rgba(0,0,0,0.65); }
:root:not(.dark) .connector { color: rgba(0,0,0,0.2); }
:root:not(.dark) .conn-label { color: rgba(0,0,0,0.2); }
:root:not(.dark) .pe.idle { background: rgba(241,245,249,0.6); }
:root:not(.dark) .pe.idle .pe-text { color: rgba(0,0,0,0.1); }
:root:not(.dark) .pe.compute { background: linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.08)); border-color: rgba(37,99,235,0.2); }
:root:not(.dark) .pe.compute .pe-text { color: #2563EB; }
:root:not(.dark) .pe.load { background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(52,211,153,0.06)); border-color: rgba(16,185,129,0.2); }
:root:not(.dark) .pe.load .pe-text { color: #059669; }
:root:not(.dark) .pe.route { background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.06)); border-color: rgba(245,158,11,0.2); }
:root:not(.dark) .pe.route .pe-text { color: #D97706; }
:root:not(.dark) .pe.store { background: linear-gradient(135deg, rgba(236,72,153,0.1), rgba(244,114,182,0.06)); border-color: rgba(236,72,153,0.2); }
:root:not(.dark) .pe.store .pe-text { color: #DB2777; }
:root:not(.dark) .pe.exit .pe-text { color: #DC2626; }
:root:not(.dark) .mem-section { border-top-color: rgba(0,0,0,0.06); }
:root:not(.dark) .mem-label { color: rgba(0,0,0,0.3); }
:root:not(.dark) .mem-cell { background: rgba(241,245,249,0.6); border-color: rgba(0,0,0,0.05); }
:root:not(.dark) .mem-val { color: rgba(0,0,0,0.4); }
:root:not(.dark) .mem-cell.reading { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2); }
:root:not(.dark) .mem-cell.reading .mem-val { color: #059669; }
:root:not(.dark) .mem-cell.writing { background: rgba(236,72,153,0.08); border-color: rgba(236,72,153,0.2); }
:root:not(.dark) .mem-cell.writing .mem-val { color: #DB2777; }
:root:not(.dark) .sc-footer { border-top-color: rgba(0,0,0,0.05); }
:root:not(.dark) .lg { color: rgba(0,0,0,0.35); }
:root:not(.dark) .progress-dot { background: rgba(0,0,0,0.08); }
:root:not(.dark) .progress-dot.active { background: #2563EB; box-shadow: 0 0 8px rgba(37,99,235,0.4); }

/* ── Responsive ── */
@media (max-width: 960px) {
  .showcase { width: 520px; }
  .hw-panel { width: 180px; }
  .pe-text { font-size: 0.4rem; }
  .mem-val { font-size: 0.42rem; }
}
@media (max-width: 640px) {
  .showcase { width: 340px; }
  .sc-body { flex-direction: column; }
  .code-panel { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.04); max-height: 180px; overflow-y: auto; }
  .connector { flex-direction: row; width: auto; padding: 6px; }
  .conn-arrow { transform: rotate(90deg); }
  .hw-panel { width: 100%; }
}
</style>
