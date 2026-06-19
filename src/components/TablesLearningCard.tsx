import React, { useState, useEffect } from 'react';
import { generateProblem } from '../lib/strategies';
import type { Problem } from '../lib/types';
import { recordAttempt } from '../lib/tracking';

export default function TablesLearningCard() {
  const tables = Array.from({ length: 9 }, (_, i) => 12 + i); // 12 to 20
  const multipliers = Array.from({ length: 10 }, (_, i) => i + 1); // 1 to 10

  const [revealedCells, setRevealedCells] = useState<Record<string, boolean>>({});
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  
  // Drill states
  const [drillActive, setDrillActive] = useState<boolean>(false);
  const [drillRow, setDrillRow] = useState<number | null>(null);
  const [drillProblem, setDrillProblem] = useState<Problem | null>(null);
  const [drillInput, setDrillInput] = useState<string>('');
  const [drillStatus, setDrillStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [drillHalted, setDrillHalted] = useState<boolean>(false);
  const [drillStartTime, setDrillStartTime] = useState<number>(0);
  const [drillCount, setDrillCount] = useState<number>(0);
  const [drillCorrect, setDrillCorrect] = useState<number>(0);
  const [missingFactor, setMissingFactor] = useState<boolean>(false);

  const getCellKey = (r: number, c: number) => `${r}-${c}`;

  const toggleCell = (r: number, c: number) => {
    const key = getCellKey(r, c);
    setRevealedCells(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSelectedCell({ r, c });
  };

  const revealAll = () => {
    const next: Record<string, boolean> = {};
    tables.forEach(r => {
      multipliers.forEach(c => {
        next[getCellKey(r, c)] = true;
      });
    });
    setRevealedCells(next);
  };

  const hideAll = () => {
    setRevealedCells({});
    setSelectedCell(null);
  };

  // Get breakdown hint for selected cell
  const getSelectedHint = () => {
    if (!selectedCell) return null;
    const { r, c } = selectedCell;
    const prod = r * c;
    if (r === 20) {
      return `double ${c} (${c} × 2 = ${c * 2}), then multiply by 10 → ${c * 2}0`;
    }
    return `decompose: (10 × ${c}) + (${r - 10} × ${c}) = ${10 * c} + ${(r - 10) * c} = ${prod}`;
  };

  // Start a targeted table row drill
  const startRowDrill = (row: number) => {
    setDrillRow(row);
    setDrillActive(true);
    setDrillCount(0);
    setDrillCorrect(0);
    setDrillHalted(false);
    generateDrillProblem(row);
  };

  const generateDrillProblem = (row: number) => {
    const mult = Math.floor(Math.random() * 10) + 1; // 1 to 10
    const swap = Math.random() < 0.5;
    const operandA = swap ? mult : row;
    const operandB = swap ? row : mult;

    let hint = '';
    if (row === 20) {
      hint = swap
        ? `${mult} × 20 → double ${mult} (${mult} × 2 = ${mult * 2}), then multiply by 10 → ${mult * 2}0`
        : `20 × ${mult} → double ${mult} (${mult} × 2 = ${mult * 2}), then multiply by 10 → ${mult * 2}0`;
    } else {
      hint = swap
        ? `${mult} × ${row} → decompose: (${mult} × 10) + (${mult} × ${row - 10}) = ${mult * 10} + ${mult * (row - 10)} = ${row * mult}`
        : `${row} × ${mult} → decompose: (10 × ${mult}) + (${row - 10} × ${mult}) = ${10 * mult} + ${(row - 10) * mult} = ${row * mult}`;
    }

    const hideB = Math.random() < 0.5;
    const problemText = missingFactor
      ? (hideB ? `${operandA} × ? = ${row * mult}` : `? × ${operandB} = ${row * mult}`)
      : undefined;
    const answer = missingFactor ? (hideB ? operandB : operandA) : (row * mult);

    setDrillProblem({
      operandA,
      operandB,
      operator: '*',
      answer,
      strategyId: 'mult_tables_10_20',
      strategyLabel: `Times Tables (${row}s)`,
      hint,
      problemText
    });
    setDrillInput('');
    setDrillStatus('idle');
    setDrillHalted(false);
    setDrillStartTime(Date.now());
  };

  useEffect(() => {
    if (drillActive && drillRow) {
      generateDrillProblem(drillRow);
    }
  }, [missingFactor]);

  const handleDrillInput = (val: string) => {
    if (drillHalted || !drillProblem) return;
    setDrillInput(val);
  };

  const checkDrillAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillProblem || drillHalted) return;

    const answerStr = String(drillProblem.answer);
    const delta = Date.now() - drillStartTime;
    setDrillCount(prev => prev + 1);

    if (drillInput.trim() === answerStr) {
      setDrillStatus('success');
      setDrillCorrect(prev => prev + 1);
      recordAttempt('mult_tables_10_20', delta, true);
      
      // Auto-advance
      setTimeout(() => {
        if (drillRow) generateDrillProblem(drillRow);
      }, 600);
    } else {
      setDrillStatus('error');
      setDrillHalted(true);
      recordAttempt('mult_tables_10_20', delta, false);
    }
  };

  const exitDrill = () => {
    setDrillActive(false);
    setDrillRow(null);
    setDrillProblem(null);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
      
      {!drillActive ? (
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          {/* Header Description */}
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Times Tables Explorer.</h2>
            <p className="text-xs text-muted-text mt-1">
              Explore multiplication products for tables 12-20. Click a cell to reveal its product and view its mental breakdown.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={revealAll}
              className="cursor-pointer px-4 py-2 text-xs font-semibold bg-canvas hover:bg-canvas-soft-2 border border-border-hairline rounded-md shadow-vercel-sm transition-colors text-ink"
            >
              Reveal All
            </button>
            <button
              onClick={hideAll}
              className="cursor-pointer px-4 py-2 text-xs font-semibold bg-canvas hover:bg-canvas-soft-2 border border-border-hairline rounded-md shadow-vercel-sm transition-colors text-ink"
            >
              Hide All
            </button>
          </div>

          {/* Grid Container */}
          <div className="w-full overflow-x-auto border border-border-hairline bg-canvas rounded-xl shadow-vercel-lg p-4 md:p-6">
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
                      className={`
                        p-2 border border-border-hairline font-mono text-xs font-bold text-ink bg-canvas-soft transition-colors
                        ${selectedCell?.r === r ? 'text-link-blue font-extrabold bg-border-hairline-strong/10' : ''}
                      `}
                    >
                      {r}
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

          {/* Breakdown / Action panel for selected cell */}
          {selectedCell ? (
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
                  onClick={() => startRowDrill(selectedCell.r)}
                  className="cursor-pointer px-4.5 py-2.5 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline text-xs font-semibold rounded-md shadow-vercel-sm transition-colors text-center"
                >
                  Practice {selectedCell.r}s Row
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl p-6 text-center text-xs text-muted-text font-mono border-dashed shadow-sm">
              💡 Select any cell in the grid to view its mental strategy calculation steps.
            </div>
          )}
        </div>
      ) : (
        /* Targeted Row Practice Mode */
        <div className="w-full max-w-md bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-6 md:p-8 text-center animate-fade-in flex flex-col items-center">
          
          {/* Header controls */}
          <div className="flex items-center justify-between w-full font-mono text-[10px] text-muted-text font-bold uppercase tracking-wider mb-6 border-b border-border-hairline pb-2.5 tabular-nums">
            <span>Drill: {drillRow}s Table</span>
            <span>Progress: {drillCorrect}/{drillCount}</span>
          </div>

          {/* Missing Factor mode toggle inside the practice card */}
          <div className="flex items-center justify-between w-full pb-3 border-b border-border-hairline/60 mb-2">
            <span className="text-xs font-medium text-body-text">Missing Factor Mode (e.g. 12 × ? = 72)</span>
            <button
              type="button"
              onClick={() => setMissingFactor(prev => !prev)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${missingFactor ? 'bg-link-blue' : 'bg-border-hairline-strong/30'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${missingFactor ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {drillProblem && (
            <div className="w-full flex flex-col items-center">
              <h3 className="text-4xl md:text-5xl font-sans font-bold text-ink py-6 select-none tabular-nums" id="current-problem-text">
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

                {!drillHalted ? (
                  <button
                    type="submit"
                    className="cursor-pointer px-6 py-2 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline text-xs font-semibold rounded-md shadow-sm transition-colors mt-2"
                  >
                    Submit
                  </button>
                ) : (
                  <div className="w-full flex flex-col items-center gap-4 mt-2">
                    <div className="text-sm font-bold text-error-red">
                      Incorrect (Target: {drillProblem.answer})
                    </div>
                    
                    <div className="w-full text-left bg-canvas-soft border border-border-hairline border-l-2 border-l-error-red p-3 rounded text-xs font-mono text-body-text">
                      {drillProblem.hint}
                    </div>

                    <button
                      type="button"
                      onClick={() => generateDrillProblem(drillRow!)}
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
