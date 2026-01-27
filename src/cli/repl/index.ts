/**
 * REPL Command - Interactive DSL Shell
 * 
 * Provides line-by-line instruction execution with:
 * - State visualization (PE grid, registers, memory)
 * - Command history
 * - Built-in commands (.help, .state, .reset, .load, .save)
 */

import { Command } from 'commander';
import * as readline from 'readline';
import * as fs from 'fs';
import chalk from 'chalk';
import { getCurrentTheme } from '../config/store.js';
import { 
  ReplState, 
  createInitialState, 
  resetState, 
  getStateSnapshot,
  formatPEState,
  formatMemoryRegion,
  getPE,
} from './state.js';
import { executeInstruction, ExecutionResult } from './executor.js';

// ═══════════════════════════════════════════════════════════════════════════
// REPL CLASS
// ═══════════════════════════════════════════════════════════════════════════

class Repl {
  private state: ReplState;
  private rl: readline.Interface;
  private theme = getCurrentTheme();
  private running = true;
  
  constructor() {
    this.state = createInitialState(4, 4);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      historySize: 100,
    });
  }
  
  private getPrompt(): string {
    return chalk.hex(this.theme.primary)('openedge') + 
           chalk.hex(this.theme.dim)(`:${this.state.cycle}`) + 
           chalk.hex(this.theme.primary)('> ');
  }
  
  private updatePrompt(): void {
    this.rl.setPrompt(this.getPrompt());
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // DISPLAY
  // ─────────────────────────────────────────────────────────────────────────
  
  private printWelcome(): void {
    console.log();
    console.log(chalk.hex(this.theme.primary).bold('  OpenEdge REPL'));
    console.log(chalk.hex(this.theme.dim)('  Interactive DSL Shell · Type .help for commands'));
    console.log();
    this.printGrid();
    console.log();
  }
  
  private printGrid(): void {
    const { gridWidth, gridHeight } = this.state;
    
    // Header
    console.log(chalk.hex(this.theme.dim)('  PE Grid:'));
    
    // Column headers
    let header = '      ';
    for (let col = 0; col < gridWidth; col++) {
      header += `  ${col}   `;
    }
    console.log(chalk.hex(this.theme.dim)(header));
    
    // Top border
    console.log(chalk.hex(this.theme.dim)('    ╭' + '──────'.repeat(gridWidth) + '╮'));
    
    // Grid rows
    for (let row = 0; row < gridHeight; row++) {
      let line = chalk.hex(this.theme.dim)(`  ${row} │`);
      
      for (let col = 0; col < gridWidth; col++) {
        const pe = getPE(this.state, row, col);
        if (!pe) continue;
        
        // Check if PE has non-zero registers
        const hasData = Object.values(pe.registers).some(v => v !== 0);
        const wasModified = pe.lastModified !== undefined;
        
        let cellColor = this.theme.dim;
        let symbol = '  ○  ';
        
        if (wasModified) {
          cellColor = this.theme.success;
          symbol = '  ●  ';
        } else if (hasData) {
          cellColor = this.theme.primary;
          symbol = '  ◉  ';
        }
        
        line += chalk.hex(cellColor)(symbol) + chalk.hex(this.theme.dim)('│');
      }
      
      console.log(line);
      
      // Row separator
      if (row < gridHeight - 1) {
        console.log(chalk.hex(this.theme.dim)('    ├' + '──────'.repeat(gridWidth) + '┤'));
      }
    }
    
    // Bottom border
    console.log(chalk.hex(this.theme.dim)('    ╰' + '──────'.repeat(gridWidth) + '╯'));
    
    // Legend
    console.log();
    console.log(chalk.hex(this.theme.dim)('    ○ Empty  ') + 
                chalk.hex(this.theme.primary)('◉ Has data  ') + 
                chalk.hex(this.theme.success)('● Modified'));
  }
  
  private printState(): void {
    const snapshot = getStateSnapshot(this.state);
    
    console.log();
    console.log(chalk.hex(this.theme.primary).bold('  State'));
    console.log(chalk.hex(this.theme.dim)('  ─────────────────────────────────'));
    
    // Cycle
    console.log(chalk.hex(this.theme.dim)('  Cycle: ') + chalk.white(this.state.cycle.toString()));
    
    // Active PEs
    if (snapshot.activePEs.length > 0) {
      console.log();
      console.log(chalk.hex(this.theme.accent)('  Active PEs:'));
      for (const pe of snapshot.activePEs) {
        const peObj = getPE(this.state, pe.row, pe.col)!;
        console.log(chalk.hex(this.theme.dim)('    ') + formatPEState(peObj));
      }
    } else {
      console.log(chalk.hex(this.theme.dim)('  No active PEs'));
    }
    
    // Memory
    if (snapshot.memory.length > 0) {
      console.log();
      console.log(chalk.hex(this.theme.accent)('  Memory:'));
      for (const region of snapshot.memory) {
        console.log(chalk.hex(this.theme.dim)('    ') + 
                    `${region.name} @ 0x${region.address.toString(16)}: [${region.values.join(', ')}]`);
      }
    }
    
    console.log();
  }
  
  private printHelp(): void {
    console.log();
    console.log(chalk.hex(this.theme.primary).bold('  REPL Commands'));
    console.log(chalk.hex(this.theme.dim)('  ─────────────────────────────────'));
    console.log();
    
    const commands = [
      ['.help', 'Show this help message'],
      ['.state', 'Show current state (registers, memory)'],
      ['.grid', 'Show PE grid visualization'],
      ['.reset', 'Reset all state to initial values'],
      ['.pe <r>,<c>', 'Show registers for PE at row,col'],
      ['.mem <name>', 'Show memory region by name'],
      ['.load <file>', 'Load and execute a DSL file'],
      ['.save <file>', 'Save session history to file'],
      ['.cycle', 'Increment cycle counter'],
      ['.exit', 'Exit REPL'],
    ];
    
    for (const [cmd, desc] of commands) {
      console.log(chalk.hex(this.theme.accent)(`  ${cmd.padEnd(16)}`) + 
                  chalk.hex(this.theme.dim)(desc));
    }
    
    console.log();
    console.log(chalk.hex(this.theme.primary).bold('  Instructions'));
    console.log(chalk.hex(this.theme.dim)('  ─────────────────────────────────'));
    console.log();
    
    const instructions = [
      ['.data name @ 0x100 = [1,2,3]', 'Declare data in memory'],
      ['@0,0: LWI R0, data[0]', 'Load from memory (indirect)'],
      ['@0,0: SWI R0, data[0]', 'Store to memory (indirect)'],
      ['@0,0: SADD R2, R0, R1', 'Signed add'],
      ['@0,0: SSUB R2, R0, R1', 'Signed subtract'],
      ['@0,0: SMUL R2, R0, R1', 'Signed multiply'],
      ['@0,0: MOVI R0, 42', 'Load immediate (convenience)'],
      ['@0,1: SADD R0, RCL, ZERO', 'Read from left neighbor'],
    ];
    
    for (const [cmd, desc] of instructions) {
      console.log(chalk.hex(this.theme.secondary)(`  ${cmd}`));
      console.log(chalk.hex(this.theme.dim)(`      ${desc}`));
    }
    
    console.log();
    console.log(chalk.hex(this.theme.primary).bold('  Registers & Operands'));
    console.log(chalk.hex(this.theme.dim)('  ─────────────────────────────────'));
    console.log(chalk.hex(this.theme.dim)('  Registers: R0, R1, R2, R3, ROUT'));
    console.log(chalk.hex(this.theme.dim)('  Sources:   ZERO, SELF, RCL, RCR, RCT, RCB, IMM'));
    console.log();
  }
  
  private printResult(result: ExecutionResult): void {
    if (result.success) {
      let msg = chalk.hex(this.theme.success)('  ✓ ');
      if (result.pe) {
        msg += chalk.hex(this.theme.dim)(`@${result.pe.row},${result.pe.col}: `);
      }
      msg += chalk.white(result.message || 'OK');
      console.log(msg);
    } else {
      console.log(chalk.hex(this.theme.error)('  ✗ ') + 
                  chalk.hex(this.theme.error)(result.error || 'Error'));
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // COMMAND HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  
  private handleDotCommand(input: string): boolean {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch (cmd) {
      case '.help':
      case '.h':
      case '.?':
        this.printHelp();
        return true;
        
      case '.state':
      case '.s':
        this.printState();
        return true;
        
      case '.grid':
      case '.g':
        console.log();
        this.printGrid();
        console.log();
        return true;
        
      case '.reset':
      case '.r':
        resetState(this.state);
        console.log(chalk.hex(this.theme.warning)('  State reset'));
        this.updatePrompt();
        return true;
        
      case '.pe':
        if (args.length < 1) {
          console.log(chalk.hex(this.theme.error)('  Usage: .pe <row>,<col>'));
          return true;
        }
        const match = args[0].match(/(\d+),(\d+)/);
        if (match) {
          const row = parseInt(match[1]);
          const col = parseInt(match[2]);
          const pe = getPE(this.state, row, col);
          if (pe) {
            console.log();
            console.log(chalk.hex(this.theme.primary)(`  PE[${row},${col}]`));
            for (const [reg, val] of Object.entries(pe.registers)) {
              const color = val !== 0 ? this.theme.accent : this.theme.dim;
              console.log(chalk.hex(color)(`    ${reg}: ${val}`));
            }
            console.log();
          } else {
            console.log(chalk.hex(this.theme.error)(`  Invalid PE: ${row},${col}`));
          }
        }
        return true;
        
      case '.mem':
        if (args.length < 1) {
          // Show all memory regions
          console.log();
          for (const [name] of this.state.data) {
            const formatted = formatMemoryRegion(this.state, name);
            if (formatted) {
              console.log(chalk.hex(this.theme.dim)('  ') + formatted);
            }
          }
          console.log();
        } else {
          const formatted = formatMemoryRegion(this.state, args[0]);
          if (formatted) {
            console.log(chalk.hex(this.theme.dim)('  ') + formatted);
          } else {
            console.log(chalk.hex(this.theme.error)(`  Unknown data: ${args[0]}`));
          }
        }
        return true;
        
      case '.cycle':
      case '.c':
        this.state.cycle++;
        console.log(chalk.hex(this.theme.dim)(`  Cycle: ${this.state.cycle}`));
        this.updatePrompt();
        return true;
        
      case '.load':
        if (args.length < 1) {
          console.log(chalk.hex(this.theme.error)('  Usage: .load <file>'));
          return true;
        }
        this.loadFile(args[0]);
        return true;
        
      case '.save':
        if (args.length < 1) {
          console.log(chalk.hex(this.theme.error)('  Usage: .save <file>'));
          return true;
        }
        this.saveHistory(args[0]);
        return true;
        
      case '.exit':
      case '.quit':
      case '.q':
        this.running = false;
        return true;
        
      default:
        return false;
    }
  }
  
  private loadFile(path: string): void {
    try {
      const content = fs.readFileSync(path, 'utf-8');
      const lines = content.split('\n');
      
      console.log(chalk.hex(this.theme.dim)(`  Loading ${path}...`));
      
      let executed = 0;
      let errors = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        
        // Skip kernel declarations, just execute instructions and data
        if (trimmed.startsWith('kernel') || trimmed.startsWith('cycle') || 
            trimmed === '{' || trimmed === '}' || trimmed.startsWith('config')) {
          continue;
        }
        
        const result = executeInstruction(this.state, trimmed);
        if (result.success) {
          executed++;
        } else {
          errors++;
          console.log(chalk.hex(this.theme.error)(`  Error: ${result.error}`));
          console.log(chalk.hex(this.theme.dim)(`    Line: ${trimmed}`));
        }
      }
      
      console.log(chalk.hex(this.theme.success)(`  ✓ Executed ${executed} instructions`) + 
                  (errors > 0 ? chalk.hex(this.theme.error)(`, ${errors} errors`) : ''));
      this.updatePrompt();
    } catch (e: any) {
      console.log(chalk.hex(this.theme.error)(`  Error loading file: ${e.message}`));
    }
  }
  
  private saveHistory(path: string): void {
    try {
      const content = this.state.history.join('\n');
      fs.writeFileSync(path, content);
      console.log(chalk.hex(this.theme.success)(`  ✓ Saved ${this.state.history.length} commands to ${path}`));
    } catch (e: any) {
      console.log(chalk.hex(this.theme.error)(`  Error saving file: ${e.message}`));
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MAIN LOOP
  // ─────────────────────────────────────────────────────────────────────────
  
  async run(): Promise<void> {
    this.printWelcome();
    this.rl.prompt();
    
    this.rl.on('line', (input: string) => {
      const trimmed = input.trim();
      
      if (!trimmed) {
        this.rl.prompt();
        return;
      }
      
      // Check for dot commands (but .data is an instruction, not a REPL command)
      if (trimmed.startsWith('.') && !trimmed.toLowerCase().startsWith('.data')) {
        const handled = this.handleDotCommand(trimmed);
        if (!handled) {
          console.log(chalk.hex(this.theme.error)(`  Unknown command: ${trimmed}`));
          console.log(chalk.hex(this.theme.dim)('  Type .help for available commands'));
        }
      } else {
        // Execute as instruction (including .data declarations)
        const result = executeInstruction(this.state, trimmed);
        this.printResult(result);
        
        // Clear lastModified after showing result
        for (let row = 0; row < this.state.gridHeight; row++) {
          for (let col = 0; col < this.state.gridWidth; col++) {
            this.state.grid[row][col].lastModified = undefined;
          }
        }
      }
      
      if (this.running) {
        this.updatePrompt();
        this.rl.prompt();
      } else {
        console.log(chalk.hex(this.theme.dim)('\n  Goodbye!\n'));
        this.rl.close();
      }
    });
    
    this.rl.on('close', () => {
      process.exit(0);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════════════════════════════════════════

export const replCommand = new Command('repl')
  .description('Interactive DSL shell for line-by-line execution')
  .option('-g, --grid <size>', 'Grid size (default: 4x4)', '4x4')
  .action(async (options: { grid: string }) => {
    const repl = new Repl();
    await repl.run();
  });

export { Repl };
