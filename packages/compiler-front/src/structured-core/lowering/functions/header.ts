export function parseFunctionHeader(cleanLine: string): { name: string; paramsText: string } | null {
  const match = cleanLine.match(/^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*\{\s*$/i);
  if (!match) return null;
  return {
    name: match[1],
    paramsText: match[2].trim()
  };
}

export function parseMacroHeader(cleanLine: string): { name: string; paramsText: string } | null {
  const match = cleanLine.match(/^macro\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*\{\s*$/i);
  if (!match) return null;
  return {
    name: match[1],
    paramsText: match[2].trim()
  };
}
