import React, { useState, useEffect } from 'react';
import type { Problem } from '../lib/types';
import { recordAttempt } from '../lib/tracking';

export default function TablesLearningCard() {
  // Modes: 'tables' or 'squares'
  const [mode, setMode] = useState<'tables' | 'squares'>('tables');

  // Times Tables Config
  const [tablesRange, setTablesRange] = useState<string>('12-20');
  const [tableSubTab, setTableSubTab] = useState<string>('1-10');
  const [maxMultiplier, setMaxMultiplier] = useState<number>(10);
  const [revealedCells, setRevealedCells] = useState<Record<string, boolean>>({});
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);

  // Squares Config
  const [squaresRange, setSquaresRange] = useState<string>('1-100'); // Default '1-100'
  const [squaresFilters, setSquaresFilters] = useState<string[]>([]);
  const [revealedSquares, setRevealedSquares] = useState<Record<number, boolean>>({});
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);

  // General Drill states
  const [drillActive, setDrillActive] = useState<boolean>(false);
  const [drillActiveMode, setDrillActiveMode] = useState<'tables' | 'squares'>('tables');
  const [drillRow, setDrillRow] = useState<number | null>(null); // For row-specific tables drill, or null for general drill
  const [drillSquareNum, setDrillSquareNum] = useState<number | null>(null); // For specific square drill, or null for general drill
  const [drillProblem, setDrillProblem] = useState<Problem | null>(null);
  const [drillInput, setDrillInput] = useState<string>('');
  const [drillStatus, setDrillStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [drillHalted, setDrillHalted] = useState<boolean>(false);
  const [drillStartTime, setDrillStartTime] = useState<number>(0);
  const [drillCount, setDrillCount] = useState<number>(0);
  const [drillCorrect, setDrillCorrect] = useState<number>(0);

  // Drills custom ranges (sliders)
  const [minDrillVal, setMinDrillVal] = useState<number>(1);
  const [maxDrillVal, setMaxDrillVal] = useState<number>(100);
  const [maxDrillMult, setMaxDrillMult] = useState<number>(10);
  
  // Toggles for Drill Options
  const [missingFactor, setMissingFactor] = useState<boolean>(false);
  const [drillType, setDrillType] = useState<'square' | 'base' | 'mixed'>('mixed');
  const [drillStyle, setDrillStyle] = useState<'word' | 'equation' | 'mixed'>('mixed');

  // Derive rows for tables
  const getTablesRows = () => {
    if (tablesRange === '1-10') return Array.from({ length: 10 }, (_, i) => i + 1);
    if (tablesRange === '12-20') return Array.from({ length: 9 }, (_, i) => 12 + i);
    if (tablesRange === '21-30') return Array.from({ length: 10 }, (_, i) => 21 + i);
    // If '1-30', check tableSubTab
    if (tableSubTab === '1-10') return Array.from({ length: 10 }, (_, i) => i + 1);
    if (tableSubTab === '11-20') return Array.from({ length: 10 }, (_, i) => 11 + i);
    if (tableSubTab === '21-30') return Array.from({ length: 10 }, (_, i) => 21 + i);
    return Array.from({ length: 9 }, (_, i) => 12 + i);
  };
  const tables = getTablesRows();
  const multipliers = Array.from({ length: maxMultiplier }, (_, i) => i + 1);

  // Derive bases for squares with filter criteria
  const getSquaresBases = () => {
    let allBases: number[] = [];
    if (squaresRange === '1-100') {
      allBases = Array.from({ length: 100 }, (_, i) => i + 1);
    } else {
      const parts = squaresRange.split('-');
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      allBases = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    if (squaresFilters.length === 0) return allBases;
    
    return allBases.filter(n => {
      return squaresFilters.some(filter => {
        if (filter === 'ends_in_1') return n % 10 === 1;
        if (filter === 'ends_in_5') return n % 10 === 5;
        if (filter === 'same_digits') return n >= 11 && n <= 99 && n % 11 === 0;
        if (filter === 'multiples_of_10') return n % 10 === 0;
        if (filter === 'r_1_10') return n >= 1 && n <= 10;
        if (filter === 'r_11_20') return n >= 11 && n <= 20;
        if (filter === 'r_21_30') return n >= 21 && n <= 30;
        if (filter === 'r_31_40') return n >= 31 && n <= 40;
        if (filter === 'r_41_50') return n >= 41 && n <= 50;
        if (filter === 'r_51_60') return n >= 51 && n <= 60;
        if (filter === 'r_61_70') return n >= 61 && n <= 70;
        if (filter === 'r_71_80') return n >= 71 && n <= 80;
        if (filter === 'r_81_90') return n >= 81 && n <= 90;
        if (filter === 'r_91_100') return n >= 91 && n <= 100;
        return false;
      });
    });
  };
  const squaresArray = getSquaresBases();

  const getCellKey = (r: number, c: number) => `${r}-${c}`;

  const toggleCell = (r: number, c: number) => {
    const key = getCellKey(r, c);
    setRevealedCells(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSelectedCell({ r, c });
  };

  const toggleSquare = (n: number) => {
    setRevealedSquares(prev => ({
      ...prev,
      [n]: !prev[n]
    }));
    setSelectedSquare(n);
  };

  const toggleSquaresFilter = (filterId: string) => {
    setSquaresFilters(prev =>
      prev.includes(filterId)
        ? prev.filter(f => f !== filterId)
        : [...prev, filterId]
    );
  };

  const revealAll = () => {
    if (mode === 'tables') {
      const next: Record<string, boolean> = {};
      tables.forEach(r => {
        multipliers.forEach(c => {
          next[getCellKey(r, c)] = true;
        });
      });
      setRevealedCells(prev => ({ ...prev, ...next }));
    } else {
      const next: Record<number, boolean> = {};
      squaresArray.forEach(n => {
        next[n] = true;
      });
      setRevealedSquares(prev => ({ ...prev, ...next }));
    }
  };

  const hideAll = () => {
    if (mode === 'tables') {
      setRevealedCells({});
      setSelectedCell(null);
    } else {
      setRevealedSquares({});
      setSelectedSquare(null);
    }
  };

  const getTableBreakdown = (r: number, c: number) => {
    const prod = r * c;
    if (r === 10 || r === 20 || r === 30) {
      return `${r} × ${c} → multiply ${r/10} × ${c} = ${(r/10) * c}, then append a zero → ${prod}`;
    }
    if (r < 10) {
      if (r === 9) return `9 × ${c} → (10 × ${c}) - ${c} = ${10 * c} - ${c} = ${prod}`;
      if (r === 5) return `5 × ${c} → (10 × ${c}) ÷ 2 = ${10 * c} ÷ 2 = ${prod}`;
      return `standard product: ${r} × ${c} = ${prod}`;
    }
    const tens = Math.floor(r / 10) * 10;
    const units = r % 10;
    return `decompose: (${tens} × ${c}) + (${units} × ${c}) = ${tens * c} + ${units * c} = ${prod}`;
  };

  const getSquareBreakdown = (n: number) => {
    const prod = n * n;
    if (n % 10 === 0) {
      return `multiples of 10 squared: square the base (${n/10}² = ${(n/10)**2}), then append two zeros → ${prod}`;
    }
    if (n % 10 === 5) {
      const tens = Math.floor(n / 10);
      return `ends in 5: multiply the tens digit by the next integer (${tens} × ${tens + 1} = ${tens * (tens + 1)}), then append 25 → ${prod}`;
    }
    const nearest10 = Math.round(n / 10) * 10;
    const d = Math.abs(n - nearest10);
    const low = n - d;
    const high = n + d;
    return `difference formula: N² = (N - d)(N + d) + d² where d is distance to nearest 10 (${nearest10}). For ${n}, d = ${d} → (${n} - ${d}) × (${n} + ${d}) + ${d}² = ${low} × ${high} + ${d**2} = ${low * high} + ${d * d} = ${prod}`;
  };

  // Get breakdown hint for selected item
  const getSelectedHint = () => {
    if (mode === 'tables') {
      if (!selectedCell) return null;
      return getTableBreakdown(selectedCell.r, selectedCell.c);
    } else {
      if (!selectedSquare) return null;
      return getSquareBreakdown(selectedSquare);
    }
  };

  // Start drill in active mode
  const startDrill = (options?: { row?: number; squareNum?: number }) => {
    setDrillActiveMode(mode);
    setDrillActive(true);
    setDrillCount(0);
    setDrillCorrect(0);
    setDrillHalted(false);
    
    if (mode === 'tables') {
      const row = options?.row ?? null;
      setDrillRow(row);
      
      let initMin = 1;
      let initMax = 30;
      if (tablesRange === '1-10') { initMin = 1; initMax = 10; }
      else if (tablesRange === '12-20') { initMin = 12; initMax = 20; }
      else if (tablesRange === '21-30') { initMin = 21; initMax = 30; }

      setMinDrillVal(row ?? initMin);
      setMaxDrillVal(row ?? initMax);
      setMaxDrillMult(maxMultiplier);
      
      generateTablesDrillProblem(row ?? initMin, row ?? initMax, maxMultiplier, row);
    } else {
      const sq = options?.squareNum ?? null;
      setDrillSquareNum(sq);

      let initMin = 1;
      let initMax = 100;
      if (squaresRange !== '1-100') {
        const parts = squaresRange.split('-');
        initMin = Number(parts[0]);
        initMax = Number(parts[1]);
      }

      setMinDrillVal(sq ?? initMin);
      setMaxDrillVal(sq ?? initMax);

      generateSquaresDrillProblem(sq ?? initMin, sq ?? initMax, sq);
    }
  };

  const generateTablesDrillProblem = (
    minVal: number = minDrillVal,
    maxVal: number = maxDrillVal,
    maxMult: number = maxDrillMult,
    specificRow: number | null = drillRow
  ) => {
    let selectedRow = specificRow;
    if (!selectedRow) {
      selectedRow = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
    }

    const mult = Math.floor(Math.random() * maxMult) + 1; // 1 to maxMult
    const swap = Math.random() < 0.5;
    const operandA = swap ? mult : selectedRow;
    const operandB = swap ? selectedRow : mult;

    const hint = getTableBreakdown(selectedRow, mult);

    const hideB = Math.random() < 0.5;
    const problemText = missingFactor
      ? (hideB ? `${operandA} × ? = ${selectedRow * mult}` : `? × ${operandB} = ${selectedRow * mult}`)
      : undefined;
    const answer = missingFactor ? (hideB ? operandB : operandA) : (selectedRow * mult);

    setDrillProblem({
      operandA,
      operandB,
      operator: '*',
      answer,
      strategyId: `mult_tables_${minVal}_${maxVal}`,
      strategyLabel: `Times Tables (${selectedRow}s)`,
      hint,
      problemText
    });
    setDrillInput('');
    setDrillStatus('idle');
    setDrillHalted(false);
    setDrillStartTime(Date.now());
  };

  const generateSquaresDrillProblem = (
    minVal: number = minDrillVal,
    maxVal: number = maxDrillVal,
    specificSq: number | null = drillSquareNum
  ) => {
    let selectedN = specificSq;
    if (!selectedN) {
      // Filter the pool of bases within [minVal, maxVal]
      let possibleBases: number[] = [];
      for (let i = minVal; i <= maxVal; i++) {
        if (squaresFilters.length === 0) {
          possibleBases.push(i);
        } else {
          const matches = squaresFilters.some(filter => {
            if (filter === 'ends_in_1') return i % 10 === 1;
            if (filter === 'ends_in_5') return i % 10 === 5;
            if (filter === 'same_digits') return i >= 11 && i <= 99 && i % 11 === 0;
            if (filter === 'multiples_of_10') return i % 10 === 0;
            if (filter === 'r_1_10') return i >= 1 && i <= 10;
            if (filter === 'r_11_20') return i >= 11 && i <= 20;
            if (filter === 'r_21_30') return i >= 21 && i <= 30;
            if (filter === 'r_31_40') return i >= 31 && i <= 40;
            if (filter === 'r_41_50') return i >= 41 && i <= 50;
            if (filter === 'r_51_60') return i >= 51 && i <= 60;
            if (filter === 'r_61_70') return i >= 61 && i <= 70;
            if (filter === 'r_71_80') return i >= 71 && i <= 80;
            if (filter === 'r_81_90') return i >= 81 && i <= 90;
            if (filter === 'r_91_100') return i >= 91 && i <= 100;
            return false;
          });
          if (matches) possibleBases.push(i);
        }
      }

      if (possibleBases.length === 0) {
        // Fallback to all bases in range
        possibleBases = Array.from({ length: maxVal - minVal + 1 }, (_, i) => minVal + i);
      }

      selectedN = possibleBases[Math.floor(Math.random() * possibleBases.length)];
    }

    const activeType = drillType === 'mixed'
      ? (Math.random() < 0.5 ? 'square' : 'base')
      : drillType;

    const activeStyle = drillStyle === 'mixed'
      ? (Math.random() < 0.5 ? 'word' : 'equation')
      : drillStyle;

    let problemText = '';
    let answer = 0;

    if (activeType === 'square') {
      answer = selectedN * selectedN;
      if (activeStyle === 'word') {
        problemText = `What is square of ${selectedN}?`;
      } else {
        problemText = `${selectedN}² = ?`;
      }
    } else {
      answer = selectedN;
      const squareVal = selectedN * selectedN;
      if (activeStyle === 'word') {
        problemText = `Which number is square of ${squareVal}?`;
      } else {
        problemText = `?² = ${squareVal}`;
      }
    }

    const hint = getSquareBreakdown(selectedN);

    setDrillProblem({
      operandA: selectedN,
      operandB: selectedN,
      operator: '*',
      answer,
      strategyId: `squares_${minVal}_${maxVal}`,
      strategyLabel: `Squares (${minVal}-${maxVal})`,
      hint,
      problemText
    });
    setDrillInput('');
    setDrillStatus('idle');
    setDrillHalted(false);
    setDrillStartTime(Date.now());
  };

  useEffect(() => {
    if (drillActive) {
      if (drillActiveMode === 'tables') {
        generateTablesDrillProblem(minDrillVal, maxDrillVal, maxDrillMult, drillRow);
      } else {
        generateSquaresDrillProblem(minDrillVal, maxDrillVal, drillSquareNum);
      }
    }
  }, [missingFactor, drillType, drillStyle, minDrillVal, maxDrillVal, maxDrillMult, squaresFilters]);

  const handleDrillInput = (val: string) => {
    if (drillHalted || !drillProblem) return;
    setDrillInput(val);

    const answerStr = String(drillProblem.answer);
    if (val.trim().length >= answerStr.length) {
      checkDrillAnswerImmediate(val.trim());
    }
  };

  const checkDrillAnswerImmediate = (typedVal: string) => {
    if (!drillProblem || drillHalted) return;

    const answerStr = String(drillProblem.answer);
    const delta = Date.now() - drillStartTime;
    setDrillCount(prev => prev + 1);

    const isCorrect = typedVal === answerStr;

    const stratId = drillProblem.strategyId;
    recordAttempt(stratId, delta, isCorrect);

    if (isCorrect) {
      setDrillStatus('success');
      setDrillCorrect(prev => prev + 1);
      
      // Auto-advance
      setTimeout(() => {
        if (drillActiveMode === 'tables') {
          generateTablesDrillProblem(minDrillVal, maxDrillVal, maxDrillMult, drillRow);
        } else {
          generateSquaresDrillProblem(minDrillVal, maxDrillVal, drillSquareNum);
        }
      }, 300);
    } else {
      setDrillStatus('error');
      setDrillHalted(true);
    }
  };

  const checkDrillAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    checkDrillAnswerImmediate(drillInput.trim());
  };

  const exitDrill = () => {
    setDrillActive(false);
    setDrillRow(null);
    setDrillSquareNum(null);
    setDrillProblem(null);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
      
      {!drillActive ? (
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          {/* Header Description */}
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Tables Explorer.</h2>
            <p className="text-xs text-muted-text mt-1">
              Explore multiplication structures and squares. Tap a cell or card to reveal products and mental breakdown steps.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-border-hairline w-full max-w-md justify-around mb-2">
            <button
              onClick={() => { setMode('tables'); setSelectedCell(null); }}
              className={`pb-2 px-6 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${mode === 'tables' ? 'border-link-blue text-ink' : 'border-transparent text-muted-text hover:text-ink'}`}
            >
              Times Tables
            </button>
            <button
              onClick={() => { setMode('squares'); setSelectedSquare(null); }}
              className={`pb-2 px-6 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${mode === 'squares' ? 'border-link-blue text-ink' : 'border-transparent text-muted-text hover:text-ink'}`}
            >
              Squares (1-100)
            </button>
          </div>

          {/* Config Controls */}
          <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-border-hairline bg-canvas rounded-xl shadow-vercel-sm">
            {mode === 'tables' ? (
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-muted-text">
                  <span>Rows:</span>
                  {['1-10', '12-20', '21-30', '1-30'].map(range => (
                    <button
                      key={range}
                      onClick={() => { setTablesRange(range); setSelectedCell(null); }}
                      className={`px-2.5 py-1 rounded border transition-all cursor-pointer ${tablesRange === range ? 'bg-ink text-canvas border-ink font-semibold' : 'bg-canvas-soft hover:bg-canvas-soft-2 border-border-hairline text-body-text'}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                {tablesRange === '1-30' && (
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-muted-text border-t sm:border-t-0 sm:border-l border-border-hairline pt-2 sm:pt-0 sm:pl-3">
                    <span>View:</span>
                    {['1-10', '11-20', '21-30'].map(sub => (
                      <button
                        key={sub}
                        onClick={() => { setTableSubTab(sub); setSelectedCell(null); }}
                        className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${tableSubTab === sub ? 'bg-link-blue text-white border-link-blue' : 'bg-canvas-soft hover:bg-canvas-soft-2 border-border-hairline text-body-text'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs font-mono font-bold text-muted-text border-t sm:border-t-0 sm:border-l border-border-hairline pt-2 sm:pt-0 sm:pl-3">
                  <span>Multipliers:</span>
                  {[10, 12].map(m => (
                    <button
                      key={m}
                      onClick={() => { setMaxMultiplier(m); setSelectedCell(null); }}
                      className={`px-2.5 py-1 rounded border transition-all cursor-pointer ${maxMultiplier === m ? 'bg-ink text-canvas border-ink font-semibold' : 'bg-canvas-soft hover:bg-canvas-soft-2 border-border-hairline text-body-text'}`}
                    >
                      1-{m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-muted-text">
                  <span>Range:</span>
                  {['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100', '1-100'].map(range => (
                    <button
                      key={range}
                      onClick={() => { setSquaresRange(range); setSelectedSquare(null); }}
                      className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${squaresRange === range ? 'bg-ink text-canvas border-ink font-semibold' : 'bg-canvas-soft hover:bg-canvas-soft-2 border-border-hairline text-body-text'}`}
                    >
                      {range === '1-100' ? 'All (1-100)' : range}
                    </button>
                  ))}
                </div>

                {/* Explorer Filters */}
                <div className="flex flex-wrap items-center gap-4 text-xs border-t border-border-hairline/60 pt-2 w-full">
                  <span className="font-mono text-[10px] uppercase font-bold text-muted-text">Filters (Union):</span>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none text-[11px] font-medium">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('ends_in_1')}
                        onChange={() => toggleSquaresFilter('ends_in_1')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Ends in 1</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none text-[11px] font-medium">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('ends_in_5')}
                        onChange={() => toggleSquaresFilter('ends_in_5')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Ends in 5</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none text-[11px] font-medium">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('same_digits')}
                        onChange={() => toggleSquaresFilter('same_digits')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Same digits (11, 22...)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none text-[11px] font-medium">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('multiples_of_10')}
                        onChange={() => toggleSquaresFilter('multiples_of_10')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Multiples of 10</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={revealAll}
                className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold bg-canvas hover:bg-canvas-soft-2 border border-border-hairline rounded-md shadow-vercel-sm transition-colors text-ink"
              >
                Reveal All
              </button>
              <button
                onClick={hideAll}
                className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold bg-canvas hover:bg-canvas-soft-2 border border-border-hairline rounded-md shadow-vercel-sm transition-colors text-ink"
              >
                Hide All
              </button>
              <button
                onClick={() => startDrill()}
                className="cursor-pointer px-3.5 py-1.5 text-xs font-bold bg-link-blue hover:bg-link-blue-deep text-white rounded-md shadow-vercel-sm transition-colors"
              >
                Launch Drill
              </button>
            </div>
          </div>

          {/* Grid Container */}
          {mode === 'tables' ? (
            <div className="w-full overflow-x-auto border border-border-hairline bg-canvas rounded-xl shadow-vercel-lg p-4 md:p-6 animate-fade-in">
              <table className="w-full border-collapse text-center tabular-nums">
                <thead>
                  <tr>
                    <th className="p-2 border border-border-hairline bg-canvas-soft-2 font-mono text-xs font-bold text-link-blue">×</th>
                    {multipliers.map(c => (
                      <th 
                        key={c} 
                        className={`
                          p-2 border border-border-hairline bg-canvas-soft-2 font-mono text-xs font-bold text-muted-text transition-colors
                          ${selectedCell?.c === c ? 'text-ink font-extrabold bg-border-hairline-strong/10' : ''}
                        `}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tables.map(r => (
                    <tr key={r} className="hover:bg-canvas-soft-2/40">
                      <td 
                        onClick={() => startDrill({ row: r })}
                        title={`Practice ${r}s Row`}
                        className={`
                          p-2 border border-border-hairline font-mono text-xs font-bold text-ink bg-canvas-soft transition-colors cursor-pointer hover:bg-link-blue/10 hover:text-link-blue
                          ${selectedCell?.r === r ? 'text-link-blue font-extrabold bg-border-hairline-strong/10' : ''}
                        `}
                      >
                        {r} 🎯
                      </td>
                      {multipliers.map(c => {
                        const revealed = revealedCells[getCellKey(r, c)];
                        const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                        return (
                          <td
                            key={c}
                            onClick={() => toggleCell(r, c)}
                            className={`
                              p-2.5 border border-border-hairline font-mono text-xs cursor-pointer select-none transition-all duration-150
                              ${revealed 
                                ? 'bg-canvas text-ink font-semibold' 
                                : 'bg-canvas-soft-2 text-muted-text/30 hover:bg-canvas hover:text-muted-text/70'
                              }
                              ${isSelected ? 'ring-2 ring-link-blue/50 bg-link-blue/5 text-ink font-extrabold' : ''}
                            `}
                          >
                            {revealed ? r * c : '?'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="w-full border border-border-hairline bg-canvas rounded-xl shadow-vercel-lg p-4 md:p-6 animate-fade-in">
              {squaresArray.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {squaresArray.map(n => {
                    const revealed = revealedSquares[n];
                    const isSelected = selectedSquare === n;
                    return (
                      <div
                        key={n}
                        onClick={() => toggleSquare(n)}
                        className={`
                          p-4 border rounded-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-150 relative overflow-hidden group
                          ${revealed 
                            ? 'bg-canvas border-border-hairline-strong text-ink font-semibold' 
                            : 'bg-canvas-soft-2 border-border-hairline text-muted-text/40 hover:bg-canvas hover:text-muted-text/70'
                          }
                          ${isSelected ? 'ring-2 ring-link-blue bg-link-blue/5 text-ink border-link-blue font-extrabold shadow-vercel-md' : 'shadow-vercel-sm'}
                        `}
                      >
                        <span className="font-mono text-[10px] text-muted-text font-bold mb-1 uppercase tracking-wider">{n}²</span>
                        <span className="font-mono text-xl font-bold">
                          {revealed ? n * n : '?'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startDrill({ squareNum: n });
                          }}
                          title={`Practice ${n}²`}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[10px] text-link-blue hover:text-link-blue-deep font-bold bg-canvas-soft-2 border border-border-hairline rounded cursor-pointer"
                        >
                          🎯
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center font-mono py-12 text-muted-text border border-dashed border-border-hairline rounded-xl">
                  ⚠️ No numbers in range "{squaresRange}" match the selected filters.
                </div>
              )}
            </div>
          )}

          {/* Breakdown / Action panel for selected cell */}
          {mode === 'tables' && selectedCell ? (
            <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl p-6 shadow-vercel-md flex flex-col md:flex-row md:items-center justify-between gap-5 text-left animate-fade-in">
              <div className="flex-1">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-muted-text block mb-1">Interactive Strategy</span>
                <h3 className="text-xl font-bold text-ink mb-1">
                  {selectedCell.r} × {selectedCell.c} = <span className="text-link-blue">{selectedCell.r * selectedCell.c}</span>
                </h3>
                <p className="font-mono text-xs text-body-text leading-relaxed mt-2 bg-canvas-soft p-2.5 border border-border-hairline rounded border-l-2 border-l-link-blue">
                  {getSelectedHint()}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0 justify-center">
                <button
                  onClick={() => startDrill({ row: selectedCell.r })}
                  className="cursor-pointer px-4.5 py-2.5 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline text-xs font-semibold rounded-md shadow-vercel-sm transition-colors text-center"
                >
                  Practice {selectedCell.r}s Row
                </button>
              </div>
            </div>
          ) : mode === 'squares' && selectedSquare ? (
            <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl p-6 shadow-vercel-md flex flex-col md:flex-row md:items-center justify-between gap-5 text-left animate-fade-in">
              <div className="flex-1">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-muted-text block mb-1">Squares Strategy</span>
                <h3 className="text-xl font-bold text-ink mb-1">
                  {selectedSquare}² = <span className="text-link-blue">{selectedSquare * selectedSquare}</span>
                </h3>
                <p className="font-mono text-xs text-body-text leading-relaxed mt-2 bg-canvas-soft p-2.5 border border-border-hairline rounded border-l-2 border-l-link-blue">
                  {getSelectedHint()}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0 justify-center">
                <button
                  onClick={() => startDrill({ squareNum: selectedSquare })}
                  className="cursor-pointer px-4.5 py-2.5 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline text-xs font-semibold rounded-md shadow-vercel-sm transition-colors text-center"
                >
                  Practice {selectedSquare}² Drill
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl p-6 text-center text-xs text-muted-text font-mono border-dashed shadow-sm">
              💡 {mode === 'tables' ? 'Select any cell in the grid to view its mental strategy calculation steps.' : 'Select any square card to view its mental strategy calculation steps.'}
            </div>
          )}
        </div>
      ) : (
        /* Practice Mode */
        <div className="w-full max-w-md bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-6 md:p-8 text-center animate-fade-in flex flex-col items-center">
          
          {/* Header controls */}
          <div className="flex items-center justify-between w-full font-mono text-[10px] text-muted-text font-bold uppercase tracking-wider mb-6 border-b border-border-hairline pb-2.5 tabular-nums">
            <span>
              Drill: {drillActiveMode === 'tables' 
                ? (drillRow ? `${drillRow}s Table` : `Tables (${minDrillVal}-${maxDrillVal})`) 
                : (drillSquareNum ? `${drillSquareNum}²` : `Squares (${minDrillVal}-${maxDrillVal})`)
              }
            </span>
            <span>Progress: {drillCorrect}/{drillCount}</span>
          </div>

          {/* Drill Options config (Inside active practice card) */}
          <div className="w-full pb-3 border-b border-border-hairline/60 mb-2 flex flex-col gap-4 text-left">
            
            {/* Custom Range Sliders */}
            <div className="flex flex-col gap-2 bg-canvas-soft border border-border-hairline p-3 rounded-lg">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-text mb-1 block">Customize Range:</span>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono text-body-text">
                  <span>Min Limit:</span>
                  <span className="font-bold text-ink">{minDrillVal}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={drillActiveMode === 'tables' ? 30 : 100}
                  value={minDrillVal}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setMinDrillVal(val);
                    if (val > maxDrillVal) setMaxDrillVal(val);
                  }}
                  className="w-full h-1 bg-canvas-soft-2 rounded-lg appearance-none cursor-pointer accent-link-blue"
                />
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-xs font-mono text-body-text">
                  <span>Max Limit:</span>
                  <span className="font-bold text-ink">{maxDrillVal}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={drillActiveMode === 'tables' ? 30 : 100}
                  value={maxDrillVal}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setMaxDrillVal(val);
                    if (val < minDrillVal) setMinDrillVal(val);
                  }}
                  className="w-full h-1 bg-canvas-soft-2 rounded-lg appearance-none cursor-pointer accent-link-blue"
                />
              </div>

              {drillActiveMode === 'tables' && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between text-xs font-mono text-body-text">
                    <span>Max Multiplier:</span>
                    <span className="font-bold text-ink">1-{maxDrillMult}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={maxDrillMult}
                    onChange={e => setMaxDrillMult(Number(e.target.value))}
                    className="w-full h-1 bg-canvas-soft-2 rounded-lg appearance-none cursor-pointer accent-link-blue"
                  />
                </div>
              )}
            </div>

            {drillActiveMode === 'tables' ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-medium text-body-text">Missing Factor Mode (e.g. 12 × ? = 72)</span>
                <button
                  type="button"
                  onClick={() => setMissingFactor(prev => !prev)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${missingFactor ? 'bg-link-blue' : 'bg-border-hairline-strong/30'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${missingFactor ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            ) : (
              <>
                {/* Mental Math Filters inside Squares drill */}
                <div className="flex flex-col gap-2 bg-canvas-soft border border-border-hairline p-3 rounded-lg text-xs">
                  <span className="font-mono text-[9px] uppercase font-bold text-muted-text block mb-1">Union Filters:</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('ends_in_1')}
                        onChange={() => toggleSquaresFilter('ends_in_1')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Ends in 1</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('ends_in_5')}
                        onChange={() => toggleSquaresFilter('ends_in_5')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Ends in 5</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('same_digits')}
                        onChange={() => toggleSquaresFilter('same_digits')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Same digits</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-body-text select-none">
                      <input
                        type="checkbox"
                        checked={squaresFilters.includes('multiples_of_10')}
                        onChange={() => toggleSquaresFilter('multiples_of_10')}
                        className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3.5 h-3.5"
                      />
                      <span>Multiples of 10</span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-border-hairline/60 pt-2">
                    <span className="font-mono text-[9px] text-muted-text block mb-1">Decade Range Blocks:</span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {[
                        { id: 'r_1_10', label: '1 - 10' },
                        { id: 'r_11_20', label: '11 - 20' },
                        { id: 'r_21_30', label: '21 - 30' },
                        { id: 'r_31_40', label: '31 - 40' },
                        { id: 'r_41_50', label: '41 - 50' },
                        { id: 'r_51_60', label: '51 - 60' },
                        { id: 'r_61_70', label: '61 - 70' },
                        { id: 'r_71_80', label: '71 - 80' },
                        { id: 'r_81_90', label: '81 - 90' },
                        { id: 'r_91_100', label: '91 - 100' },
                      ].map(decade => (
                        <label key={decade.id} className="flex items-center gap-1.5 cursor-pointer text-body-text select-none text-[10px]">
                          <input
                            type="checkbox"
                            checked={squaresFilters.includes(decade.id)}
                            onChange={() => toggleSquaresFilter(decade.id)}
                            className="rounded border-border-hairline text-link-blue focus:ring-link-blue w-3 h-3"
                          />
                          <span>{decade.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-medium text-body-text">Question Type:</span>
                  <div className="flex bg-canvas-soft border border-border-hairline rounded p-0.5">
                    {(['square', 'base', 'mixed'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDrillType(t)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${drillType === t ? 'bg-ink text-canvas font-semibold' : 'text-muted-text hover:text-ink'}`}
                      >
                        {t === 'square' ? 'X²' : t === 'base' ? '√Y' : 'Mixed'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-medium text-body-text">Format Style:</span>
                  <div className="flex bg-canvas-soft border border-border-hairline rounded p-0.5">
                    {(['word', 'equation', 'mixed'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDrillStyle(s)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${drillStyle === s ? 'bg-ink text-canvas font-semibold' : 'text-muted-text hover:text-ink'}`}
                      >
                        {s === 'word' ? 'Word' : s === 'equation' ? 'Equation' : 'Mixed'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {drillProblem && (
            <div className="w-full flex flex-col items-center">
              <h3 className="text-2xl md:text-3xl font-sans font-bold text-ink py-6 select-none tabular-nums text-center min-h-[80px] flex items-center justify-center" id="current-problem-text">
                {drillProblem.problemText ? drillProblem.problemText : `${drillProblem.operandA} × ${drillProblem.operandB}`}
              </h3>

              <form onSubmit={checkDrillAnswer} className="w-full flex flex-col items-center gap-4 mt-2">
                <input
                  type="number"
                  aria-label="Your answer"
                  value={drillInput}
                  disabled={drillHalted}
                  onChange={e => handleDrillInput(e.target.value)}
                  placeholder="?"
                  autoFocus
                  className={`
                    w-36 py-2.5 text-center font-mono text-3xl font-bold border-b-2 bg-transparent outline-none transition-all duration-200 tabular-nums
                    ${drillStatus === 'success' 
                      ? 'border-success-green text-success-green animate-pulse' 
                      : drillStatus === 'error' 
                        ? 'border-error-red text-error-red' 
                        : 'border-border-hairline text-ink focus:border-border-hairline-strong'
                    }
                  `}
                />

                {drillHalted && (
                  <div className="w-full flex flex-col items-center gap-4 mt-2">
                    <div className="text-sm font-bold text-error-red animate-bounce">
                      Incorrect (Correct: {drillProblem.answer})
                    </div>
                    
                    <div className="w-full text-left bg-canvas-soft border border-border-hairline border-l-2 border-l-error-red p-3 rounded text-xs font-mono text-body-text">
                      {drillProblem.hint}
                    </div>

                    <button
                      type="button"
                      onClick={() => drillActiveMode === 'tables' ? generateTablesDrillProblem(minDrillVal, maxDrillVal, maxDrillMult, drillRow) : generateSquaresDrillProblem(minDrillVal, maxDrillVal, drillSquareNum)}
                      className="cursor-pointer px-6 py-2 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline text-xs font-semibold rounded-md shadow-sm transition-colors mt-1"
                    >
                      Next Problem
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          <button
            onClick={exitDrill}
            className="cursor-pointer mt-8 text-xs font-mono text-muted-text hover:text-ink flex items-center gap-1"
          >
            ← Exit Drill and Return to Grid
          </button>
        </div>
      )}
    </div>
  );
}
