import React, { useState, useEffect, useRef } from 'react';
import { generateProblem, STRATEGIES } from '../lib/strategies';
import type { Problem, TablesConfig, ArithmeticConfig, BridgeConfig } from '../lib/types';
import { recordAttempt } from '../lib/tracking';
import NumPad from './NumPad';

type GameState = 'idle' | 'running' | 'gameover';

interface SessionAttempt {
  problemText: string;
  correctAnswer: number;
  userTyped: string;
  correct: boolean;
  hint: string;
}

export default function BlitzCard() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [selectedCategory, setSelectedCategory] = useState<string>('addition');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('add_split_recombine');
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

  // Game running states
  const [problem, setProblem] = useState<Problem | null>(null);
  const [typedValue, setTypedValue] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(30); // 30s pool
  const [score, setScore] = useState<number>(0);
  const [attemptsCount, setAttemptsCount] = useState<number>(0);
  const [inputStatus, setInputStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // History for gameover review
  const [attemptsList, setAttemptsList] = useState<SessionAttempt[]>([]);

  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  // Keyboard listener during gameplay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (gameState !== 'running') return;

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
  }, [gameState, problem, typedValue]);

  const stopTimer = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
  };

  const startGame = () => {
    setScore(0);
    setAttemptsCount(0);
    setTimeLeft(30);
    setAttemptsList([]);
    setTypedValue('');
    setInputStatus('idle');
    setGameState('running');
    
    loadNewProblem(selectedStrategy, true);
  };

  const loadNewProblem = (strategyId: string, isStart = false) => {
    const activeStrat = isStart ? selectedStrategy : strategyId;
    let targetId = activeStrat;
    
    if (activeStrat === 'all') {
      const filtered = STRATEGIES.filter(s => s.id !== 'mult_tables_10_20' && s.id !== 'add_sub_3_terms');
      const randomIndex = Math.floor(Math.random() * filtered.length);
      targetId = filtered[randomIndex].id;
    } else if (activeStrat === 'addition_all') {
      const additionStrats = ['add_split_recombine', 'add_round_addend', 'add_pair_ten_hundred'];
      const randomIndex = Math.floor(Math.random() * additionStrats.length);
      targetId = additionStrats[randomIndex];
    } else if (activeStrat === 'subtraction_all') {
      const subtractionStrats = ['sub_bridge_10', 'sub_adjustment', 'sub_const_shift', 'sub_round_subtrahend'];
      const randomIndex = Math.floor(Math.random() * subtractionStrats.length);
      targetId = subtractionStrats[randomIndex];
    } else if (activeStrat === 'multiplication_all') {
      const multStrats = ['mult_near_base', 'mult_double_halve', 'mult_teen_decomposition'];
      const randomIndex = Math.floor(Math.random() * multStrats.length);
      targetId = multStrats[randomIndex];
    }

    try {
      const newProblem = generateProblem(targetId, getMergedOptions());
      setProblem(newProblem);
      setTypedValue('');
      setInputStatus('idle');
      startTimeRef.current = Date.now();

      if (isStart) {
        stopTimer();
        gameTimerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              stopTimer();
              setGameState('gameover');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDigit = (digit: string) => {
    if (gameState !== 'running' || !problem) return;
    const newVal = typedValue + digit;
    setTypedValue(newVal);

    const targetAnswerStr = String(problem.answer);
    if (newVal.length >= targetAnswerStr.length) {
      checkAnswer(newVal);
    }
  };

  const handleBackspace = () => {
    if (gameState !== 'running') return;
    setTypedValue(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (gameState !== 'running') return;
    setTypedValue('');
  };

  const checkAnswer = (valToCheck: string) => {
    if (!problem) return;
    const answerStr = String(problem.answer);
    const delta = Date.now() - startTimeRef.current;
    
    const displayOp = problem.operator === '*' ? '×' : problem.operator;
    const isC3 = problem.strategyId === 'add_pair_ten_hundred' && problem.operands;
    const problemText = problem.problemText
      ? problem.problemText
      : (isC3 && problem.operands
          ? problem.operands.join(` ${displayOp} `)
          : `${problem.operandA} ${displayOp} ${problem.operandB}`);

    setAttemptsCount(prev => prev + 1);

    if (valToCheck === answerStr) {
      setInputStatus('success');
      setScore(prev => prev + 1);
      
      recordAttempt(problem.strategyId, delta, true);
      
      setAttemptsList(prev => [
        ...prev,
        {
          problemText,
          correctAnswer: problem.answer,
          userTyped: valToCheck,
          correct: true,
          hint: problem.hint
        }
      ]);

      // Add time back (+3s), max capped at 60s
      setTimeLeft(prev => Math.min(60, prev + 3));

      // Advance immediately
      loadNewProblem(selectedStrategy);
    } else {
      setInputStatus('error');
      
      recordAttempt(problem.strategyId, delta, false);

      setAttemptsList(prev => [
        ...prev,
        {
          problemText,
          correctAnswer: problem.answer,
          userTyped: valToCheck,
          correct: false,
          hint: problem.hint
        }
      ]);

      // Deduct time penalty (-5s)
      setTimeLeft(prev => Math.max(0, prev - 5));

      // Short flash and advance instantly (no halting for Blitz!)
      setTimeout(() => {
        loadNewProblem(selectedStrategy);
      }, 150);
    }
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
      return next;
    });
  };

  const handleBridgeConfigChange = (key: keyof BridgeConfig, val: any) => {
    setBridgeConfig(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem('mm_bridge_config', JSON.stringify(next));
      return next;
    });
  };

  const displayOperator = (opStr: string) => {
    return opStr === '*' ? '×' : opStr;
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      
      {gameState === 'idle' && (
        <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
          {/* Category Tabs */}
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

          {/* Sub strategy dropdown & Settings */}
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

          {/* Settings Drawer */}
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

          {/* Start Card */}
          <div className="w-full max-w-md bg-canvas border border-border-hairline p-6 rounded-xl shadow-vercel-lg flex flex-col gap-4 text-center">
            <h4 className="text-sm font-bold text-ink">Blitz Rules</h4>
            <ul className="text-xs text-body-text text-left list-disc list-inside flex flex-col gap-2.5">
              <li>You start with a <span className="font-semibold text-link-blue">30 second</span> time pool.</li>
              <li>Correct answers grant <span className="font-semibold text-success-green">+3 seconds</span>.</li>
              <li>Incorrect answers deduct <span className="font-semibold text-error-red">-5 seconds</span>.</li>
              <li>Type directly using the numpad or your keyboard to submit.</li>
              <li>Get as many points as you can before the clock hits zero!</li>
            </ul>

            <button
              onClick={startGame}
              className="cursor-pointer mt-4 py-3 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline font-semibold rounded-md shadow-vercel-sm hover:shadow-vercel-md transition-colors"
            >
              Start Blitz Session
            </button>
          </div>
        </div>
      )}

      {gameState === 'running' && problem && (
        <div className="w-full max-w-lg bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-8 md:p-12 text-center transition-all duration-150 relative overflow-hidden flex flex-col items-center">
          
          {/* Header Stats */}
          <div className="flex items-center justify-between w-full font-mono text-[10px] text-muted-text font-bold uppercase tracking-wider mb-2 border-b border-border-hairline pb-2.5 tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-link-blue animate-pulse"></span>
              Score: {score}
            </span>
            <span 
              className="font-bold text-sm tracking-tight transition-colors duration-300"
              style={{ color: timeLeft > 15 ? 'var(--color-success-green)' : timeLeft > 6 ? 'var(--color-warning-orange)' : 'var(--color-error-red)' }}
            >
              Time: {timeLeft}s
            </span>
          </div>

          {/* Time Pool Shrinking Bar */}
          <div className="w-full h-1 bg-canvas-soft-2 rounded-full overflow-hidden mb-8">
            <div 
              className="h-full transition-all duration-1000 ease-linear"
              style={{ 
                width: `${(timeLeft / 60) * 100}%`,
                backgroundColor: timeLeft > 15 ? 'var(--color-success-green)' : timeLeft > 6 ? 'var(--color-warning-orange)' : 'var(--color-error-red)'
              }}
            />
          </div>

          {/* Strategy badge */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border-hairline bg-canvas-soft-2 font-mono text-[9px] uppercase tracking-wider text-muted-text font-bold">
            {problem.strategyLabel}
          </span>

          {/* Math Problem numerals */}
          <div 
            className={`
              font-sans font-bold tracking-tight text-ink py-8 select-none min-h-[140px] flex items-center justify-center transition-all duration-200 tabular-nums
              ${problem.strategyId === 'add_pair_ten_hundred' && problem.operands ? 'text-3.5rem leading-snug md:text-5xl' : 'text-5xl md:text-7xl'}
            `}
            id="current-problem-text"
          >
            {problem.problemText
              ? problem.problemText
              : (problem.operands 
                  ? problem.operands.join(` ${displayOperator(problem.operator)} `)
                  : `${problem.operandA} ${displayOperator(problem.operator)} ${problem.operandB}`)}
          </div>

          {/* Typed value display */}
          <div 
            className={`
              w-44 py-1.5 my-1 text-center font-mono text-3xl font-bold border-b-2 transition-all duration-150 min-h-[48px] flex items-center justify-center tabular-nums
              ${inputStatus === 'success' 
                ? 'border-success-green text-success-green animate-pulse' 
                : inputStatus === 'error' 
                  ? 'border-error-red text-error-red' 
                  : 'border-border-hairline text-ink'
              }
            `}
            id="drill-input-box"
            aria-live="polite"
          >
            {typedValue || <span className="opacity-15 text-muted-text">?</span>}
          </div>

          {/* Keypad */}
          <div className="w-full">
            <NumPad onKeyPress={handleKeyPress} />
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="w-full max-w-xl bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-6 md:p-8 text-left animate-fade-in flex flex-col">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-1 text-center">Blitz Complete! ⚡</h2>
          <p className="text-xs text-muted-text mb-6 text-center">
            Review your final scores and worked equations to see where you can optimize your mental arithmetic.
          </p>

          {/* Scoreboard Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6 tabular-nums">
            <div className="p-4 bg-canvas-soft border border-border-hairline rounded-md text-center">
              <span className="text-[10px] font-mono text-muted-text uppercase font-bold block mb-1">Score</span>
              <span className="text-2xl font-bold text-ink">{score}</span>
            </div>
            <div className="p-4 bg-canvas-soft border border-border-hairline rounded-md text-center">
              <span className="text-[10px] font-mono text-muted-text uppercase font-bold block mb-1">Accuracy</span>
              <span className="text-2xl font-bold text-ink">
                {attemptsCount > 0 ? `${Math.round((score / attemptsCount) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="p-4 bg-canvas-soft border border-border-hairline rounded-md text-center">
              <span className="text-[10px] font-mono text-muted-text uppercase font-bold block mb-1">Attempts</span>
              <span className="text-2xl font-bold text-ink">{attemptsCount}</span>
            </div>
          </div>

          {/* Review of attempt details */}
          <h4 className="text-[11px] font-bold text-muted-text uppercase tracking-wider mb-2">Equation Review</h4>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 mb-6 border border-border-hairline rounded-md p-3 bg-canvas-soft">
            {attemptsList.length === 0 ? (
              <div className="text-xs text-muted-text text-center py-6 font-mono">No problems attempted</div>
            ) : (
              attemptsList.map((att, idx) => (
                <div 
                  key={idx}
                  className="flex items-start justify-between p-3.5 bg-canvas border border-border-hairline rounded-md"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-sans text-sm font-bold text-ink flex items-center gap-2 tabular-nums">
                      {att.problemText} = <span className="text-link-blue">{att.correctAnswer}</span>
                      <span className="text-[11px] font-normal text-muted-text font-mono">
                        (You typed: <span className={att.correct ? 'text-success-green' : 'text-error-red'}>{att.userTyped || 'empty'}</span>)
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-text mt-1">
                      {att.hint}
                    </div>
                  </div>

                  <span className={`text-[11px] font-semibold ${att.correct ? 'text-success-green' : 'text-error-red'}`}>
                    {att.correct ? '✓ Success' : '✗ Failed'}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setGameState('idle')}
            className="cursor-pointer w-full py-3 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline font-semibold rounded-md shadow-vercel-sm hover:shadow-vercel-md transition-colors text-center"
          >
            Play Again / Exit
          </button>
        </div>
      )}
    </div>
  );
}
