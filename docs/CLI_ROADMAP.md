# OpenEdge CLI - Development Roadmap

> **Status:** In Development  
> **Version Target:** v0.2.0 → v0.5.0  
> **Last Updated:** January 2025

## Conventions

- `[ ]` = Not started
- `[~]` = In progress  
- `[x]` = Completed (all tests passing)
- `[!]` = Blocked

**Rule:** A task is ONLY marked `[x]` when ALL associated tests pass.

---

# Epic 1: Language Server Protocol (LSP)

**Goal:** Provide IDE integration for VS Code, Neovim, and Emacs with real-time diagnostics, autocompletion, and navigation.

**Command:** `openedge lsp`

## 1.1 LSP Core Infrastructure

### 1.1.1 Server Bootstrap
- [ ] Create `src/cli/lsp/server.ts` - Main LSP entry point
- [ ] Create `src/cli/lsp/connection.ts` - Handle client connection
- [ ] Implement `initialize` handler with capabilities
- [ ] Implement `shutdown` and `exit` handlers
- [ ] Add CLI command `openedge lsp` to start server

**Tests:**
```
test/lsp/server.test.ts
├── [ ] should start server on stdio
├── [ ] should respond to initialize request
├── [ ] should return correct capabilities
├── [ ] should handle shutdown gracefully
└── [ ] should exit with code 0 after shutdown
```

### 1.1.2 Document Synchronization
- [ ] Create `src/cli/lsp/documents.ts` - Document manager
- [ ] Implement `textDocument/didOpen` handler
- [ ] Implement `textDocument/didChange` handler  
- [ ] Implement `textDocument/didClose` handler
- [ ] Implement `textDocument/didSave` handler
- [ ] Support incremental sync for performance

**Tests:**
```
test/lsp/documents.test.ts
├── [ ] should track opened documents
├── [ ] should update content on change
├── [ ] should remove document on close
├── [ ] should handle incremental updates
├── [ ] should handle full sync fallback
└── [ ] should emit events on document changes
```

### 1.1.3 Configuration Management
- [ ] Create `src/cli/lsp/config.ts` - Settings handler
- [ ] Implement `workspace/didChangeConfiguration`
- [ ] Support per-workspace settings
- [ ] Define configuration schema

**Tests:**
```
test/lsp/config.test.ts
├── [ ] should load default configuration
├── [ ] should update on configuration change
├── [ ] should merge workspace settings
└── [ ] should validate configuration schema
```

---

## 1.2 Diagnostics (Errors & Warnings)

### 1.2.1 Syntax Error Diagnostics
- [ ] Create `src/cli/lsp/diagnostics.ts` - Diagnostic provider
- [ ] Parse document and collect syntax errors
- [ ] Map parser errors to LSP Diagnostic format
- [ ] Include error location (line, column, length)
- [ ] Include error message and severity
- [ ] Publish diagnostics on document change

**Tests:**
```
test/lsp/diagnostics-syntax.test.ts
├── [ ] should report missing semicolon
├── [ ] should report invalid opcode
├── [ ] should report unclosed brace
├── [ ] should report invalid register name
├── [ ] should report correct line number
├── [ ] should report correct column number
├── [ ] should clear diagnostics when fixed
└── [ ] should handle multiple errors
```

### 1.2.2 Semantic Error Diagnostics
- [ ] Detect undefined data labels
- [ ] Detect undefined registers in context
- [ ] Detect duplicate kernel names
- [ ] Detect PE coordinate out of bounds
- [ ] Detect cycle ordering issues

**Tests:**
```
test/lsp/diagnostics-semantic.test.ts
├── [ ] should report undefined data label
├── [ ] should report PE coordinate out of bounds (4x4)
├── [ ] should report duplicate kernel name
├── [ ] should report invalid cycle reference
└── [ ] should not report valid code
```

### 1.2.3 Warning Diagnostics
- [ ] Warn on unused data declarations
- [ ] Warn on unreachable code after EXIT
- [ ] Warn on potential memory conflicts
- [ ] Warn on suboptimal PE utilization

**Tests:**
```
test/lsp/diagnostics-warnings.test.ts
├── [ ] should warn on unused .data
├── [ ] should warn on code after EXIT
├── [ ] should warn on same-cycle memory conflict
└── [ ] should suggest better PE placement
```

---

## 1.3 Autocompletion

### 1.3.1 Opcode Completion
- [ ] Create `src/cli/lsp/completion.ts` - Completion provider
- [ ] Complete opcodes (LWI, SWI, SADD, etc.)
- [ ] Include opcode documentation in detail
- [ ] Include signature help

