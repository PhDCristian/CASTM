/**
 * OpenEdge-DSL Abstract Syntax Tree Types
 *
 * Defines the AST node structures produced by the parser.
 */

/**
 * Represents a single instruction within a cycle
 */
export interface Instruction {
  /** The opcode (e.g., SADD, LWI, NOP) */
  opcode: string;
  /** The operands for this instruction */
  operands: string[];
  /** Line number in the original source */
  originalLine: number;
}

/**
 * Represents a cycle block containing instructions for each PE
 */
export interface CycleBlock {
  /** The absolute cycle number (0-based) */
  cycleNumber: number;
  /** Optional label for this cycle (for branch targets) */
  label?: string;
  /** Instructions mapped by "row,col" coordinate string */
  instructions: Map<string, Instruction>;
}

/**
 * Kernel configuration parameters
 */
export interface KernelConfig {
  /** Column mask indicating active columns (e.g., 0xF for all 4) */
  mask: number;
  /** Starting address for the program counter */
  startAddr: number;
}

/**
 * IO configuration for load/store addresses
 */
export interface IoConfig {
  /** Initial load addresses per column for LWD operations */
  loadAddrs: number[];
  /** Initial store addresses per column for SWD operations */
  storeAddrs: number[];
}

/**
 * Assertion definition for .assert directive
 */
export interface Assertion {
  /** Cycle number when the assertion should be checked */
  cycle: number;
  /** Row coordinate of the PE */
  row: number;
  /** Column coordinate of the PE */
  col: number;
  /** Register to check (R0, R1, R2, R3, ROUT) */
  register: string;
  /** Expected value */
  value: number;
}

/**
 * Main kernel AST structure representing a complete DSL program
 */
export interface KernelAst {
  /** Kernel name from the string literal */
  name: string;
  /** Kernel configuration (mask and start address) */
  config: KernelConfig;
  /** List of cycle blocks in execution order */
  cycles: CycleBlock[];
  /** Memory initialization data: address -> values array */
  memoryInit: Map<number, number[]>;
  /** IO configuration for load/store */
  ioConfig: IoConfig;
  /** Maximum cycles limit from .limit directive */
  maxCycles?: number;
  /** List of assertions from .assert directives */
  assertions: Assertion[];
}

/**
 * Pragma modifier with optional argument
 */
export interface PragmaModifier {
  /** Modifier name (e.g., 'collapse') */
  name: string;
  /** Optional numeric argument (e.g., 2 for collapse(2)) */
  arg?: number;
}

/**
 * Pragma directive parsed from source
 */
export interface PragmaDirective {
  /** Pragma name (e.g., 'unroll', 'parallel', 'reduce') */
  name: string;
  /** Optional numeric arguments */
  args?: number[];
  /** Optional modifiers with arguments (e.g., 'collapse(2)' for #pragma parallel collapse(2)) */
  modifiers?: PragmaModifier[];
  /** Line number where the pragma was defined */
  line: number;
}

/**
 * Condition structure for if/else and while statements
 */
export interface Condition {
  /** Left operand (register or immediate) */
  operand1: string;
  /** Comparison operator (==, !=, <, >, <=, >=) */
  operator: string;
  /** Right operand (register or immediate) */
  operand2: string;
}

/**
 * Location coordinates for PE references
 */
export interface PeLocation {
  /** Column coordinate */
  col: number;
  /** Row coordinate */
  row: number;
}

/**
 * Parsed cycle structure used during parsing
 */
export interface ParsedCycle {
  /** Instructions mapped by "col,row" key */
  instructions: Map<string, Instruction>;
}

/**
 * If-else structure for conditional execution
 */
export interface IfElseStructure {
  /** The comparison condition */
  condition: Condition;
  /** PE location for the conditional */
  location: PeLocation;
  /** Cycles to execute when condition is true */
  thenCycles: ParsedCycle[];
  /** Cycles to execute when condition is false */
  elseCycles: ParsedCycle[];
}

/**
 * Body element types for loop parsing
 */
export type BodyElementType = 'cycle' | 'if-else';

/**
 * Body element wrapper for parsed loop contents
 */
export interface BodyElement {
  type: BodyElementType;
  data: ParsedCycle | IfElseStructure;
}

/**
 * While loop analysis result for optimization
 */
export interface WhileBodyAnalysis {
  /** Whether the loop body can be fused with the condition check */
  canFuse: boolean;
  /** Column of the body PE */
  bodyCol: number;
  /** Row of the body PE */
  bodyRow: number;
  /** Neighbor reference for reading body output (RCL, RCR, RCT, RCB) */
  neighborRef: string;
}
