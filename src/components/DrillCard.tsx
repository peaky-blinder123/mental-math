import React, { useState, useEffect } from 'react';
import { generateProblem, STRATEGIES } from '../lib/strategies';
import type { Problem, TablesConfig, ArithmeticConfig, BridgeConfig } from '../lib/types';
import NumPad from './NumPad';
import { recordAttempt } from '../lib/tracking';
import ScrollableNumberPicker from './ScrollableNumberPicker';

export default function DrillCard() {
  const [selectedCategory, setSelectedCategory] = useState<string>('addition');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('add_split_recombine');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [typedValue, setTypedValue] = useState<string>('');
  const [isHalted, setIsHalted] = useState<boolean>(false);
  const [inputStatus, setInputStatus] = useState<'idle' | 'success' | 'error'>('idle');
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
      setTypedValue('');
      setIsHalted(false);
      setInputStatus('idle');
      setStartTime(Date.now());
    } catch (err) {
      console.error(err);
    }
  };

  // Load initial problem
  useEffect(() => {
    loadNewProblem(selectedStrategy);
  }, [selectedStrategy]);

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      
      if (isHalted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '-') {
        e.preventDefault();
        handleDigit('-');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        checkAnswer(typedValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [problem, typedValue, isHalted, selectedStrategy]);

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

  const handleDigit = (digit: string) => {
    if (isHalted || !problem) return;
    const newVal = typedValue + digit;
    setTypedValue(newVal);

    const targetAnswerStr = String(problem.answer);
    if (newVal.length >= targetAnswerStr.length) {
      checkAnswer(newVal);
    }
  };

  const handleBackspace = () => {
    if (isHalted) return;
    setTypedValue(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isHalted) return;
    setTypedValue('');
  };

  const checkAnswer = (valueToCheck: string) => {
    if (!problem) return;
    const answerStr = String(problem.answer);
    const delta = Date.now() - startTime;

    if (valueToCheck === answerStr) {
      setInputStatus('success');
      recordAttempt(problem.strategyId, delta, true);
      // Auto advance after 220ms success flash
      setTimeout(() => {
        loadNewProblem(selectedStrategy);
      }, 220);
    } else {
      setInputStatus('error');
      setIsHalted(true);
      recordAttempt(problem.strategyId, delta, false);
    }
  };

  const handleNext = () => {
    loadNewProblem(selectedStrategy);
  };

  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      handleBackspace();
    } else if (key === '-') {
      handleDigit('-');
    } else {
      handleDigit(key);
    }
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

      {/* Sub-Strategy dropdown & Settings button */}
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

      {/* Settings Panel */}
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
                <div className="flex flex-col gap-3">
                  {/* Table Range */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-semibold text-body-text">Table Range</label>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <input
                          type="number"
                          min="2"
                          max="99"
                          value={tablesConfig.minTable}
                          onChange={e => handleConfigChange('minTable', Number(e.target.value))}
                          className="w-10 px-1 py-0.5 bg-canvas-soft border border-border-hairline rounded text-center text-ink outline-none"
                        />
                        <span className="text-muted-text">to</span>
                        <input
                          type="number"
                          min="2"
                          max="99"
                          value={tablesConfig.maxTable}
                          onChange={e => handleConfigChange('maxTable', Number(e.target.value))}
                          className="w-10 px-1 py-0.5 bg-canvas-soft border border-border-hairline rounded text-center text-ink outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-text w-6 select-none">Min</span>
                        <ScrollableNumberPicker
                          min={2}
                          max={99}
                          value={tablesConfig.minTable}
                          onChange={val => handleConfigChange('minTable', val)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-text w-6 select-none">Max</span>
                        <ScrollableNumberPicker
                          min={2}
                          max={99}
                          value={tablesConfig.maxTable}
                          onChange={val => handleConfigChange('maxTable', val)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multiplier Range */}
                  <div className="flex flex-col gap-1.5 border-t border-border-hairline pt-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-semibold text-body-text">Multiplier Range</label>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={tablesConfig.minMult}
                          onChange={e => handleConfigChange('minMult', Number(e.target.value))}
                          className="w-10 px-1 py-0.5 bg-canvas-soft border border-border-hairline rounded text-center text-ink outline-none"
                        />
                        <span className="text-muted-text">to</span>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={tablesConfig.maxMult}
                          onChange={e => handleConfigChange('maxMult', Number(e.target.value))}
                          className="w-10 px-1 py-0.5 bg-canvas-soft border border-border-hairline rounded text-center text-ink outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-text w-6 select-none">Min</span>
                        <ScrollableNumberPicker
                          min={1}
                          max={99}
                          value={tablesConfig.minMult}
                          onChange={val => handleConfigChange('minMult', val)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-text w-6 select-none">Max</span>
                        <ScrollableNumberPicker
                          min={1}
                          max={99}
                          value={tablesConfig.maxMult}
                          onChange={val => handleConfigChange('maxMult', val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedStrategy === 'add_sub_3_terms' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {/* Number Range */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-semibold text-body-text">Number Range</label>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={arithmeticConfig.minVal}
                        onChange={e => handleArithmeticConfigChange('minVal', Number(e.target.value))}
                        className="w-12 px-1 py-0.5 bg-canvas-soft border border-border-hairline rounded text-center text-ink outline-none"
                      />
                      <span className="text-muted-text">to</span>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={arithmeticConfig.maxVal}
                        onChange={e => handleArithmeticConfigChange('maxVal', Number(e.target.value))}
                        className="w-12 px-1 py-0.5 bg-canvas-soft border border-border-hairline rounded text-center text-ink outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-text w-6 select-none">Min</span>
                      <ScrollableNumberPicker
                        min={1}
                        max={500}
                        value={arithmeticConfig.minVal}
                        onChange={val => handleArithmeticConfigChange('minVal', val)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-text w-6 select-none">Max</span>
                      <ScrollableNumberPicker
                        min={1}
                        max={999}
                        value={arithmeticConfig.maxVal}
                        onChange={val => handleArithmeticConfigChange('maxVal', val)}
                      />
                    </div>
                  </div>
                </div>

                {/* Terms Selection */}
                <div className="flex flex-col gap-1.5 border-t border-border-hairline pt-3">
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

      {/* Practicing Card */}
      <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-8 md:p-12 text-center transition-all-300 relative overflow-hidden flex flex-col items-center">
        
        {/* strategy label badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-hairline bg-canvas-soft-2 font-mono text-[10px] uppercase tracking-wider text-muted-text font-bold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-link-blue"></span>
          {problem.strategyLabel}
        </span>

        {/* Problem numbers */}
        <div 
          className={`
            font-sans font-bold tracking-tight text-ink py-8 select-none min-h-[140px] flex items-center justify-center transition-all duration-200 tabular-nums
            ${isC3 ? 'text-3.5rem leading-snug md:text-5xl' : 'text-5xl md:text-7xl'}
          `}
          id="current-problem-text"
        >
          {problemText}
        </div>

        {/* Input area display */}
        <div 
          className={`
            w-44 py-2 my-2 text-center font-mono text-3xl md:text-4xl font-bold border-b-2 transition-all duration-200 min-h-[50px] flex items-center justify-center tabular-nums
            ${inputStatus === 'success' 
              ? 'border-success-green text-success-green shadow-[0_4px_10px_-4px_rgba(16,185,129,0.3)] animate-pulse' 
              : inputStatus === 'error' 
                ? 'border-error-red text-error-red shadow-[0_4px_10px_-4px_rgba(238,0,0,0.3)]' 
                : 'border-border-hairline text-ink'
            }
          `}
          id="drill-input-box"
          aria-live="polite"
        >
          {typedValue || <span className="opacity-15 text-muted-text">?</span>}
        </div>

        {/* Dynamic Keypad or Halt review box */}
        <div className="w-full min-h-[300px] mt-4 flex items-center justify-center">
          {!isHalted ? (
            <div className="w-full">
              <NumPad onKeyPress={handleKeyPress} />
              <div className="mt-4 text-[10px] font-mono text-muted-text">Use physical keys or touch to enter answers</div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-5">
              <div className="text-xl font-bold text-error-red flex items-center gap-1.5" id="drill-result-status">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
                Incorrect (Target: {problem.answer})
              </div>

              {/* Explanatory mental pathway box */}
              <div className="w-full max-w-md text-left bg-canvas-soft border border-border-hairline border-l-2 border-l-error-red rounded p-4 shadow-sm" id="hint-breakdown-box">
                <h5 className="font-sans text-[10px] font-bold uppercase tracking-wider text-error-red mb-1">Mental Correcting Step</h5>
                <p className="font-mono text-sm text-body-text leading-relaxed font-medium">{problem.hint}</p>
              </div>

              <button
                className="cursor-pointer px-8 py-3 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline font-semibold rounded-md shadow-vercel-sm hover:shadow-vercel-md transition-all duration-200 flex items-center gap-2"
                onClick={handleNext}
                id="next-problem-btn"
                autoFocus
              >
                Continue Practicing
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
              <span className="text-[10px] font-mono text-muted-text">Press <kbd class="px-1 py-0.5 rounded bg-canvas-soft-2 border border-border-hairline text-body-text">Space</kbd> or <kbd class="px-1 py-0.5 rounded bg-canvas-soft-2 border border-border-hairline text-body-text">Enter</kbd> to proceed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