**Tests:**
```
test/lsp/completion-opcodes.test.ts
├── [ ] should complete "LW" to "LWI"
├── [ ] should complete "SA" to "SADD"
├── [ ] should show all opcodes on empty trigger
├── [ ] should include documentation
├── [ ] should show signature (Rd, Rs1, Rs2)
└── [ ] should filter by prefix
```

### 1.3.2 Register Completion
- [ ] Complete register names (R0-R7, ROUT, RCL, etc.)
- [ ] Show register description
- [ ] Context-aware (source vs destination)

**Tests:**
```
test/lsp/completion-registers.test.ts
├── [ ] should complete "R" to R0-R7
├── [ ] should complete "RC" to RCL, RCR
├── [ ] should complete "RO" to ROUT
├── [ ] should include ZERO, IMM
└── [ ] should show register description
```

### 1.3.3 Data Label Completion
- [ ] Complete defined .data labels
- [ ] Show data type and size
- [ ] Complete array indices

**Tests:**
```
test/lsp/completion-data.test.ts
├── [ ] should complete defined data labels
├── [ ] should show data size in detail
├── [ ] should complete "input[" with indices
├── [ ] should not suggest undefined labels
└── [ ] should update on new .data declarations
```

### 1.3.4 Snippet Completion
- [ ] Kernel template snippet
- [ ] Cycle block snippet
- [ ] Common patterns (load-compute-store)

**Tests:**
```
test/lsp/completion-snippets.test.ts
├── [ ] should insert kernel template
├── [ ] should insert cycle block
├── [ ] should insert load-compute-store pattern
└── [ ] should position cursor correctly
```

---

## 1.4 Hover Information

### 1.4.1 Opcode Hover
- [ ] Create `src/cli/lsp/hover.ts` - Hover provider
- [ ] Show opcode full name and description
- [ ] Show latency in cycles
- [ ] Show operand format
- [ ] Show example usage

**Tests:**
```
test/lsp/hover-opcode.test.ts
├── [ ] should show SADD description on hover
├── [ ] should show latency "1 cycle"
├── [ ] should show operand format
├── [ ] should show example
└── [ ] should work for all opcodes
```

### 1.4.2 Register Hover
- [ ] Show register purpose
- [ ] Show routing direction for RCL/RCR/RCU/RCD
- [ ] Show special register behavior (ZERO, IMM)

**Tests:**
```
test/lsp/hover-register.test.ts
├── [ ] should show R0-R7 as general purpose
├── [ ] should show RCL as "Route from left PE"
├── [ ] should show ZERO as "Always 0"
└── [ ] should show ROUT as "Route output"
```

### 1.4.3 Data Label Hover
- [ ] Show data declaration
- [ ] Show values if literal
- [ ] Show size

**Tests:**
```
test/lsp/hover-data.test.ts
├── [ ] should show .data declaration
├── [ ] should show values "{ 10, 20 }"
├── [ ] should show size "2 elements"
└── [ ] should show "undefined" for missing
```

---

## 1.5 Navigation

### 1.5.1 Go to Definition
- [ ] Create `src/cli/lsp/definition.ts` - Definition provider
- [ ] Jump to .data declaration from usage
- [ ] Jump to kernel from reference

**Tests:**
```
test/lsp/definition.test.ts
├── [ ] should jump to .data declaration
├── [ ] should jump to kernel definition
├── [ ] should return null for built-ins
└── [ ] should handle multiple definitions
```

### 1.5.2 Find References
- [ ] Find all usages of data label
- [ ] Find all usages of kernel name

**Tests:**
```
test/lsp/references.test.ts
├── [ ] should find all data label usages
├── [ ] should find all kernel references
├── [ ] should include declaration
└── [ ] should return empty for no references
```

### 1.5.3 Document Symbols
- [ ] Create `src/cli/lsp/symbols.ts` - Symbol provider
- [ ] List all kernels
- [ ] List all data declarations
- [ ] List all cycles within kernel

**Tests:**
```
test/lsp/symbols.test.ts
├── [ ] should list kernel as symbol
├── [ ] should list .data as symbol
├── [ ] should nest cycles under kernel
├── [ ] should include symbol kind
└── [ ] should include range
```

---

## 1.6 Code Actions

