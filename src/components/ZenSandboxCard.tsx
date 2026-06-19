import React, { useState, useEffect } from 'react';
import { generateProblem, STRATEGIES } from '../lib/strategies';
import type { Problem, TablesConfig, ArithmeticConfig, BridgeConfig } from '../lib/types';
import { recordAttempt } from '../lib/tracking';

export default function ZenSandboxCard() {
  const [selectedCategory, setSelectedCategory] = useState<string>('addition');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('add_split_recombine');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Configuration States
  const [tablesConfig, setTablesConfig] = useState<TablesConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mm_tables_config');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return { minTable: 2, maxTable: 20, minMult: 1, maxMult: 12, only12to20: false, missingFactor: false };
  });

  const [arithmeticConfig, setArithmeticConfig] = useState<ArithmeticConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mm_arithmetic_config');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return { minVal: 1, maxVal: 100, numTerms: 3, subSigns: 'random' };
  });

  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mm_bridge_config');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return { bridgeType: 'ten', maxDiff: 15 };
  });

  const getMergedOptions = (
    newTables = tablesConfig,
    newArithmetic = arithmeticConfig,
    newBridge = bridgeConfig
  ) => {
    const isOnly12to20 = !!newTables.only12to20;
    return {
      minTable: isOnly12to20 ? 12 : newTables.minTable,
      maxTable: isOnly12to20 ? 20 : newTables.maxTable,
      minMult: isOnly12to20 ? 1 : newTables.minMult,
      maxMult: isOnly12to20 ? 10 : newTables.maxMult,
      missingFactor: !!newTables.missingFactor,
      minVal: newArithmetic.minVal,
      maxVal: newArithmetic.maxVal,
      numTerms: newArithmetic.numTerms,
      subSigns: newArithmetic.subSigns,
      bridgeType: newBridge.bridgeType,
      maxDiff: newBridge.maxDiff
    };
  };

  const loadNewProblem = (strategyId: string, currentConfig = getMergedOptions()) => {
    let targetId = strategyId;
    if (strategyId === 'all') {
      const filtered = STRATEGIES.filter(s => s.id !== 'mult_tables_10_20' && s.id !== 'add_sub_3_terms');
      const randomIndex = Math.floor(Math.random() * filtered.length);
      targetId = filtered[randomIndex].id;
    } else if (strategyId === 'addition_all') {
      const additionStrats = ['add_split_recombine', 'add_round_addend', 'add_pair_ten_hundred'];
      const randomIndex = Math.floor(Math.random() * additionStrats.length);
      targetId = additionStrats[randomIndex];
    } else if (strategyId === 'subtraction_all') {
      const subtractionStrats = ['sub_bridge_10', 'sub_adjustment', 'sub_const_shift', 'sub_round_subtrahend'];
      const randomIndex = Math.floor(Math.random() * subtractionStrats.length);
      targetId = subtractionStrats[randomIndex];
    } else if (strategyId === 'multiplication_all') {
      const multStrats = ['mult_near_base', 'mult_double_halve', 'mult_teen_decomposition'];
      const randomIndex = Math.floor(Math.random() * multStrats.length);
      targetId = multStrats[randomIndex];
    }

    try {
      const newProblem = generateProblem(targetId, currentConfig);
      setProblem(newProblem);
      setIsRevealed(false);
      setStartTime(Date.now());
    } catch (err) {
      console.error(err);
    }
  };

  // Load initial problem
  useEffect(() => {
    loadNewProblem(selectedStrategy);
  }, [selectedStrategy]);

  // Bind Keyboard shortcuts: Space or Enter to Reveal/Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isRevealed) {
          handleReveal();
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, problem]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    let defaultStrat = 'all';
    if (cat === 'tables') defaultStrat = 'mult_tables_10_20';
    else if (cat === 'addition') defaultStrat = 'add_split_recombine';
    else if (cat === 'subtraction') defaultStrat = 'sub_bridge_10';
    else if (cat === 'multiplication') defaultStrat = 'mult_near_base';
    else if (cat === 'custom') defaultStrat = 'add_sub_3_terms';

    setSelectedStrategy(defaultStrat);
  };

  const handleConfigChange = (key: keyof TablesConfig, val: number) => {
    if (key !== 'only12to20' && key !== 'missingFactor' && (isNaN(val) || val < 1)) return;
    setTablesConfig(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'minTable' && next.minTable > next.maxTable) next.maxTable = next.minTable;
      if (key === 'maxTable' && next.maxTable < next.minTable) next.minTable = next.maxTable;
      if (key === 'minMult' && next.minMult > next.maxMult) next.maxMult = next.minMult;
      if (key === 'maxMult' && next.maxMult < next.minMult) next.minMult = next.maxMult;
      localStorage.setItem('mm_tables_config', JSON.stringify(next));
      loadNewProblem(selectedStrategy, getMergedOptions(next, arithmeticConfig, bridgeConfig));
      return next;
    });
  };

  const handleArithmeticConfigChange = (key: keyof ArithmeticConfig, val: any) => {
    setArithmeticConfig(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'minVal' && next.minVal > next.maxVal) next.maxVal = next.minVal;
      if (key === 'maxVal' && next.maxVal < next.minVal) next.minVal = next.maxVal;
      if (key === 'numTerms') {
        const maxAllowedOps = next.numTerms - 1;
        if (next.subSigns !== 'random') {
          const parsed = parseInt(next.subSigns, 10);
          if (!isNaN(parsed) && parsed > maxAllowedOps) {
            next.subSigns = String(maxAllowedOps);
          }
        }
      }
      localStorage.setItem('mm_arithmetic_config', JSON.stringify(next));
      loadNewProblem(selectedStrategy, getMergedOptions(tablesConfig, next, bridgeConfig));
      return next;
    });
  };

  const handleBridgeConfigChange = (key: keyof BridgeConfig, val: any) => {
    setBridgeConfig(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem('mm_bridge_config', JSON.stringify(next));
      loadNewProblem(selectedStrategy, getMergedOptions(tablesConfig, arithmeticConfig, next));
      return next;
    });
  };

  const handleReveal = () => {
    if (problem && !isRevealed) {
      const delta = Date.now() - startTime;
      recordAttempt(problem.strategyId, delta, true);
      setIsRevealed(true);
    }
  };

  const handleNext = () => {
    loadNewProblem(selectedStrategy);
  };

  if (!problem) {
    return <div className="text-center font-mono py-12 text-muted-text">loading math engine…</div>;
  }

  const displayOperator = problem.operator === '*' ? '×' : problem.operator;
  const isC3 = problem.strategyId === 'add_pair_ten_hundred' && problem.operands;
  const problemText = problem.problemText
    ? problem.problemText
    : (isC3 && problem.operands
        ? problem.operands.join(` ${displayOperator} `)
        : `${problem.operandA} ${displayOperator} ${problem.operandB}`);

  return (
    <div className="w-full flex flex-col items-center gap-6">
      
      {/* Category Tabs (Vercel Style) */}
      <div className="flex flex-wrap items-center justify-center gap-1 bg-canvas-soft-2 p-1 rounded-full border border-border-hairline max-w-full">
        {[
          { id: 'addition', label: 'Addition' },
          { id: 'subtraction', label: 'Subtraction' },
          { id: 'multiplication', label: 'Multiplication' },
          { id: 'tables', label: 'Times Tables' },
          { id: 'custom', label: 'Custom' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`
              cursor-pointer px-4 py-1.5 rounded-full text-xs font-medium tracking-tight transition-all duration-200
              ${selectedCategory === cat.id 
                ? 'bg-canvas text-ink border border-border-hairline shadow-vercel-sm font-semibold' 
                : 'text-muted-text hover:text-ink'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sub-Strategy selector dropdown & Settings Toggle */}
      <div className="flex items-center gap-3 w-full max-w-md">
        <div className="relative flex-1">
          <select
            className="w-full pl-4 pr-10 py-2.5 bg-canvas border border-border-hairline rounded-md text-sm font-medium text-ink shadow-vercel-sm cursor-pointer outline-none focus:border-border-hairline-strong transition-all"
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
          >
            {selectedCategory === 'addition' && (
              <>
                <option value="addition_all">All Addition Rules</option>
                <option value="add_split_recombine">Split-and-Recombine (2-digit)</option>
                <option value="add_round_addend">Round-the-Addend (Near-ten)</option>
                <option value="add_pair_ten_hundred">Pair-to-Ten / Pair-to-Hundred</option>
              </>
            )}
            {selectedCategory === 'subtraction' && (
              <>
                <option value="subtraction_all">All Subtraction Rules</option>
                <option value="sub_bridge_10">Bridge Strategy (Crossing tens/hundreds)</option>
                <option value="sub_adjustment">Adjustment Strategy (Near-ten subtrahend)</option>
                <option value="sub_const_shift">Constant Shift (Avoid borrowing)</option>
                <option value="sub_round_subtrahend">Round-the-Subtrahend</option>
              </>
            )}
            {selectedCategory === 'multiplication' && (
              <>
                <option value="multiplication_all">All Multiplication Rules</option>
                <option value="mult_near_base">Near-Base Adjustment (Base 10/100)</option>
                <option value="mult_double_halve">Double-and-Halve (Even × ends in 5)</option>
                <option value="mult_teen_decomposition">Foundation Decomposition (11-19 × 1-9)</option>
              </>
            )}
            {selectedCategory === 'tables' && (
              <option value="mult_tables_10_20">Times Tables (1-20)</option>
            )}
            {selectedCategory === 'custom' && (
              <option value="add_sub_3_terms">Custom Arithmetic (Add/Sub)</option>
            )}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-text text-[10px]">▼</div>
        </div>

        {/* Configuration Toggle (Vercel Style) */}
        {['sub_bridge_10', 'mult_tables_10_20', 'add_sub_3_terms'].includes(selectedStrategy) && (
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`
              cursor-pointer px-3.5 py-2.5 rounded-md border text-sm font-medium transition-colors shadow-vercel-sm flex items-center gap-1.5
              ${showConfig 
                ? 'bg-canvas-soft-2 border-border-hairline-strong text-ink font-semibold' 
                : 'bg-canvas border-border-hairline hover:bg-canvas-soft-2 text-body-text'
              }
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            Settings
          </button>
        )}
      </div>

      {/* Collapsible Config panel */}
      {showConfig && ['sub_bridge_10', 'mult_tables_10_20', 'add_sub_3_terms'].includes(selectedStrategy) && (
        <div className="w-full max-w-md bg-canvas border border-border-hairline p-5 rounded-lg shadow-vercel-md flex flex-col gap-4 text-left transition-all duration-300">
          <h4 className="text-xs font-semibold tracking-wider text-muted-text uppercase">Configure Mode</h4>
          
          {selectedStrategy === 'sub_bridge_10' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-body-text">Bridge Boundary</label>
                <select
                  value={bridgeConfig.bridgeType}
                  onChange={e => handleBridgeConfigChange('bridgeType', e.target.value as 'ten' | 'hundred')}
                  className="w-full px-3 py-1.5 bg-canvas-soft border border-border-hairline rounded text-sm cursor-pointer outline-none"
                >
                  <option value="ten">Next Ten (10s)</option>
                  <option value="hundred">Next Hundred (100s)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-body-text">Max Gap (Difference)</label>
                <select
                  value={bridgeConfig.maxDiff}
                  onChange={e => handleBridgeConfigChange('maxDiff', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-canvas-soft border border-border-hairline rounded text-sm cursor-pointer outline-none"
                >
                  <option value="15">Up to 15</option>
                  <option value="30">Up to 30</option>
                  <option value="50">Up to 50</option>
                  <option value="100">Up to 100</option>
                </select>
              </div>
            </div>
          )}

          {selectedStrategy === 'mult_tables_10_20' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-body-text">Focus 12-20 tables (x10)</span>
                  <button
                    onClick={() => {
                      const nextVal = !tablesConfig.only12to20;
                      handleConfigChange('only12to20', nextVal ? 1 : 0);
                    }}
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${tablesConfig.only12to20 ? 'bg-link-blue' : 'bg-border-hairline-strong/30'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${tablesConfig.only12to20 ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-border-hairline pt-3">
                  <span className="text-xs font-medium text-body-text">Missing Factor Mode (e.g. 12 × ? = 72)</span>
                  <button
                    onClick={() => {
                      const nextVal = !tablesConfig.missingFactor;
                      handleConfigChange('missingFactor', nextVal ? 1 : 0);
                    }}
                    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${tablesConfig.missingFactor ? 'bg-link-blue' : 'bg-border-hairline-strong/30'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${tablesConfig.missingFactor ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {!tablesConfig.only12to20 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-text">Table Range</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="2"
                        max="99"
                        value={tablesConfig.minTable}
                        onChange={e => handleConfigChange('minTable', Number(e.target.value))}
                        className="w-full px-2 py-1 bg-canvas-soft border border-border-hairline rounded text-sm text-center"
                      />
                      <span className="text-xs text-muted-text">to</span>
                      <input
                        type="number"
                        min="2"
                        max="99"
                        value={tablesConfig.maxTable}
                        onChange={e => handleConfigChange('maxTable', Number(e.target.value))}
                        className="w-full px-2 py-1 bg-canvas-soft border border-border-hairline rounded text-sm text-center"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-text">Multiplier Range</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={tablesConfig.minMult}
                        onChange={e => handleConfigChange('minMult', Number(e.target.value))}
                        className="w-full px-2 py-1 bg-canvas-soft border border-border-hairline rounded text-sm text-center"
                      />
                      <span className="text-xs text-muted-text">to</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={tablesConfig.maxMult}
                        onChange={e => handleConfigChange('maxMult', Number(e.target.value))}
                        className="w-full px-2 py-1 bg-canvas-soft border border-border-hairline rounded text-sm text-center"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedStrategy === 'add_sub_3_terms' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-body-text">Number Range</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={arithmeticConfig.minVal}
                      onChange={e => handleArithmeticConfigChange('minVal', Number(e.target.value))}
                      className="w-full px-2 py-1 bg-canvas-soft border border-border-hairline rounded text-sm text-center"
                    />
                    <span className="text-xs text-muted-text">to</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={arithmeticConfig.maxVal}
                      onChange={e => handleArithmeticConfigChange('maxVal', Number(e.target.value))}
                      className="w-full px-2 py-1 bg-canvas-soft border border-border-hairline rounded text-sm text-center"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-body-text">Terms</label>
                  <select
                    value={arithmeticConfig.numTerms}
                    onChange={e => handleArithmeticConfigChange('numTerms', Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-canvas-soft border border-border-hairline rounded text-sm outline-none"
                  >
                    <option value="2">2 terms</option>
                    <option value="3">3 terms</option>
                    <option value="4">4 terms</option>
                    <option value="5">5 terms</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-body-text">Subtractions</label>
                <select
                  value={arithmeticConfig.subSigns}
                  onChange={e => handleArithmeticConfigChange('subSigns', e.target.value)}
                  className="w-full px-3 py-1.5 bg-canvas-soft border border-border-hairline rounded text-sm outline-none"
                >
                  <option value="random">Random (+ and -)</option>
                  <option value="0">0 (Addition only)</option>
                  {Array.from({ length: arithmeticConfig.numTerms - 1 }).map((_, i) => (
                    <option key={i+1} value={String(i+1)}>{i+1} subtraction(s)</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main card panel */}
      <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-8 md:p-12 text-center transition-all-300 relative overflow-hidden flex flex-col items-center">
        
        {/* Top small strategy badge (Vercel Style) */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-hairline bg-canvas-soft-2 font-mono text-[10px] uppercase tracking-wider text-muted-text font-bold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-link-blue"></span>
          {problem.strategyLabel}
        </span>

        {/* Problem displays */}
        <div 
          className={`
            font-sans font-bold tracking-tight text-ink py-10 select-none min-h-[160px] flex items-center justify-center transition-all duration-200 tabular-nums
            ${isC3 ? 'text-3.5rem leading-snug md:text-5xl' : 'text-5xl md:text-7xl'}
          `}
          id="current-problem-text"
        >
          {problemText}
        </div>

        {/* Interactive display actions */}
        <div className="w-full min-h-[160px] flex flex-col items-center justify-center">
          {!isRevealed ? (
            <div className="flex flex-col gap-3 items-center">
              <button
                className="cursor-pointer px-8 py-3 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline font-semibold rounded-md shadow-vercel-lg hover:shadow-vercel-xl transition-all-300 transform active:scale-[0.98]"
                onClick={handleReveal}
                id="reveal-answer-btn"
              >
                Reveal Answer
              </button>
              <span className="text-[11px] font-mono text-muted-text">Press <kbd class="px-1.5 py-0.5 rounded bg-canvas-soft-2 border border-border-hairline text-body-text shadow-sm">Space</kbd> or <kbd class="px-1.5 py-0.5 rounded bg-canvas-soft-2 border border-border-hairline text-body-text shadow-sm">Enter</kbd> to reveal</span>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-5">
              {/* Answer display */}
              <div className="text-4xl md:text-6xl font-extrabold text-ink animate-fade-in tabular-nums" id="correct-answer-text">
                {problem.answer}
              </div>

              {/* Monospace hint pathway (Vercel Style details box) */}
              <div className="w-full max-w-md text-left bg-canvas-soft border border-border-hairline border-l-2 border-l-link-blue rounded p-4 shadow-sm" id="hint-breakdown-box">
                <h5 className="font-sans text-[10px] font-bold uppercase tracking-wider text-link-blue mb-1">Mental Strategy</h5>
                <p className="font-mono text-sm text-body-text leading-relaxed font-medium">{problem.hint}</p>
              </div>

              {/* Next button */}
              <button
                className="cursor-pointer px-8 py-3 bg-canvas hover:bg-canvas-soft-2 border border-border-hairline font-semibold rounded-md shadow-vercel-sm hover:shadow-vercel-md transition-all-300 flex items-center gap-2"
                onClick={handleNext}
                id="next-problem-btn"
                autoFocus
              >
                Next Problem
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
