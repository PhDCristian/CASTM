/**
 * OpenEdge-DSL Compiler
 *
 * Main entry point for compiling OpenEdge-DSL source code to CGRA CSV format.
 */

// ==========================================
// Imports from Modular Structure
// ==========================================
import {
  // Types
  Token,
  TokenType,
  Assertion,
  KernelAst,
  SymbolTable,
  PragmaDirective,
  PragmaModifier,
  // Parser state (for modular parser integration)
  type ParserState,
  // Lexer
  tokenize,
  // TokenStream
  createTokenStream,
  // Codegen
  generateCsv as generateCsvFromAst,
  // Pattern generators
  generateReduceTokens,
  generateStencilTokens,
  // Directive parsing
  parseDirective,
  // Pragma parsing
  parseReducePragmaArgs,
  parseStencilPragmaArgs,
  parseRoutePragmaArgs,
  parseScanPragmaArgs,
  parseBroadcastPragmaArgs,
  isCodeGeneratingPragma,
  generateRouteTokens,
  generateScanTokens,
  generateBroadcastTokens,
  // Cycle parsing
  type CycleParserContext,
  parseCycleBlock,
  parseOptionalLabel,
  // Function parsing
  expandFunctionCall,
  // Modular parsers
  type ForLoopParseContext,
  parseForLoop,
  type WhileLoopParseContext,
  parseWhileLoop,
  type IfElseParseContext,
  parseIfElse
} from './index';

// Re-export types for backwards compatibility
export { TokenType, tokenize };
export type { Token, Assertion };

// ==========================================
// Compilation Result (kept here for now)
// ==========================================

/** Memory region with optional name */
export interface MemoryRegionInfo {
  start: number;
  values: number[];
  name?: string;
}

export interface CompilationResult {
  success: boolean;
  csv?: string;
  memoryInit?: Map<number, number[]>;
  /** Memory regions with names (use this instead of memoryInit for UI) */
  memoryRegions?: MemoryRegionInfo[];
  ioConfig?: {
    loadAddrs: number[];
    storeAddrs: number[];
  };
  maxCycles?: number;
  assertions?: Assertion[];
  /** Suggested grid size based on 2D arrays */
  suggestedGridSize?: { width: number; height: number };
  error?: string;
  line?: number;
}

// ==========================================
// Main Compiler Function
// ==========================================

/**
 * Calculates suggested grid size based on 2D arrays in the symbol table
 * Returns the maximum rows and cols from all 2D arrays
 */
function calculateSuggestedGridSize(symbols: SymbolTable): { width: number; height: number } | undefined {
  let maxRows = 0;
  let maxCols = 0;
  let has2DArray = false;

  for (const [, array] of symbols.namedArrays) {
    if (array.is2D && array.rows && array.cols) {
      has2DArray = true;
      if (array.rows > maxRows) maxRows = array.rows;
      if (array.cols > maxCols) maxCols = array.cols;
    }
  }

  // Only return suggestion if there's at least one 2D array
  if (!has2DArray) return undefined;

  return {
    width: maxCols,  // cols = width (x-axis)
    height: maxRows  // rows = height (y-axis)
  };
}

export function compileDslToCsv(dslCode: string): CompilationResult {
  try {
    // 1. Tokenize (using modular lexer)
    const tokens = tokenize(dslCode);

    // 2. Parse & Build AST (Pass 1 - Structure)
    const { ast, symbols } = parse(tokens);

    // 3. Resolve Symbols & Generate Code (Pass 2 - Emission)
    // Using modular codegen
    const result = generateCsvFromAst(ast, symbols);

    // 4. Calculate suggested grid size from 2D arrays
    const suggestedGridSize = calculateSuggestedGridSize(symbols);

    // 5. Build memoryRegions with names from symbol table
    const memoryRegions: MemoryRegionInfo[] = [];

    // Create lookup map: address -> array name (for named arrays)
    const addressToName = new Map<number, string>();
    for (const [name, array] of symbols.namedArrays) {
      addressToName.set(array.baseAddress, name);
    }

    // Build regions from memoryInit, adding names where available
    for (const [address, values] of ast.memoryInit) {
      memoryRegions.push({
        start: address,
        values,
        name: addressToName.get(address) // Will be undefined for anonymous data
      });
    }

    return {
      success: true,
      csv: result.csv,
      memoryInit: ast.memoryInit,
      memoryRegions,
      ioConfig: ast.ioConfig,
      maxCycles: ast.maxCycles,
      assertions: ast.assertions,
      suggestedGridSize
    };
  } catch (e: any) {
    return {
      success: false,
      error: e.message,
      line: e.line
    };
  }
}