### 1.6.1 Quick Fixes
- [ ] Create `src/cli/lsp/actions.ts` - Code action provider
- [ ] Fix: Add missing semicolon
- [ ] Fix: Correct register typo (R9 → R0)
- [ ] Fix: Add missing .data declaration

**Tests:**
```
test/lsp/actions-quickfix.test.ts
├── [ ] should offer "Add semicolon" fix
├── [ ] should offer "Did you mean R0?" fix
├── [ ] should offer "Declare data label" fix
└── [ ] should apply fix correctly
```

### 1.6.2 Refactoring
- [ ] Rename data label
- [ ] Extract cycle block
- [ ] Inline data value

**Tests:**
```
test/lsp/actions-refactor.test.ts
├── [ ] should rename data label everywhere
├── [ ] should extract instructions to new cycle
└── [ ] should inline simple data values
```

---

## 1.7 Editor Extensions

### 1.7.1 VS Code Extension
- [ ] Create `editors/vscode/` directory
- [ ] Create `package.json` with extension manifest
- [ ] Create language configuration (brackets, comments)
- [ ] Create TextMate grammar for syntax highlighting
- [ ] Configure LSP client to spawn `openedge lsp`
- [ ] Add extension icon
- [ ] Write README for marketplace

**Tests:**
```
test/editors/vscode.test.ts
├── [ ] should activate on .dsl files
├── [ ] should start LSP server
├── [ ] should provide syntax highlighting
├── [ ] should show diagnostics
└── [ ] should provide completions
```

### 1.7.2 Neovim Configuration
- [ ] Create `editors/nvim/` directory
- [ ] Create lspconfig setup
- [ ] Create TreeSitter grammar (optional)
- [ ] Document installation steps

**Tests:**
```
test/editors/nvim.test.ts
├── [ ] should connect to LSP
├── [ ] should show diagnostics in signcolumn
└── [ ] should trigger completion
```

---

# Epic 2: Enhanced Watch Mode

**Goal:** Provide intelligent file watching with diff visualization and metrics tracking.

**Command:** `openedge watch [file] [options]`

## 2.1 Core Watch Infrastructure

### 2.1.1 File Watcher
- [ ] Create `src/cli/commands/watch.ts` - Watch command
- [ ] Use chokidar for cross-platform watching
- [ ] Watch single file or directory
- [ ] Implement debouncing (configurable)
- [ ] Handle file rename/delete gracefully

**Tests:**
```
test/cli/watch-core.test.ts
├── [ ] should detect file changes
├── [ ] should debounce rapid changes
├── [ ] should handle file deletion
├── [ ] should handle file rename
├── [ ] should watch directory recursively
└── [ ] should filter to .dsl files only
```

### 2.1.2 Compilation Pipeline
- [ ] Compile on change
- [ ] Cache previous result for comparison
- [ ] Track compilation time
- [ ] Handle compilation errors gracefully

**Tests:**
```
test/cli/watch-compile.test.ts
├── [ ] should compile on file change
├── [ ] should cache previous result
├── [ ] should measure compilation time
├── [ ] should continue watching after error
└── [ ] should report error clearly
```

---

## 2.2 Diff Visualization

### 2.2.1 CSV Diff (`--diff`)
- [ ] Create `src/cli/utils/csv-diff.ts` - CSV differ
- [ ] Compare CSV line by line
- [ ] Highlight added lines (green)
- [ ] Highlight removed lines (red)
- [ ] Highlight modified lines (yellow)
- [ ] Show context around changes

**Tests:**
```
test/cli/watch-diff.test.ts
├── [ ] should detect added CSV lines
├── [ ] should detect removed CSV lines
├── [ ] should detect modified CSV lines
├── [ ] should show unified diff format
├── [ ] should show context lines
└── [ ] should handle no changes
```

### 2.2.2 Metrics Delta (`--metrics`)
- [ ] Track cycles count
- [ ] Track PE utilization
- [ ] Track memory operations
- [ ] Show delta with arrows (↑↓)
- [ ] Color code improvements (green) vs regressions (red)

**Tests:**
```
test/cli/watch-metrics.test.ts
├── [ ] should show cycle delta
├── [ ] should show PE delta
├── [ ] should show memory delta
├── [ ] should color improvement green
├── [ ] should color regression red
└── [ ] should show "=" for no change
```

---

## 2.3 Notifications & Hooks

### 2.3.1 Desktop Notifications (`--notify`)
- [ ] Create `src/cli/utils/notify.ts` - Notification helper
- [ ] Send notification on successful compile
- [ ] Send notification on error
- [ ] Support macOS, Linux, Windows
- [ ] Include file name in notification

