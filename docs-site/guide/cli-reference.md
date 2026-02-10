---
title: CLI Reference
outline: deep
---

# CLI Reference

OpenEdge DSL provides a rich command-line interface with both interactive and batch modes.

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `compile <file>` | | Compile DSL source to CSV format |
| `check <file>` | | Validate syntax without generating output |
| `info <file>` | | Display program statistics and memory layout |
| `watch <file>` | `w` | Watch file and auto-recompile on changes |
| `tui` | `t` | Launch modern TUI with side-by-side preview |
| `interactive` | `i` | Launch classic interactive menu-driven mode |
| `theme [name]` | | Change or list available themes |

## compile

Compile a DSL source file to CSV format:

```bash
openedge compile <file> [options]

Options:
  -o, --output <file>  Output CSV file (default: <input>.csv)
  -q, --quiet          Suppress non-error output
  --no-color           Disable colored output
```

### Example

```bash
openedge compile kernel.edsl -o output.csv
```

### Output Format

The compiler generates CSV format compatible with CGRA simulators:

```csv
0
"LWI R0, 0", "LWI R1, 4", NOP, NOP
NOP, NOP, NOP, NOP
...
1
"SADD R2, R0, R1", NOP, NOP, NOP
...
```

## check

Validate syntax without generating output:

```bash
openedge check kernel.edsl
```

## info

Display program statistics and memory layout:

```bash
openedge info kernel.edsl --json
```

```
  ✓ Program: kernel.edsl

    Status:      Valid
    Cycles:      5
    Grid:        2×2
    Memory:      2 region(s)
        input: 0x0 (2 values)
        output: 0x8 (1 values)
```

## watch

Watch a file and auto-recompile on changes:

```bash
openedge watch kernel.edsl
# or
openedge w kernel.edsl
```

## tui

Launch the modern Terminal UI:

```bash
openedge tui  # or just 'openedge t'
```

| Feature | TUI (Modern) | Interactive (Classic) |
|---------|--------------|-----------------------|
| **Layout** | Double-column | Single-column |
| **Preview** | Real-time (on hover) | On select |
| **Navigation** | Arrow keys + ESC | Arrow keys |
| **Visuals** | React-based Ink | Inquirer-based |
| **File Browser** | Side-by-side | Menu-driven |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate menu / files |
| `Enter` | Select item |
| `ESC` | Go back (TUI only) |
| `Ctrl+C` | Exit gracefully |

## Themes

8 built-in color themes:

| Theme | Style |
|-------|-------|
| `default` | Cyan and green |
| `ocean` | Blue marine tones |
| `sunset` | Warm red and orange |
| `nord` | Nord color palette |
| `dracula` | Purple and green |
| `monokai` | Classic Monokai |
| `cyberpunk` | Bright neon colors |
| `minimal` | Monochrome minimal |

```bash
openedge theme          # List all themes
openedge theme dracula  # Apply theme
```

## Configuration

Configuration is stored in `~/.openedge/`:

```
~/.openedge/
├── config.json    # Theme and preferences
└── history.json   # Recent files
```

### Options

```json
{
  "theme": "default",
  "recentFilesLimit": 10,
  "watchDebounceMs": 300,
  "clearScreenOnAction": true,
  "showSpinners": true
}
```
