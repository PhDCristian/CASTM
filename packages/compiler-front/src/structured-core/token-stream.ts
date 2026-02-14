import { FrontToken, tokenizeSource } from '../tokenizer.js';

export interface ParsedProgramHeaders {
  targetProfileId: string | null;
  kernelName: string | null;
  kernelHeaderLine: number | null;
}

class TokenCursor {
  private index = 0;

  constructor(private readonly tokens: FrontToken[]) {}

  peek(offset = 0): FrontToken | null {
    return this.tokens[this.index + offset] ?? null;
  }

  advance(): FrontToken | null {
    const token = this.peek();
    if (token) this.index += 1;
    return token;
  }

  isDone(): boolean {
    return this.index >= this.tokens.length;
  }
}

function parseStringLiteral(token: FrontToken | null): string | null {
  if (!token || token.type !== 'string') return null;
  return token.value.slice(1, -1);
}

function parseTargetIdentifier(token: FrontToken | null): string | null {
  if (!token) return null;
  if (token.type === 'identifier' || token.type === 'keyword') {
    return token.value;
  }
  return null;
}

export function parseProgramHeadersFromTokens(source: string): ParsedProgramHeaders {
  const cursor = new TokenCursor(tokenizeSource(source));
  let targetProfileId: string | null = null;
  let kernelName: string | null = null;
  let kernelHeaderLine: number | null = null;

  while (!cursor.isDone()) {
    const token = cursor.advance();
    if (!token || token.type !== 'keyword') continue;
    const keyword = token.value.toLowerCase();

    if (keyword === 'target') {
      const maybeString = parseStringLiteral(cursor.peek());
      const maybeIdent = maybeString === null ? parseTargetIdentifier(cursor.peek()) : null;
      const value = maybeString ?? maybeIdent;
      if (value !== null) {
        targetProfileId = value;
        cursor.advance();
      }
      continue;
    }

    if (keyword === 'kernel') {
      const maybeString = parseStringLiteral(cursor.peek());
      if (maybeString !== null) {
        kernelName = maybeString;
        kernelHeaderLine = token.line;
        cursor.advance();
      }
      continue;
    }
  }

  return {
    targetProfileId,
    kernelName,
    kernelHeaderLine
  };
}