**Tests:**
```
test/cli/watch-notify.test.ts
├── [ ] should send success notification
├── [ ] should send error notification
├── [ ] should include file name
└── [ ] should respect --notify flag
```

### 2.3.2 Command Execution (`--exec`)
- [ ] Run custom command after successful compile
- [ ] Pass file path as argument
- [ ] Capture and display output
- [ ] Handle command errors

**Tests:**
```
test/cli/watch-exec.test.ts
├── [ ] should run command on success
├── [ ] should pass file path to command
├── [ ] should show command output
├── [ ] should not run on compile error
└── [ ] should handle command failure
```

---

## 2.4 UI Enhancements

### 2.4.1 Clear Screen (`--clear`)
- [ ] Clear terminal before each rebuild
- [ ] Preserve scroll history option
- [ ] Show timestamp of rebuild

**Tests:**
```
test/cli/watch-ui.test.ts
├── [ ] should clear screen on rebuild
├── [ ] should show timestamp
└── [ ] should respect --clear flag
```

### 2.4.2 Status Display
- [ ] Show watching status
- [ ] Show file being watched
- [ ] Show last compile time
- [ ] Show keyboard shortcuts (q to quit)

**Tests:**
```
test/cli/watch-status.test.ts
├── [ ] should show "Watching..." status
├── [ ] should show file path
├── [ ] should show last compile time
└── [ ] should show quit instructions
```

---

# Epic 3: Batch Compilation

**Goal:** Enable compilation of multiple files with parallel processing and aggregated reports.

**Command:** `openedge compile <glob> [options]`

## 3.1 Glob Pattern Support

