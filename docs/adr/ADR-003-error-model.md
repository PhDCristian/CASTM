# ADR-003: Error Model

## Status
Accepted

## Decision
All compiler components emit unified diagnostics:

`Diagnostic { code, severity, span, message, hint?, related? }`

Thrown exceptions are treated as internal failures; user-facing compile results must carry diagnostics.

## Consequences
- Consistent IDE/CLI diagnostics.
- Error catalog can be versioned and documented.
- Tests can assert codes/spans instead of fragile message text.
