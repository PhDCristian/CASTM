export interface ForHeader {
  variable: string;
  start: number;
  end: number;
  step: number;
  unrollFactor?: number;
  collapseLevels?: number;
  collapseOrder?: 'row_major';
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