### 3.1.1 File Discovery
- [ ] Create `src/cli/commands/compile-batch.ts`
- [ ] Support glob patterns (*.dsl, **/*.dsl)
- [ ] Support multiple patterns
- [ ] Exclude patterns (--exclude)
- [ ] Sort files deterministically

**Tests:**
```
test/cli/batch-glob.test.ts
├── [ ] should match *.dsl in current dir
├── [ ] should match **/*.dsl recursively  
├── [ ] should support multiple patterns
├── [ ] should exclude with --exclude
├── [ ] should sort files alphabetically
└── [ ] should handle no matches gracefully
```

---

## 3.2 Parallel Compilation

### 3.2.1 Worker Pool (`--parallel`)
- [ ] Create `src/cli/utils/worker-pool.ts`
- [ ] Spawn worker threads for compilation
- [ ] Default to CPU count - 1
- [ ] Support `--parallel <n>` for custom count
- [ ] Aggregate results from workers

**Tests:**
```
test/cli/batch-parallel.test.ts
├── [ ] should compile files in parallel
├── [ ] should use default worker count
├── [ ] should respect --parallel <n>
├── [ ] should aggregate results correctly
├── [ ] should handle worker errors
└── [ ] should be faster than sequential
```

---

## 3.3 Output Management

### 3.3.1 Output Directory (`--output`)
- [ ] Write CSV files to output directory
- [ ] Preserve directory structure
- [ ] Create directories as needed
- [ ] Handle file conflicts

**Tests:**
```
test/cli/batch-output.test.ts
├── [ ] should write to --output directory
├── [ ] should preserve subdirectory structure
├── [ ] should create directories
├── [ ] should overwrite existing files
└── [ ] should report output paths
```

---

## 3.4 Reporting

### 3.4.1 Summary Report (default)
- [ ] Show total files processed
- [ ] Show success/failure counts
- [ ] Show total time
- [ ] Show aggregated metrics

**Tests:**
```
test/cli/batch-report-summary.test.ts
├── [ ] should show file count
├── [ ] should show success count
├── [ ] should show failure count
├── [ ] should show total time
└── [ ] should show total cycles
```

### 3.4.2 JSON Report (`--format json`)
- [ ] Create structured JSON output
- [ ] Include per-file results
- [ ] Include metrics
- [ ] Include errors with locations

**Tests:**
```
test/cli/batch-report-json.test.ts
├── [ ] should output valid JSON
├── [ ] should include all files
├── [ ] should include metrics per file
├── [ ] should include errors
└── [ ] should be parseable by jq
```

### 3.4.3 Markdown Report (`--format markdown`)
- [ ] Create table with results
- [ ] GitHub-compatible formatting
- [ ] Include summary section

**Tests:**
```
test/cli/batch-report-markdown.test.ts
├── [ ] should output valid markdown
├── [ ] should include table
├── [ ] should include summary
└── [ ] should render on GitHub
```

---

## 3.5 Error Handling

### 3.5.1 Fail Fast (`--fail-fast`)
- [ ] Stop on first error
- [ ] Report which file failed
- [ ] Exit with non-zero code

**Tests:**
```
test/cli/batch-failfast.test.ts
├── [ ] should stop on first error
├── [ ] should report failing file
├── [ ] should exit with code 1
└── [ ] should not process remaining files
```

### 3.5.2 Continue on Error (`--continue`)
- [ ] Continue processing after errors
- [ ] Collect all errors
- [ ] Report summary at end
- [ ] Exit with non-zero if any failed

**Tests:**
```
test/cli/batch-continue.test.ts
├── [ ] should continue after error
├── [ ] should collect all errors
├── [ ] should report all errors at end
└── [ ] should exit with error code
```

---

# Epic 4: Benchmarking & Regression Testing

**Goal:** Enable performance tracking and automated regression detection.

**Command:** `openedge bench <dir> [options]`

## 4.1 Baseline Management

### 4.1.1 Save Baseline (`--save`)
- [ ] Create `src/cli/commands/bench.ts`
- [ ] Compile all files in directory
- [ ] Collect metrics (cycles, PEs, memory)
- [ ] Save to JSON file
- [ ] Include timestamp and version

**Tests:**
```
test/cli/bench-save.test.ts
├── [ ] should compile all .dsl files
├── [ ] should collect metrics
├── [ ] should save to JSON file
├── [ ] should include timestamp
├── [ ] should include CLI version
└── [ ] should overwrite existing baseline
```

### 4.1.2 Load Baseline (`--baseline`)
- [ ] Load baseline from file
- [ ] Validate baseline format
- [ ] Handle missing baseline gracefully
- [ ] Support baseline from URL (future)

**Tests:**
```
test/cli/bench-load.test.ts
├── [ ] should load baseline from file
├── [ ] should validate format
├── [ ] should error on invalid baseline
├── [ ] should warn on missing baseline
└── [ ] should handle version mismatch
```

---

## 4.2 Comparison

### 4.2.1 Metrics Comparison
- [ ] Compare current vs baseline
- [ ] Calculate absolute delta
- [ ] Calculate percentage delta
- [ ] Classify as improved/stable/regressed

**Tests:**
```
test/cli/bench-compare.test.ts
├── [ ] should calculate cycle delta
├── [ ] should calculate percentage
├── [ ] should classify improvement
├── [ ] should classify regression
├── [ ] should classify stable
└── [ ] should handle new files
```

### 4.2.2 Threshold Detection (`--threshold`)
- [ ] Set regression threshold percentage
- [ ] Fail if any file exceeds threshold
- [ ] Support per-metric thresholds
- [ ] Exit with appropriate code

**Tests:**
```
test/cli/bench-threshold.test.ts
├── [ ] should pass under threshold
├── [ ] should fail over threshold
├── [ ] should support --threshold 10%
├── [ ] should report failing files
└── [ ] should exit with code 1 on fail
```

---

## 4.3 Reporting

### 4.3.1 Table Report (`--format table`)
- [ ] Create formatted table
- [ ] Color code results
- [ ] Sort by configurable column
- [ ] Show summary row

**Tests:**
```
test/cli/bench-table.test.ts
├── [ ] should show table with columns
├── [ ] should color improvements green
├── [ ] should color regressions red
├── [ ] should sort by --sort option
└── [ ] should show summary totals
```

### 4.3.2 JSON Report (`--format json`)
- [ ] Output structured JSON
- [ ] Include comparison data
- [ ] Machine-readable format

**Tests:**
```
test/cli/bench-json.test.ts
├── [ ] should output valid JSON
├── [ ] should include baseline data
├── [ ] should include current data
├── [ ] should include deltas
└── [ ] should include pass/fail status
```

### 4.3.3 Markdown Report (`--format markdown`)
- [ ] GitHub Actions compatible
- [ ] Include table and summary
- [ ] Add to $GITHUB_STEP_SUMMARY

**Tests:**
```
test/cli/bench-markdown.test.ts
├── [ ] should output valid markdown
├── [ ] should include comparison table
├── [ ] should include summary
└── [ ] should work with GITHUB_STEP_SUMMARY
```

---

## 4.4 CI/CD Integration

### 4.4.1 GitHub Actions Example
- [ ] Create `.github/workflows/bench.yml` example
- [ ] Cache baseline between runs
- [ ] Comment on PR with results
- [ ] Block merge on regression

**Files:**
```
examples/github-actions/
├── bench.yml
├── bench-pr-comment.yml
└── README.md
```

**Tests:**
```
test/ci/github-actions.test.ts
├── [ ] should be valid workflow YAML
├── [ ] should run benchmark
├── [ ] should compare to baseline
└── [ ] should fail on regression
```

---

# Epic 5: REPL Interactive Mode

**Goal:** Provide line-by-line instruction execution for learning and debugging.

**Command:** `openedge repl`

## 5.1 REPL Core

### 5.1.1 Input Loop
- [ ] Create `src/cli/commands/repl.ts`
- [ ] Use readline for input
- [ ] Support command history (arrow keys)
- [ ] Support multi-line input
- [ ] Handle Ctrl+C gracefully

**Tests:**
```
test/cli/repl-input.test.ts
├── [ ] should accept input
├── [ ] should maintain history
├── [ ] should handle multi-line
├── [ ] should handle Ctrl+C
└── [ ] should handle Ctrl+D (exit)
```

### 5.1.2 Command Parser
- [ ] Parse .data declarations
- [ ] Parse instructions
- [ ] Parse dot commands (.help, .state)
- [ ] Report syntax errors inline

**Tests:**
```
test/cli/repl-parser.test.ts
├── [ ] should parse .data declaration
├── [ ] should parse instruction
├── [ ] should parse .help command
├── [ ] should report syntax errors
└── [ ] should handle empty input
```

---

## 5.2 Execution Engine

### 5.2.1 State Management
- [ ] Create `src/cli/repl/state.ts`
- [ ] Track register values per PE
- [ ] Track memory state
- [ ] Track cycle count
- [ ] Support state reset

**Tests:**
```
test/cli/repl-state.test.ts
├── [ ] should initialize empty state
├── [ ] should track register values
├── [ ] should track memory values
├── [ ] should increment cycles
└── [ ] should reset state on .reset
```

### 5.2.2 Instruction Execution
- [ ] Execute LWI (load from memory)
- [ ] Execute SWI (store to memory)
- [ ] Execute ALU operations
- [ ] Execute routing operations
- [ ] Show execution result

**Tests:**
```
test/cli/repl-execute.test.ts
├── [ ] should execute LWI correctly
├── [ ] should execute SWI correctly
├── [ ] should execute SADD correctly
├── [ ] should execute routing (RCR)
├── [ ] should show result after execution
└── [ ] should handle execution errors
```

---

## 5.3 REPL Commands

### 5.3.1 Built-in Commands
- [ ] `.help` - Show available commands
- [ ] `.state` - Show current state
- [ ] `.reset` - Reset all state
- [ ] `.exit` / `.quit` - Exit REPL
- [ ] `.load <file>` - Load and execute file
- [ ] `.save <file>` - Save session to file

**Tests:**
```
test/cli/repl-commands.test.ts
├── [ ] should show help on .help
├── [ ] should show state on .state
├── [ ] should reset on .reset
├── [ ] should exit on .exit
├── [ ] should load file on .load
└── [ ] should save session on .save
```

### 5.3.2 State Visualization
- [ ] Show register table
- [ ] Show memory contents
- [ ] Show PE grid status
- [ ] Highlight recent changes

**Tests:**
```
test/cli/repl-visualization.test.ts
├── [ ] should show register table
├── [ ] should show memory contents  
├── [ ] should show PE grid
├── [ ] should highlight changed values
└── [ ] should format numbers correctly
```

---

## 5.4 Tab Completion

### 5.4.1 Completion Provider
- [ ] Complete opcodes
- [ ] Complete registers
- [ ] Complete data labels
- [ ] Complete dot commands

**Tests:**
```
test/cli/repl-completion.test.ts
├── [ ] should complete opcodes
├── [ ] should complete registers
├── [ ] should complete data labels
├── [ ] should complete .commands
└── [ ] should show multiple options
```

---

# Epic 6: Code Generation & Scaffolding

**Goal:** Accelerate development with project templates and code generators.

**Command:** `openedge new <type> [name] [options]`

## 6.1 Project Scaffolding

### 6.1.1 Project Generator
- [ ] Create `src/cli/commands/new.ts`
- [ ] Generate project directory structure
- [ ] Create .openedge.json config
- [ ] Create README.md
- [ ] Create example files
- [ ] Initialize git repository (optional)

**Tests:**
```
test/cli/new-project.test.ts
├── [ ] should create directory structure
├── [ ] should create config file
├── [ ] should create README
├── [ ] should create example files
├── [ ] should init git with --git
└── [ ] should not overwrite existing
```

### 6.1.2 Project Structure
```
<project>/
├── src/
│   └── main.dsl
├── tests/
│   └── test_main.dsl
├── examples/
├── .openedge.json
├── .baseline.json
├── .gitignore
└── README.md
```

---

## 6.2 Kernel Templates

### 6.2.1 Template System
- [ ] Create `src/cli/templates/` directory
- [ ] Define template format (handlebars or similar)
- [ ] Support variable substitution
- [ ] Support conditional blocks

**Tests:**
```
test/cli/templates.test.ts
├── [ ] should load templates
├── [ ] should substitute variables
├── [ ] should handle conditionals
└── [ ] should validate template syntax
```

### 6.2.2 Built-in Templates
- [ ] `basic` - Simple kernel structure
- [ ] `matmul` - Matrix multiplication
- [ ] `convolution` - 2D convolution
- [ ] `reduction` - Parallel reduction
- [ ] `stencil` - Stencil computation

**Tests:**
```
test/cli/templates-builtin.test.ts
├── [ ] should generate basic template
├── [ ] should generate matmul template
├── [ ] should generate convolution template
├── [ ] should generate reduction template
├── [ ] should generate stencil template
└── [ ] all templates should compile
```

### 6.2.3 Template Listing
- [ ] `openedge new --list` - Show available templates
- [ ] Show template description
- [ ] Show template parameters

**Tests:**
```
test/cli/new-list.test.ts
├── [ ] should list all templates
├── [ ] should show descriptions
└── [ ] should show parameters
```

---

# Epic 7: Export Formats

**Goal:** Export DSL programs to various formats for visualization and integration.

**Command:** `openedge export <file> --format <fmt>`

## 7.1 Graphviz DOT Export

### 7.1.1 Dataflow Graph
- [ ] Create `src/cli/export/dot.ts`
- [ ] Generate nodes for each PE operation
- [ ] Generate edges for data dependencies
- [ ] Style nodes by operation type
- [ ] Include cycle information

**Tests:**
```
test/cli/export-dot.test.ts
├── [ ] should generate valid DOT
├── [ ] should include all operations as nodes
├── [ ] should include dependencies as edges
├── [ ] should style by operation type
├── [ ] should be renderable by dot command
└── [ ] should include cycle labels
```

---

## 7.2 Mermaid Export

### 7.2.1 Flowchart Generation
- [ ] Create `src/cli/export/mermaid.ts`
- [ ] Generate Mermaid flowchart syntax
- [ ] Support GitHub markdown rendering
- [ ] Include styling

**Tests:**
```
test/cli/export-mermaid.test.ts
├── [ ] should generate valid Mermaid syntax
├── [ ] should render in GitHub markdown
├── [ ] should include all operations
└── [ ] should show data flow
```

---

## 7.3 JSON AST Export

### 7.3.1 Structured AST
- [ ] Create `src/cli/export/json.ts`
- [ ] Export complete AST
- [ ] Include source locations
- [ ] Include semantic information

**Tests:**
```
test/cli/export-json.test.ts
├── [ ] should export valid JSON
├── [ ] should include all AST nodes
├── [ ] should include source locations
├── [ ] should be parseable
└── [ ] should round-trip (parse → export → parse)
```

---

## 7.4 Markdown Documentation

### 7.4.1 Documentation Generator
- [ ] Create `src/cli/export/markdown.ts`
- [ ] Generate kernel documentation
- [ ] Include data declarations
- [ ] Include cycle breakdown
- [ ] Include metrics summary

**Tests:**
```
test/cli/export-markdown.test.ts
├── [ ] should generate valid markdown
├── [ ] should document kernels
├── [ ] should document data
├── [ ] should include cycle info
└── [ ] should include metrics
```

---

# Epic 8: Diff Tool

**Goal:** Compare DSL files semantically and show performance impact.

**Command:** `openedge diff <file1> <file2>`

## 8.1 Semantic Diff

### 8.1.1 AST Comparison
- [ ] Create `src/cli/commands/diff.ts`
- [ ] Parse both files
- [ ] Compare AST structures
- [ ] Identify added/removed/modified elements

**Tests:**
```
test/cli/diff-semantic.test.ts
├── [ ] should detect added instructions
├── [ ] should detect removed instructions
├── [ ] should detect modified instructions
├── [ ] should detect moved instructions
├── [ ] should detect kernel changes
└── [ ] should handle identical files
```

### 8.1.2 Performance Comparison
- [ ] Compile both files
- [ ] Compare metrics
- [ ] Show performance delta
- [ ] Highlight significant changes

**Tests:**
```
test/cli/diff-performance.test.ts
├── [ ] should show cycle delta
├── [ ] should show PE utilization delta
├── [ ] should highlight improvements
├── [ ] should highlight regressions
└── [ ] should show percentage change
```

---

# Epic 9: Configuration System

**Goal:** Provide project-level configuration for consistent behavior.

**File:** `.openedge.json`

## 9.1 Configuration Loading

### 9.1.1 Config Discovery
- [ ] Create `src/cli/config/loader.ts`
- [ ] Search for .openedge.json in cwd and parents
- [ ] Support config in package.json `openedge` key
- [ ] Merge with defaults
- [ ] Validate schema

**Tests:**
```
test/cli/config-loader.test.ts
├── [ ] should find config in cwd
├── [ ] should search parent directories
├── [ ] should read from package.json
├── [ ] should merge with defaults
├── [ ] should validate schema
└── [ ] should report invalid config
```

### 9.1.2 Configuration Schema
```json
{
  "compiler": {
    "target": "4x4",
    "optimization": "balanced"
  },
  "watch": {
    "debounce": 300,
    "notify": true,
    "clear": false
  },
  "lsp": {
    "diagnostics": true,
    "completion": true,
    "hover": true
  },
  "bench": {
    "baseline": ".baseline.json",
    "threshold": "10%"
  },
  "output": {
    "directory": "dist",
    "format": "csv"
  }
}
```

---

# Test Infrastructure

## Test Setup

### Framework
- Use **Vitest** for unit tests
- Use **Vitest** for integration tests
- Mock file system with **memfs**
- Mock child processes

### Structure
```
test/
├── cli/
│   ├── watch-*.test.ts
│   ├── batch-*.test.ts
│   ├── bench-*.test.ts
│   ├── repl-*.test.ts
│   └── ...
├── lsp/
│   ├── server.test.ts
│   ├── diagnostics-*.test.ts
│   ├── completion-*.test.ts
│   └── ...
├── export/
│   ├── dot.test.ts
│   ├── mermaid.test.ts
│   └── ...
├── fixtures/
│   ├── simple.dsl
│   ├── error.dsl
│   └── ...
└── utils/
    ├── mock-fs.ts
    └── test-helpers.ts
```

### Commands
```bash
# Run all tests
npm test

# Run specific epic tests
npm test -- --grep "LSP"
npm test -- --grep "Watch"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

# Milestones & Timeline

## v0.2.0 - Developer Essentials (6-8 weeks)
- [x] Premium TUI with Vercel style
- [ ] Epic 1: LSP Server (1.1 - 1.5)
- [ ] Epic 2: Enhanced Watch Mode
- [ ] Epic 3: Batch Compilation

## v0.3.0 - CI/CD Ready (3-4 weeks)
- [ ] Epic 4: Benchmarking
- [ ] GitHub Actions examples
- [ ] JSON/Markdown reports

## v0.4.0 - Power User (4-5 weeks)
- [ ] Epic 5: REPL
- [ ] Epic 6: Scaffolding
- [ ] Epic 7: Export formats

## v0.5.0 - Ecosystem (3-4 weeks)
- [ ] Epic 1.7: VS Code extension published
- [ ] Epic 8: Diff tool
- [ ] Epic 9: Configuration system

## v1.0.0 - Production Ready
- [ ] All tests passing (>90% coverage)
- [ ] Documentation complete
- [ ] Published to npm
- [ ] VS Code extension in marketplace

---

# Definition of Done

A feature is complete when:

1. **Code Complete**
   - [ ] Implementation merged to main
   - [ ] No TypeScript errors
   - [ ] Follows code style guidelines

2. **Tests Passing**
   - [ ] Unit tests written and passing
   - [ ] Integration tests written and passing
   - [ ] Coverage > 80% for feature

3. **Documentation**
   - [ ] CLI help text updated
   - [ ] README updated if needed
   - [ ] JSDoc comments on public APIs

4. **Review**
   - [ ] Code reviewed
   - [ ] Tested manually
   - [ ] No regressions in existing features

---

*Document Version: 2.0*  
*Last Updated: January 2025*
