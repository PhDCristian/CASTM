import { countChar, stripLineComment } from './strings.js';

export interface SourceLineEntry {
  lineNo: number;
  rawLine: string;
  cleanLine: string;
}

export interface CollectedBlock {
  body: SourceLineEntry[];
  endIndex: number | null;
  trailingAfterClose?: string;
}

export function collectBlockFromSource(lines: string[], startIndex: number): CollectedBlock {
  const body: SourceLineEntry[] = [];
  const header = stripLineComment(lines[startIndex]).trim();
  let depth = countChar(header, '{') - countChar(header, '}');
  if (depth <= 0) depth = 1;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripLineComment(rawLine).trim();
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return { body, endIndex: i };
    }

    body.push({
      lineNo: i + 1,
      rawLine,
      cleanLine
    });
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

export function collectBlockFromEntries(entries: SourceLineEntry[], startIndex: number): CollectedBlock {
  const body: SourceLineEntry[] = [];
  const header = entries[startIndex].cleanLine;
  let depth = countChar(header, '{') - countChar(header, '}');
  if (depth <= 0) depth = 1;

  for (let i = startIndex + 1; i < entries.length; i++) {
    const cleanLine = entries[i].cleanLine;
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return { body, endIndex: i };
    }

    body.push(entries[i]);
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

export function collectBlockAfterOpenFromSource(lines: string[], startIndex: number): CollectedBlock {
  const body: SourceLineEntry[] = [];
  let depth = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripLineComment(rawLine).trim();
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    body.push({
      lineNo: i + 1,
      rawLine,
      cleanLine
    });
    depth = nextDepth;
  }

  return { body, endIndex: null };
}

export function collectBlockAfterOpenFromEntries(entries: SourceLineEntry[], startIndex: number): CollectedBlock {
  const body: SourceLineEntry[] = [];
  let depth = 1;

  for (let i = startIndex; i < entries.length; i++) {
    const cleanLine = entries[i].cleanLine;
    if (depth === 1 && cleanLine.startsWith('}')) {
      return {
        body,
        endIndex: i,
        trailingAfterClose: cleanLine.slice(1).trim()
      };
    }

    const opens = countChar(cleanLine, '{');
    const closes = countChar(cleanLine, '}');
    const nextDepth = depth + opens - closes;

    if (nextDepth === 0) {
      return {
        body,
        endIndex: i
      };
    }

    body.push(entries[i]);
    depth = nextDepth;
  }

  return { body, endIndex: null };
}
