import React, { useState, useEffect, useRef } from 'react';
import { generateProblem, STRATEGIES } from '../lib/strategies';
import type { Problem, TablesConfig, ArithmeticConfig, BridgeConfig } from '../lib/types';
import { recordAttempt } from '../lib/tracking';
import ScrollableNumberPicker from './ScrollableNumberPicker';

type GameState = 'idle' | 'running' | 'review';

export default function MetronomeCard() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [selectedCategory, setSelectedCategory] = useState<string>('addition');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('add_split_recombine');
  const [intervalMs, setIntervalMs] = useState<number>(2500); // default 2.5s
  const [sessionLength, setSessionLength] = useState<number>(10); // default 10 problems
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
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
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(100);
  const [selfReports, setSelfReports] = useState<boolean[]>([]); // track correct/incorrect
  const [isTickPulse, setIsTickPulse] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSessionTimers();
    };
  }, []);

  const stopSessionTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  // Synthesis metronome sound (Web Audio API)
  const playTickSound = (highPitch = false) => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(highPitch ? 1200 : 800, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio Context failed to play sound', e);
    }
  };

  const startSession = () => {
    const generated: Problem[] = [];
    const mergedOptions = getMergedOptions();
    
    // Auto category resolution for randomizer
    let categoryStrategy = selectedStrategy;

    for (let i = 0; i < sessionLength; i++) {
      let targetId = categoryStrategy;
      if (categoryStrategy === 'all') {
        const filtered = STRATEGIES.filter(s => s.id !== 'mult_tables_10_20' && s.id !== 'add_sub_3_terms');
        const randomIndex = Math.floor(Math.random() * filtered.length);
        targetId = filtered[randomIndex].id;
      } else if (categoryStrategy === 'addition_all') {
        const additionStrats = ['add_split_recombine', 'add_round_addend', 'add_pair_ten_hundred'];
        const randomIndex = Math.floor(Math.random() * additionStrats.length);
        targetId = additionStrats[randomIndex];
      } else if (categoryStrategy === 'subtraction_all') {
        const subtractionStrats = ['sub_bridge_10', 'sub_adjustment', 'sub_const_shift', 'sub_round_subtrahend'];
        const randomIndex = Math.floor(Math.random() * subtractionStrats.length);
        targetId = subtractionStrats[randomIndex];
      } else if (categoryStrategy === 'multiplication_all') {
        const multStrats = ['mult_near_base', 'mult_double_halve', 'mult_teen_decomposition'];
        const randomIndex = Math.floor(Math.random() * multStrats.length);
        targetId = multStrats[randomIndex];
      }

      try {
        generated.push(generateProblem(targetId, mergedOptions));
      } catch (e) {
        generated.push(generateProblem('add_split_recombine', mergedOptions));
      }
    }

    setProblems(generated);
    setCurrentIndex(0);
    setSelfReports(new Array(sessionLength).fill(true)); // default all to correct
    setGameState('running');
    setProgress(100);
    
    // Play starting tick
    playTickSound(true);
    runTickLoop(generated, 0);
  };

  const runTickLoop = (sessionProbs: Problem[], index: number) => {
    stopSessionTimers();
    
    let timeElapsed = 0;
    const updateRate = 40; // update progress bar every 40ms
    
    progressIntervalRef.current = setInterval(() => {
      timeElapsed += updateRate;
      const pct = Math.max(0, 100 - (timeElapsed / intervalMs) * 100);
      setProgress(pct);
    }, updateRate);

    timerRef.current = setTimeout(() => {
      const nextIdx = index + 1;
      setIsTickPulse(true);
      setTimeout(() => setIsTickPulse(false), 150);

      if (nextIdx < sessionProbs.length) {
        // Play regular tick
        playTickSound(nextIdx === sessionProbs.length - 1); // High pitch on final problem
        setCurrentIndex(nextIdx);
        setProgress(100);
        runTickLoop(sessionProbs, nextIdx);
      } else {
        stopSessionTimers();
        setGameState('review');
      }
    }, intervalMs);
  };

  const toggleReport = (index: number) => {
    setSelfReports(prev => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  };

  const saveAndExit = () => {
    problems.forEach((prob, idx) => {
      recordAttempt(prob.strategyId, intervalMs, selfReports[idx]);
    });
    
    setGameState('idle');
    setProblems([]);
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

  const displayOperator = (problem: Problem) => {
    return problem.operator === '*' ? '×' : problem.operator;
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      
      {gameState === 'idle' && (
        <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
          
          {/* Category selection */}
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

          {/* Sub category details selector & Settings toggle */}
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

          {/* Settings panel drawer */}
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

          {/* Metronome Speed and Session Size Card */}
          <div className="w-full max-w-md bg-canvas border border-border-hairline p-6 rounded-xl shadow-vercel-lg flex flex-col gap-5">
            <h4 className="text-sm font-bold tracking-tight text-ink border-b border-border-hairline pb-2 text-left">Metronome Rules</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-medium text-body-text">Ticking Speed (Interval)</label>
                <select
                  value={intervalMs}
                  onChange={e => setIntervalMs(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-canvas-soft border border-border-hairline rounded-md text-sm outline-none cursor-pointer"
                >
                  <option value={1500}>1.5s (Lightning)</option>
                  <option value={2000}>2.0s (Fast)</option>
                  <option value={2500}>2.5s (Standard)</option>
                  <option value={3000}>3.0s (Comfortable)</option>
                  <option value={4000}>4.0s (Steady)</option>
                  <option value={5000}>5.0s (Slow Practice)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-medium text-body-text">Session Length</label>
                <select
                  value={sessionLength}
                  onChange={e => setSessionLength(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-canvas-soft border border-border-hairline rounded-md text-sm outline-none cursor-pointer"
                >
                  <option value={5}>5 Problems</option>
                  <option value={10}>10 Problems</option>
                  <option value={15}>15 Problems</option>
                  <option value={20}>20 Problems</option>
                </select>
              </div>
            </div>

            {/* Metronome Sound toggle */}
            <div className="flex items-center justify-between border-t border-border-hairline pt-3">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-body-text">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
                <span className="text-xs font-medium text-body-text">Metronome Audio Click</span>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${soundEnabled ? 'bg-link-blue' : 'bg-border-hairline-strong/30'}`}
              >
                <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
              </button>
            </div>

            <button
              onClick={startSession}
              className="cursor-pointer mt-2 w-full py-3 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline font-semibold rounded-md shadow-vercel-sm hover:shadow-vercel-md transition-colors"
            >
              Start Practice Session
            </button>
          </div>
        </div>
      )}

      {gameState === 'running' && problems[currentIndex] && (
        <div 
          className={`
            w-full max-w-lg bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-8 md:p-12 text-center transition-all duration-150 relative overflow-hidden flex flex-col items-center
            ${isTickPulse ? 'scale-[1.01] border-link-blue/40 shadow-vercel-glow bg-canvas' : ''}
          `}
        >
          {/* Header Progress stats */}
          <div className="flex items-center justify-between w-full font-mono text-[10px] text-muted-text font-bold uppercase tracking-wider mb-4 border-b border-border-hairline pb-2.5 tabular-nums">
            <span>Problem {currentIndex + 1} of {sessionLength}</span>
            <span>Speed: {(intervalMs / 1000).toFixed(1)}s</span>
          </div>

          {/* Custom Shrinking Ticker Indicator */}
          <div className="w-full h-1 bg-canvas-soft-2 rounded-full overflow-hidden mb-8">
            <div 
              className="h-full bg-link-blue transition-all duration-[40ms] ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Ticking Question display */}
          <div 
            className={`
              font-sans font-bold tracking-tight text-ink py-10 select-none min-h-[160px] flex items-center justify-center transition-all duration-200 tabular-nums
              ${problems[currentIndex].strategyId === 'add_pair_ten_hundred' && problems[currentIndex].operands ? 'text-3.5rem leading-snug md:text-5xl' : 'text-5xl md:text-7xl'}
            `}
          >
            {problems[currentIndex].problemText
              ? problems[currentIndex].problemText
              : (problems[currentIndex].operands 
                  ? problems[currentIndex].operands.join(` ${displayOperator(problems[currentIndex])} `)
                  : `${problems[currentIndex].operandA} ${displayOperator(problems[currentIndex])} ${problems[currentIndex].operandB}`)}
          </div>

          <div className="text-xs font-mono text-muted-text mt-6 animate-pulse flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning-orange"></span>
            Solve mentally in your head…
          </div>
        </div>
      )}

      {gameState === 'review' && (
        <div className="w-full max-w-xl bg-canvas border border-border-hairline rounded-xl shadow-vercel-lg p-6 md:p-8 text-left animate-fade-in flex flex-col">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-1 text-center">Session Complete!</h2>
          <p className="text-xs text-muted-text mb-6 text-center">
            Review correct answers and verify if your mental solutions matched. Toggle incorrect ones before saving.
          </p>

          {/* Problems breakdown list */}
          <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1 mb-6 border border-border-hairline/60 rounded-md p-3 bg-canvas-soft">
            {problems.map((prob, idx) => {
              const op = displayOperator(prob);
              const displayVal = prob.problemText
                ? prob.problemText
                : (prob.operands 
                    ? prob.operands.join(` ${op} `)
                    : `${prob.operandA} ${op} ${prob.operandB}`);
              
              const isCorrect = selfReports[idx];

              return (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-canvas border border-border-hairline rounded-md hover:border-border-hairline-strong transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-sans text-base font-bold text-ink tabular-nums">
                      {displayVal} = <span className="text-link-blue">{prob.answer}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-text mt-1 truncate">
                      {prob.hint}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleReport(idx)}
                    className={`
                      cursor-pointer px-3 py-1.5 rounded text-xs font-semibold tracking-tight transition-all
                      ${isCorrect 
                        ? 'bg-success-green/10 text-success-green border border-success-green/30 hover:bg-success-green/20' 
                        : 'bg-error-red/10 text-error-red border border-error-red/30 hover:bg-error-red/20'
                      }
                    `}
                  >
                    {isCorrect ? '✓ Correct' : '✗ Missed'}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={saveAndExit}
            className="cursor-pointer w-full py-3 bg-ink text-canvas hover:bg-ink/90 border border-border-hairline font-semibold rounded-md shadow-vercel-sm hover:shadow-vercel-md transition-colors text-center"
          >
            Save Session & Return
          </button>
        </div>
      )}
    </div>
  );
}
