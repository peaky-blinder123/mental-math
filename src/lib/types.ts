export interface Problem {
  operandA: number;
  operandB: number;
  operator: "+" | "-" | "*";
  answer: number;
  strategyId: string;
  strategyLabel: string;
  hint: string;
  operands?: number[]; // For multi-term additions like C3
  problemText?: string; // Preformatted text representation for complex operator combinations
}

export interface TablesConfig {
  minTable: number;
  maxTable: number;
  minMult: number;
  maxMult: number;
  only12to20?: boolean;
  missingFactor?: boolean;
}

export interface ArithmeticConfig {
  minVal: number;
  maxVal: number;
  numTerms: number;
  subSigns: string;
}

export interface BridgeConfig {
  bridgeType: 'ten' | 'hundred';
  maxDiff: number;
}