// ==========================================
// 2. Parser (Pass 1)
// ==========================================

function parse(tokens: Token[]): { ast: KernelAst, symbols: SymbolTable } {
  // Create TokenStream wrapper for modular parser integration
  const stream = createTokenStream(tokens);

  // Keep current variable for backwards compatibility during migration
  // This will be removed once all code uses stream directly
  let current = 0;
  // Sync helper: call before using modular parsers
  const syncToStream = () => { stream.position = current; };
  // Sync helper: call after using modular parsers
  const syncFromStream = () => { current = stream.position; };

  // Use ParserState object to enable sharing with modular parsers
  const state: ParserState = {
    ast: {
      name: 'Untitled',
      config: { mask: 0xF, startAddr: 0 },
      cycles: [],
      memoryInit: new Map(),
      ioConfig: {
        loadAddrs: [],
        storeAddrs: []
      },
      assertions: []
    },
    symbols: {
      constants: new Map(),
      aliases: new Map(),
      labels: new Map(),
      functions: new Map(),
      namedArrays: new Map(),
      modules: new Map(),
    },
    cycleCounter: 0,
    nextFreeAddress: 0,
    globalDataIndex: 0, // Tracks index in flattened data[] array
    activePragma: null
  };

  // Local aliases for convenience (references to state properties)
  const { ast, symbols } = state;

  // Helper functions using current variable (will migrate to stream later)
  function peek() { return tokens[current]; }
  function advance() { return tokens[current++]; }
  function match(type: TokenType, value?: string) {
    const token = peek();
    if (token && token.type === type && (!value || token.value.toLowerCase() === value.toLowerCase())) {
      return advance();
    }
    return null;
  }
  function expect(type: TokenType, value?: string) {
    const token = match(type, value);
    if (!token) {
      const expected = value ? `${type}('${value}')` : TokenType[type];
      const actual = peek() ? `${TokenType[peek().type]}('${peek().value}')` : 'EOF';
      throw { message: `Expected ${expected}, but found ${actual}`, line: peek() ? peek().line : -1 };
    }
    return token;
  }

  // --- Parsing Logic ---

  // Track active pragma at top level (for function definitions)
  let _topLevelPragma: PragmaDirective | null = null; // Reserved for future pragma handling

  // 1. Parse Directives & Macros (Top Level)
  while (peek().type === TokenType.DIRECTIVE || peek().type === TokenType.KEYWORD || peek().type === TokenType.PRAGMA) {
    // Handle Top-Level Pragmas (e.g., #pragma inline before function)
    if (peek().type === TokenType.PRAGMA) {
      const pragmaToken = advance();
      const pragmaName = pragmaToken.value.toLowerCase();

      // Parse optional arguments
      let pragmaArgs: number[] | undefined;
      if (peek().type === TokenType.OPERATOR && peek().value === '(') {
        advance();
        pragmaArgs = [];
        if (peek().type !== TokenType.OPERATOR || peek().value !== ')') {
          do {
            const numToken = expect(TokenType.NUMBER);
            pragmaArgs.push(parseInt(numToken.value));
          } while (match(TokenType.OPERATOR, ','));
        }
        expect(TokenType.OPERATOR, ')');
      }

      _topLevelPragma = { name: pragmaName, args: pragmaArgs, line: pragmaToken.line };
      continue;
    }

    // Handle Functions (previously 'macro')
    if (match(TokenType.KEYWORD, 'function')) {
      // Consume _topLevelPragma if present (e.g., #pragma inline)
      _topLevelPragma = null; // For now, inline is default behavior
      const name = expect(TokenType.IDENTIFIER).value;
      expect(TokenType.OPERATOR, '(');
      const params: string[] = [];
      const paramTypes: string[] = [];
      if (peek().type !== TokenType.OPERATOR || peek().value !== ')') {
        do {
          const paramName = expect(TokenType.IDENTIFIER).value;
          params.push(paramName);
          // Check for optional type annotation: param: TYPE
          if (peek().type === TokenType.OPERATOR && peek().value === ':') {
            advance(); // consume ':'
            const paramType = expect(TokenType.IDENTIFIER).value;
            paramTypes.push(paramType);
          } else {
            paramTypes.push(''); // no type specified
          }
        } while (match(TokenType.OPERATOR, ','));
      }
      expect(TokenType.OPERATOR, ')');
      expect(TokenType.BRACE_OPEN);

      // Capture tokens until matching brace close
      const funcTokens: Token[] = [];
      let braceCount = 1;
      while (braceCount > 0 && peek().type !== TokenType.EOF) {
        const t = advance();
        if (t.type === TokenType.BRACE_OPEN) braceCount++;
        if (t.type === TokenType.BRACE_CLOSE) braceCount--;
        if (braceCount > 0) funcTokens.push(t);
      }

      // Only store paramTypes if at least one type was specified
      const hasTypes = paramTypes.some(t => t !== '');
      symbols.functions.set(name, {
        params,
        tokens: funcTokens,
        ...(hasTypes && { paramTypes })
      });
      continue;
    }

    // Handle Directives - using modular parser
    if (peek().type === TokenType.DIRECTIVE) {
      const directive = advance();
      syncToStream();
      const handled = parseDirective(stream, state, directive.value);
      syncFromStream();
      if (!handled) {
        throw { message: `Unknown directive ${directive.value}`, line: directive.line };
      }
    } else {
      // It's a keyword but not 'macro'. If it's 'kernel', break loop.
      if (peek().value.toLowerCase() === 'kernel') break;
      throw { message: `Unexpected keyword ${peek().value} at top level`, line: peek().line };
    }
  }

  // 2. Parse Kernel
  expect(TokenType.KEYWORD, 'kernel');
  ast.name = match(TokenType.STRING)?.value || 'Untitled';
  expect(TokenType.BRACE_OPEN);

  // 3. Parse Config
  if (match(TokenType.KEYWORD, 'config')) {
    expect(TokenType.OPERATOR, '('); // (
    const maskToken = expect(TokenType.NUMBER);
    expect(TokenType.OPERATOR, ','); // ,
    const addrToken = expect(TokenType.NUMBER);
    expect(TokenType.OPERATOR, ')'); // )
    expect(TokenType.SEMICOLON);

    ast.config.mask = parseInt(maskToken.value);
    ast.config.startAddr = parseInt(addrToken.value);
  }

  // NOTE: generateReduceTokens and generateStencilTokens moved to @core/dsl/parser/pattern-generators.ts
  // Imported from @core/dsl at the top of this file

  // 4. Parse Cycles / Repeats / Asserts / Control Flow
  function parseBlock(until: TokenType) {
    // Track active pragma for the next construct
    let activePragma: PragmaDirective | null = null;

    while (peek().type !== until && peek().type !== TokenType.EOF) {

      // Handle Pragma: #pragma unroll, #pragma no_unroll, etc.
      if (peek().type === TokenType.PRAGMA) {
        const pragmaToken = advance();
        const pragmaName = pragmaToken.value.toLowerCase();

        // Code-generating pragmas (reduce, stencil) use modular parsers
        if (isCodeGeneratingPragma(pragmaName)) {
          syncToStream();
          if (pragmaName === 'reduce') {
            const args = parseReducePragmaArgs(stream);
            if (!args) {
              throw { message: `#pragma reduce requires arguments: (operation, srcReg, destReg)`, line: pragmaToken.line };
            }
            const reduceTokens = generateReduceTokens(args.operation, args.srcReg, args.destReg, pragmaToken.line);
            stream.insertTokens(reduceTokens);
          } else if (pragmaName === 'stencil') {
            const args = parseStencilPragmaArgs(stream);
            if (!args) {
              throw { message: `#pragma stencil requires arguments: (pattern, operation, srcReg, destReg)`, line: pragmaToken.line };
            }
            const stencilTokens = generateStencilTokens(args.pattern, args.operation, args.srcReg, args.destReg, pragmaToken.line);
            stream.insertTokens(stencilTokens);
          } else if (pragmaName === 'route') {
            const args = parseRoutePragmaArgs(stream);
            if (!args) {
              throw { message: `#pragma route requires arguments: (src) -> (dst) payload(REG) accum(REG) or dest(REG) op(...)`, line: pragmaToken.line };
            }
            // Generate route tokens with line tracking
            const routeTokens = generateRouteTokens({
              src: args.src,
              dst: args.dst,
              payload: args.payload,
              accum: args.accum,
              line: pragmaToken.line,
              customOp: args.customOp
            });
            stream.insertTokens(routeTokens);
          } else if (pragmaName === 'scan') {
            const args = parseScanPragmaArgs(stream);
            if (!args) {
              throw { message: `#pragma scan requires arguments: (operation, srcReg, dstReg, direction[, mode])`, line: pragmaToken.line };
            }
            const scanTokens = generateScanTokens({
              operation: args.operation,
              srcReg: args.srcReg,
              dstReg: args.dstReg,
              direction: args.direction,
              mode: args.mode,
              line: pragmaToken.line
            });
            stream.insertTokens(scanTokens);
          } else if (pragmaName === 'broadcast') {
            const args = parseBroadcastPragmaArgs(stream);
            if (!args) {
              throw { message: `#pragma broadcast requires arguments: (value=REG, from=@row,col, to=scope)`, line: pragmaToken.line };
            }
            const broadcastTokens = generateBroadcastTokens({
              valueReg: args.valueReg,
              fromRow: args.fromRow,
              fromCol: args.fromCol,
              scope: args.scope,
              line: pragmaToken.line
            });
            stream.insertTokens(broadcastTokens);
          }
          syncFromStream();
          continue;
        }

        // Non-code-generating pragmas - parse optional modifiers and arguments
        // Valid modifiers for specific pragmas (e.g., 'collapse' for 'parallel')
        const PRAGMA_MODIFIERS: Record<string, string[]> = {
          'parallel': ['collapse']
        };

        let pragmaModifiers: PragmaModifier[] | undefined;
        const validModifiers = PRAGMA_MODIFIERS[pragmaName] || [];

        // Check for modifiers (identifiers after pragma name, optionally with arguments)
        // e.g., #pragma parallel collapse or #pragma parallel collapse(2)
        while (peek().type === TokenType.IDENTIFIER) {
          const modifier = peek().value.toLowerCase();
          if (validModifiers.includes(modifier)) {
            pragmaModifiers = pragmaModifiers || [];
            advance(); // consume modifier name

            // Check for optional modifier argument: collapse(N)
            const modifierObj: PragmaModifier = { name: modifier };
            if (peek().type === TokenType.OPERATOR && peek().value === '(') {
              advance(); // consume '('
              if (peek().type === TokenType.NUMBER) {
                modifierObj.arg = parseInt(advance().value, 10);
              }
              expect(TokenType.OPERATOR, ')');
            }

            pragmaModifiers.push(modifierObj);
          } else {
            // Not a valid modifier, stop looking
            break;
          }
        }

        // Parse optional arguments in parentheses
        let pragmaArgs: number[] | undefined;
        if (peek().type === TokenType.OPERATOR && peek().value === '(') {
          advance(); // (
          pragmaArgs = [];
          if (peek().type !== TokenType.OPERATOR || peek().value !== ')') {
            do {
              if (peek().type === TokenType.NUMBER) {
                pragmaArgs.push(parseInt(advance().value));
              } else {
                advance(); // Skip identifier args for loop pragmas
              }
            } while (match(TokenType.OPERATOR, ','));
          }
          expect(TokenType.OPERATOR, ')');
        }

        activePragma = {
          name: pragmaName,
          args: pragmaArgs,
          modifiers: pragmaModifiers,
          line: pragmaToken.line
        };
        continue;
      }

      // Handle Function Call (using modular parser)
      if (peek().type === TokenType.IDENTIFIER && symbols.functions.has(peek().value)) {
        const funcName = advance().value;
        const func = symbols.functions.get(funcName)!;
        current = expandFunctionCall(tokens, current, func, funcName);
        continue;
      }

      // Handle For Loop (using modular parser)
      if (match(TokenType.KEYWORD, 'for')) {
        const forCtx: ForLoopParseContext = {
          tokens,
          current,
          state
        };

        const result = parseForLoop(forCtx, activePragma);

        // Consume pragma if it was used
        if (activePragma?.name === 'no_unroll' ||
          activePragma?.name === 'parallel' ||
          activePragma?.name === 'unroll') {
          activePragma = null;
        }

        if (!result.success) {
          throw { message: result.error, line: result.line };
        }

        // Update local position
        current = result.current;

        // Inject tokens if present
        if (result.tokensToInject) {
          tokens.splice(current, 0, ...result.tokensToInject);
        }

        continue;
      }

      // Handle While Loop (using modular parser)
      if (match(TokenType.KEYWORD, 'while')) {
        const whileCtx: WhileLoopParseContext = {
          tokens,
          current,
          state
        };

        const result = parseWhileLoop(whileCtx, activePragma);

        // Consume pragma if it was used (no_fuse)
        if (activePragma?.name === 'no_fuse') {
          activePragma = null;
        }

        if (!result.success) {
          throw { message: result.error, line: result.line };
        }

        // Update local position
        current = result.current;

        // Handle result based on fusion mode
        if (result.tokensToInject) {
          // FUSED case: inject synthetic tokens
          tokens.splice(current, 0, ...result.tokensToInject);
        } else {
          // STANDARD case: add condition cycle and inject body + jump tokens
          if (result.conditionCycle) {
            ast.cycles.push(result.conditionCycle);
            state.cycleCounter++;
          }
          if (result.bodyTokensToInject) {
            tokens.splice(current, 0, ...result.bodyTokensToInject);
          }
          if (result.jumpTokensToAppend && result.bodyTokensToInject) {
            tokens.splice(current + result.bodyTokensToInject.length, 0, ...result.jumpTokensToAppend);
          }
        }

        // Register labels
        result.labels?.forEach(l => symbols.labels.set(l.name, l.cycleNumber));

        continue;
      }

      // Handle If-Else (using modular parser)
      if (match(TokenType.KEYWORD, 'if')) {
        // Create context for modular parser with parseBlock callback
        const ifElseCtx: IfElseParseContext = {
          tokens,
          current,
          state,
          parseBlockCallback: (until: TokenType) => {
            // Sync position before callback
            current = ifElseCtx.current;
            parseBlock(until);
            // Sync position back after callback
            ifElseCtx.current = current;
          }
        };

        const result = parseIfElse(ifElseCtx);

        if (!result.success) {
          throw { message: result.error, line: result.line };
        }

        // Update local position
        current = result.current;

        // Add cycles to AST
        if (result.branchCycle) ast.cycles.push(result.branchCycle);
        if (result.jumpCycle) ast.cycles.push(result.jumpCycle);

        // Register labels
        result.labels?.forEach(l => symbols.labels.set(l.name, l.cycleNumber));

        continue;
      }

      // Handle Assert (using modular parser)
      if (peek().type === TokenType.DIRECTIVE && peek().value === '.assert') {
        advance(); // Consume the .assert directive
        syncToStream();
        parseDirective(stream, state, '.assert');
        syncFromStream();
        continue;
      }

      // Check for Label using modular parser
      syncToStream();
      const label = parseOptionalLabel(stream, symbols, state.cycleCounter);
      syncFromStream();

      expect(TokenType.KEYWORD, 'cycle');

      // Use modular cycle parser
      syncToStream();
      const cycleCtx: CycleParserContext = {
        cycleCounter: state.cycleCounter,
        symbols,
        tokens,
        current: stream.position
      };
      const cycleResult = parseCycleBlock(stream, label, cycleCtx);
      syncFromStream();

      // When tokens were injected (function expansion), the closing brace wasn't consumed
      // We need to consume it now and add the cycle to the AST
      if (cycleResult.tokensInjected) {
        // Consume the closing brace that wasn't consumed during parsing
        expect(TokenType.BRACE_CLOSE);
      }

      // Always add the cycle to the AST - the cycle is complete regardless of token injection
      ast.cycles.push(cycleResult.cycleBlock);
      state.cycleCounter = cycleResult.cycleCounter;
    }
  }

  parseBlock(TokenType.BRACE_CLOSE);

  expect(TokenType.BRACE_CLOSE); // Close Kernel

  return { ast, symbols };
}

// ==========================================
// NOTE: Code Generator moved to @core/dsl/codegen
// The generateCsv function is now imported as generateCsvFromAst
// ==========================================
