export interface ForHeader {
  variable: string;
  start: number;
  end: number;
  step: number;
  runtime?: boolean;
  control?: {
    row: number;
    col: number;
  };
}

export interface ParsedCondition {
  lhs: string;
  operator: '==' | '!=' | '<' | '>=' | '>' | '<=';
  rhs: string;
}

export interface ParsedControlHeader {
  condition: ParsedCondition;
  row: number;
  col: number;
}
