import type { Problem } from './types';

// Helper: random integer in range [min, max] inclusive
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: shuffle array
function shuffleArray<T>(arr: T[]): T[] {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export interface StrategyInfo {
  id: string;
  label: string;
}

export const STRATEGIES: StrategyInfo[] = [
  { id: 'sub_bridge_10', label: 'Bridge Strategy' },
  { id: 'sub_adjustment', label: 'Adjustment Strategy' },
  { id: 'sub_const_shift', label: 'Constant Shift Strategy' },
  { id: 'sub_round_subtrahend', label: 'Round-the-Subtrahend' },
  { id: 'mult_near_base', label: 'Near-Base Adjustment' },
  { id: 'mult_double_halve', label: 'Double-and-Halve' },
  { id: 'mult_teen_decomposition', label: 'Foundation Decomposition' },
  { id: 'mult_tables_10_20', label: 'Times Tables (1-20)' },
  { id: 'add_split_recombine', label: 'Split-and-Recombine' },
  { id: 'add_round_addend', label: 'Round-the-Addend' },
  { id: 'add_pair_ten_hundred', label: 'Pair-to-Ten / Pair-to-Hundred' },
  { id: 'add_sub_3_terms', label: 'Custom Arithmetic (Add/Sub)' },
];

// Module-level variable to alternate carry / no-carry in C1 (Split-and-Recombine)
let c1CarryNext = false;

export interface GenerationOptions {
  minTable?: number;
  maxTable?: number;
  minMult?: number;
  maxMult?: number;
  minVal?: number;
  maxVal?: number;
  numTerms?: number;
  subSigns?: string;
  bridgeType?: 'ten' | 'hundred';
  maxDiff?: number;
  missingFactor?: boolean;
}

export function generateProblem(strategyId: string, options?: GenerationOptions): Problem {
  const maxAttempts = 1000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    switch (strategyId) {
      // Subtraction Strategies
      case 'sub_bridge_10': {
        const type = options?.bridgeType ?? 'ten';
        const maxD = options?.maxDiff ?? 15;

        const diff = getRandomInt(5, maxD);

        if (type === 'ten') {
          const bridgePoint = getRandomInt(2, 99) * 10;
          
          const maxDiff1 = Math.min(9, diff - 1);
          if (maxDiff1 < 1) continue;
          const diff1 = getRandomInt(1, maxDiff1);
          const diff2 = diff - diff1;

          const B = bridgePoint - diff1;
          const A = bridgePoint + diff2;

          return {
            operandA: A,
            operandB: B,
            operator: '-',
            answer: diff,
            strategyId,
            strategyLabel: 'Bridge Strategy',
            hint: `${B} + ${diff1} = ${bridgePoint}, ${bridgePoint} + ${diff2} = ${A}`,
          };
        } else {
          const bridgePoint = getRandomInt(1, 9) * 100;

          const maxDiff1 = Math.min(99, diff - 1);
          if (maxDiff1 < 1) continue;
          const diff1 = getRandomInt(1, maxDiff1);
          const diff2 = diff - diff1;

          const B = bridgePoint - diff1;
          const A = bridgePoint + diff2;

          return {
            operandA: A,
            operandB: B,
            operator: '-',
            answer: diff,
            strategyId,
            strategyLabel: 'Bridge Strategy',
            hint: `${B} + ${diff1} = ${bridgePoint}, ${bridgePoint} + ${diff2} = ${A}`,
          };
        }
      }

      case 'sub_adjustment': {
        const A = getRandomInt(20, 99);
        const B = getRandomInt(20, 99);
        if (A <= B) continue;
        const lastDigitB = B % 10;
        if (lastDigitB !== 8 && lastDigitB !== 9) continue;

        const roundedB = B + (10 - lastDigitB);
        const diff = roundedB - B;

        return {
          operandA: A,
          operandB: B,
          operator: '-',
          answer: A - B,
          strategyId,
          strategyLabel: 'Adjustment Strategy',
          hint: `${A} - ${roundedB} = ${A - roundedB}, + ${diff} = ${A - B}`,
        };
      }

      case 'sub_const_shift': {
        const A = getRandomInt(20, 99);
        const B = getRandomInt(20, 99);
        if (A <= B) continue;
        if ((B % 10) <= (A % 10)) continue; // would require borrowing

        const shift = 10 - (A % 10);
        const newA = A + shift;
        const newB = B + shift;

        return {
          operandA: A,
          operandB: B,
          operator: '-',
          answer: A - B,
          strategyId,
          strategyLabel: 'Constant Shift Strategy',
          hint: `shift both by +${shift} → ${newA} - ${newB} = ${newA - newB}`,
        };
      }

      case 'sub_round_subtrahend': {
        const A = getRandomInt(30, 99);
        const B = getRandomInt(20, 99);
        if (A <= B) continue;
        const lastDigitB = B % 10;
        if (![1, 2, 8, 9].includes(lastDigitB)) continue;

        let roundedB: number;
        let diff: number;
        let hint: string;

        if (lastDigitB === 8 || lastDigitB === 9) {
          roundedB = B + (10 - lastDigitB);
          diff = roundedB - B;
          hint = `${B} → ${roundedB} (diff = ${diff}) → ${A} - ${roundedB} = ${A - roundedB} → ${A - roundedB} + ${diff} = ${A - B}`;
        } else {
          roundedB = B - lastDigitB;
          diff = lastDigitB;
          hint = `${B} → ${roundedB} (diff = ${diff}) → ${A} - ${roundedB} = ${A - roundedB} → ${A - roundedB} - ${diff} = ${A - B}`;
        }

        return {
          operandA: A,
          operandB: B,
          operator: '-',
          answer: A - B,
          strategyId,
          strategyLabel: 'Round-the-Subtrahend',
          hint,
        };
      }

      // Multiplication Strategies
      case 'mult_near_base': {
        const A = getRandomInt(2, 99);
        const B = getRandomInt(7, 99);
        const lastDigitB = B % 10;
        if (![1, 2, 3, 7, 8, 9].includes(lastDigitB)) continue;

        let roundedB: number;
        let diff: number;
        let hint: string;

        if (lastDigitB >= 7) {
          roundedB = B + (10 - lastDigitB);
          diff = roundedB - B;
          hint = `${B} → ${roundedB} (diff = ${diff}) → ${A} × ${roundedB} = ${A * roundedB} → ${A * roundedB} - (${A} × ${diff}) = ${A * B}`;
        } else {
          roundedB = B - lastDigitB;
          diff = lastDigitB;
          hint = `${B} → ${roundedB} (diff = ${diff}) → ${A} × ${roundedB} = ${A * roundedB} → ${A * roundedB} + (${A} × ${diff}) = ${A * B}`;
        }

        return {
          operandA: A,
          operandB: B,
          operator: '*',
          answer: A * B,
          strategyId,
          strategyLabel: 'Near-Base Adjustment',
          hint,
        };
      }

      case 'mult_double_halve': {
        const A = getRandomInt(2, 50);
        const B = getRandomInt(5, 95);
        if (A % 2 !== 0) continue;
        if (B % 10 !== 5) continue;

        return {
          operandA: A,
          operandB: B,
          operator: '*',
          answer: A * B,
          strategyId,
          strategyLabel: 'Double-and-Halve',
          hint: `${A} × ${B} → ${A / 2} × ${B * 2} = ${A * B}`,
        };
      }

      case 'mult_teen_decomposition': {
        const A = getRandomInt(11, 19);
        const B = getRandomInt(2, 9);

        return {
          operandA: A,
          operandB: B,
          operator: '*',
          answer: A * B,
          strategyId,
          strategyLabel: 'Foundation Decomposition',
          hint: `(10 × ${B}) + (${A - 10} × ${B}) = ${10 * B} + ${(A - 10) * B} = ${A * B}`,
        };
      }

      case 'mult_tables_10_20': {
        const minT = options?.minTable ?? 2;
        const maxT = options?.maxTable ?? 20;
        const minM = options?.minMult ?? 1;
        const maxM = options?.maxMult ?? 12;

        const T = getRandomInt(minT, maxT);
        const N = getRandomInt(minM, maxM);
        const swap = Math.random() < 0.5;
        const operandA = swap ? N : T;
        const operandB = swap ? T : N;

        let hint = '';
        if (T === 10) {
          hint = swap
            ? `${N} × 10: Any number × 10 appends a 0 → ${N} × 10 = ${10 * N}`
            : `10 × ${N}: Any number × 10 appends a 0 → 10 × ${N} = ${10 * N}`;
        } else if (T === 20) {
          hint = swap
            ? `${N} × 20 → double ${N} (${N} × 2 = ${N * 2}), then multiply by 10 → ${N * 2}0`
            : `20 × ${N} → double ${N} (${N} × 2 = ${N * 2}), then multiply by 10 → ${N * 2}0`;
        } else {
          hint = swap
            ? `${N} × ${T} → decompose: (${N} × 10) + (${N} × ${T - 10}) = ${N * 10} + ${N * (T - 10)} = ${T * N}`
            : `${T} × ${N} → decompose: (10 × ${N}) + (${T - 10} × ${N}) = ${10 * N} + ${(T - 10) * N} = ${T * N}`;
        }

        const isMissingFactor = !!options?.missingFactor;
        const hideB = Math.random() < 0.5;
        const problemText = isMissingFactor
          ? (hideB ? `${operandA} × ? = ${T * N}` : `? × ${operandB} = ${T * N}`)
          : undefined;
        const answer = isMissingFactor ? (hideB ? operandB : operandA) : (T * N);

        return {
          operandA,
          operandB,
          operator: '*',
          answer,
          strategyId,
          strategyLabel: 'Times Tables (1-20)',
          hint,
          problemText,
        };
      }

      // Addition Strategies
      case 'add_split_recombine': {
        const A = getRandomInt(23, 98);
        const B = getRandomInt(23, 98);
        if (A % 10 === 0 || B % 10 === 0) continue;

        const sumUnits = (A % 10) + (B % 10);
        const isCarry = sumUnits >= 10;

        const forceCarry = c1CarryNext;
        if (forceCarry && !isCarry) continue;
        if (!forceCarry && isCarry) continue;

        // Toggle alternating carry
        c1CarryNext = !c1CarryNext;

        const tensA = A - (A % 10);
        const tensB = B - (B % 10);
        const unitsA = A % 10;
        const unitsB = B % 10;
        const tensSum = tensA + tensB;
        const unitsSum = unitsA + unitsB;

        return {
          operandA: A,
          operandB: B,
          operator: '+',
          answer: A + B,
          strategyId,
          strategyLabel: 'Split-and-Recombine',
          hint: `tens: ${tensA} + ${tensB} = ${tensSum} → units: ${unitsA} + ${unitsB} = ${unitsSum} → ${tensSum} + ${unitsSum} = ${A + B}`,
        };
      }

      case 'add_round_addend': {
        const A = getRandomInt(20, 98);
        const B = getRandomInt(20, 98);
        const lastDigitB = B % 10;
        if (![1, 2, 8, 9].includes(lastDigitB)) continue;

        let roundedB: number;
        let diff: number;
        let hint: string;

        if (lastDigitB === 8 || lastDigitB === 9) {
          roundedB = B + (10 - lastDigitB);
          diff = roundedB - B;
          hint = `${B} → ${roundedB} (diff = ${diff}) → ${A} + ${roundedB} = ${A + roundedB} → ${A + roundedB} - ${diff} = ${A + B}`;
        } else {
          roundedB = B - lastDigitB;
          diff = lastDigitB;
          hint = `${B} → ${roundedB} (diff = ${diff}) → ${A} + ${roundedB} = ${A + roundedB} → ${A + roundedB} + ${diff} = ${A + B}`;
        }

        return {
          operandA: A,
          operandB: B,
          operator: '+',
          answer: A + B,
          strategyId,
          strategyLabel: 'Round-the-Addend',
          hint,
        };
      }

      case 'add_pair_ten_hundred': {
        const isThreeTerm = Math.random() < 0.5;

        if (isThreeTerm) {
          const n1 = getRandomInt(11, 89);
          if (n1 % 10 === 0) continue;
          const n2 = 100 - n1;
          const n3 = getRandomInt(11, 89);
          if (n3 % 10 === 0 || n3 === n1 || n3 === n2) continue;

          const shuffled = shuffleArray([n1, n2, n3]);

          return {
            operandA: shuffled[0],
            operandB: shuffled[1],
            operator: '+',
            answer: 100 + n3,
            strategyId,
            strategyLabel: 'Pair-to-Ten / Pair-to-Hundred',
            hint: `Spot ${n1} + ${n2} = 100 → 100 + ${n3} = ${100 + n3}`,
            operands: shuffled,
          };
        } else {
          const n1 = getRandomInt(11, 89);
          if (n1 % 10 === 0) continue;
          const n2 = 100 - n1;
          const n3 = getRandomInt(11, 89);
          if (n3 % 10 === 0 || n3 === n1 || n3 === n2) continue;
          const n4 = 100 - n3;
          if (n4 === n1 || n4 === n2) continue;

          const shuffled = shuffleArray([n1, n2, n3, n4]);

          return {
            operandA: shuffled[0],
            operandB: shuffled[1],
            operator: '+',
            answer: 200,
            strategyId,
            strategyLabel: 'Pair-to-Ten / Pair-to-Hundred',
            hint: `Spot ${n1} + ${n2} = 100 and ${n3} + ${n4} = 100 → 100 + 100 = 200`,
            operands: shuffled,
          };
        }
      }

      case 'add_sub_3_terms': {
        const minV = options?.minVal ?? 1;
        const maxV = options?.maxVal ?? 100;
        const numTerms = options?.numTerms ?? 3;
        const subSignsOpt = options?.subSigns ?? 'random';

        // 1. Generate operands
        const operands: number[] = [];
        for (let i = 0; i < numTerms; i++) {
          operands.push(getRandomInt(minV, maxV));
        }

        // 2. Generate operators
        const totalOps = numTerms - 1;
        let subCount = 0;
        if (subSignsOpt === 'random') {
          subCount = getRandomInt(0, totalOps);
        } else {
          const parsed = parseInt(subSignsOpt, 10);
          subCount = isNaN(parsed) ? 0 : Math.min(parsed, totalOps);
        }

        const operators: ('+' | '-')[] = [];
        for (let i = 0; i < subCount; i++) {
          operators.push('-');
        }
        for (let i = 0; i < totalOps - subCount; i++) {
          operators.push('+');
        }

        const shuffledOps = shuffleArray(operators);

        // 3. Evaluate and check positivity
        let runningResult = operands[0];
        const steps: string[] = [];
        let ok = true;

        for (let i = 0; i < totalOps; i++) {
          const nextVal = operands[i + 1];
          const op = shuffledOps[i];
          const prevResult = runningResult;

          if (op === '+') {
            runningResult += nextVal;
          } else {
            if (runningResult < nextVal) {
              ok = false;
              break;
            }
            runningResult -= nextVal;
          }
          steps.push(`Step ${i + 1}: ${prevResult} ${op} ${nextVal} = ${runningResult}`);
        }

        if (!ok) continue;

        // 4. Construct problem representation
        let problemText = `${operands[0]}`;
        for (let i = 0; i < totalOps; i++) {
          problemText += ` ${shuffledOps[i]} ${operands[i + 1]}`;
        }

        const hint = steps.join(' → ');

        return {
          operandA: operands[0],
          operandB: operands[1] ?? 0,
          operator: '+',
          answer: runningResult,
          strategyId,
          strategyLabel: 'Custom Arithmetic (Add/Sub)',
          hint,
          problemText,
        };
      }
    }
  }

  throw new Error(`Failed to generate problem for strategy: ${strategyId} after ${maxAttempts} attempts.`);
}
