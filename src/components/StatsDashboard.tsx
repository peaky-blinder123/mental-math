import React, { useState, useEffect } from 'react';
import { getAttempts, clearAttempts, type SessionRecord } from '../lib/tracking';
import { STRATEGIES } from '../lib/strategies';

interface StrategyStat {
  id: string;
  label: string;
  attempts: number;
  correct: number;
  avgTime: number;
}

export default function StatsDashboard() {
  const [history, setHistory] = useState<SessionRecord[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setHistory(getAttempts());
  }, []);

  const handleReset = () => {
    if (confirm('Are you sure you want to clear your mental math statistics history? This action is irreversible.')) {
      clearAttempts();
      setHistory([]);
    }
  };

  const totalAttempts = history.length;
  const correctAttempts = history.filter(h => h.correct).length;
  const overallAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const overallAvgTime = totalAttempts > 0 
    ? (history.reduce((sum, h) => sum + h.deltaMs, 0) / totalAttempts / 1000).toFixed(2)
    : '0.00';

  // Strategy breakdown
  const strategyStats: StrategyStat[] = STRATEGIES.map(strat => {
    const stratHistory = history.filter(h => h.strategyId === strat.id);
    const count = stratHistory.length;
    const correctCount = stratHistory.filter(h => h.correct).length;
    const avg = count > 0 
      ? Math.round(stratHistory.reduce((sum, h) => sum + h.deltaMs, 0) / count)
      : 0;

    return {
      id: strat.id,
      label: strat.label,
      attempts: count,
      correct: correctCount,
      avgTime: avg,
    };
  });

  // Hotspots: Strategies with lowest accuracy or highest average time (with at least 2 attempts)
  const hotspots = [...strategyStats]
    .filter(s => s.attempts >= 2)
    .sort((a, b) => {
      const accA = a.correct / a.attempts;
      const accB = b.correct / b.attempts;
      if (accA !== accB) return accA - accB; // Lowest accuracy first
      return b.avgTime - a.avgTime; // Slowest speed first
    })
    .slice(0, 2);

  // Generate SVG path for a historical performance chart
  const renderHistoryChart = () => {
    if (history.length < 5) return null;
    
    // Take the last 15 attempts to show trends
    const recent = history.slice(-15);
    
    const width = 500;
    const height = 120;
    const padding = 10;
    
    const maxTime = Math.max(...recent.map(h => h.deltaMs));
    const minTime = Math.min(...recent.map(h => h.deltaMs));
    const timeRange = maxTime - minTime || 1;
    
    const points = recent.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / (recent.length - 1);
      // Invert Y so faster (smaller time) is higher on the chart
      const y = height - padding - ((item.deltaMs - minTime) / timeRange) * (height - padding * 2);
      return { x, y, ...item };
    });
    
    const pathD = points.reduce((acc, p, idx) => {
      return acc + `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }, '');
    
    return (
      <div className="w-full bg-canvas border border-border-hairline rounded-xl p-5 shadow-vercel-md text-left">
        <h3 className="text-xs font-mono font-bold text-muted-text uppercase tracking-wider mb-4">Response Time Trend (Last 15 attempts)</h3>
        <div className="relative w-full overflow-hidden h-[130px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--color-border-hairline)" strokeDasharray="3" />
            <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="var(--color-border-hairline)" strokeDasharray="3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-border-hairline)" strokeDasharray="3" />
            
            {/* Area under the line */}
            <path
              d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
              fill="url(#gradient-chart)"
              opacity="0.15"
            />
            
            {/* Trend Line */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-link-blue)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Points */}
            {points.map((p, idx) => (
              <circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r="3.5"
                className={`transition-all duration-200 cursor-help hover:r-5`}
                fill={p.correct ? 'var(--color-success-green)' : 'var(--color-error-red)'}
                stroke="var(--color-canvas)"
                strokeWidth="1"
              >
                <title>{`${p.correct ? 'Correct' : 'Missed'} - ${(p.deltaMs / 1000).toFixed(2)}s`}</title>
              </circle>
            ))}
            
            {/* Gradients definitions */}
            <defs>
              <linearGradient id="gradient-chart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-link-blue)" />
                <stop offset="100%" stopColor="var(--color-link-blue)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="flex justify-between font-mono text-[9px] text-muted-text mt-2 uppercase">
          <span>Oldest</span>
          <span className="text-[10px] text-link-blue font-bold">Higher is faster (Lower latency)</span>
          <span>Newest</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto">
      
      {/* Page Header */}
      <div className="text-center max-w-md mx-auto mb-2">
        <h2 className="text-2xl font-bold tracking-tight text-ink">Performance Dashboard.</h2>
        <p className="text-xs text-muted-text mt-1">
          Review details of your mental arithmetic metrics, training frequencies, and accuracy curves.
        </p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full tabular-nums">
        <div className="bg-canvas border border-border-hairline rounded-xl p-6 shadow-vercel-sm text-left">
          <span className="text-[10px] font-mono text-muted-text uppercase font-bold tracking-wider block">Total Runs</span>
          <span className="text-3xl font-extrabold text-ink mt-2 block">{totalAttempts}</span>
        </div>

        <div className="bg-canvas border border-border-hairline rounded-xl p-6 shadow-vercel-sm text-left">
          <span className="text-[10px] font-mono text-muted-text uppercase font-bold tracking-wider block">Accuracy Rate</span>
          <span 
            className="text-3xl font-extrabold mt-2 block"
            style={{ 
              color: totalAttempts === 0 
                ? 'var(--color-ink)' 
                : overallAccuracy >= 80 
                  ? 'var(--color-success-green)' 
                  : overallAccuracy >= 50 
                    ? 'var(--color-warning-orange)' 
                    : 'var(--color-error-red)' 
            }}
          >
            {overallAccuracy}%
          </span>
        </div>

        <div className="bg-canvas border border-border-hairline rounded-xl p-6 shadow-vercel-sm text-left">
          <span className="text-[10px] font-mono text-muted-text uppercase font-bold tracking-wider block">Average Speed</span>
          <span className="text-3xl font-extrabold text-ink mt-2 block">{overallAvgTime}s</span>
        </div>
      </div>

      {/* Analytics chart and Hotspots */}
      {totalAttempts > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Chart */}
          {renderHistoryChart() || (
            <div className="bg-canvas border border-border-hairline border-dashed rounded-xl p-6 flex items-center justify-center text-xs text-muted-text font-mono shadow-sm">
              📈 Run at least 5 problems to populate the response timeline trend.
            </div>
          )}

          {/* Hotspots: Practice Recommendations */}
          <div className="bg-canvas border border-border-hairline rounded-xl p-5 shadow-vercel-md text-left flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-mono font-bold text-muted-text uppercase tracking-wider mb-4">Focus Recommendations</h3>
              {hotspots.length === 0 ? (
                <div className="text-xs text-body-text leading-relaxed">
                  Excellent progress! Keep practicing diverse strategies to identify focus areas.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {hotspots.map(spot => {
                    const acc = Math.round((spot.correct / spot.attempts) * 100);
                    return (
                      <div key={spot.id} className="p-3 bg-canvas-soft border border-border-hairline rounded-md">
                        <div className="text-xs font-semibold text-ink">{spot.label}</div>
                        <div className="flex justify-between font-mono text-[10px] text-muted-text mt-1.5 tabular-nums">
                          <span>Accuracy: <strong className="text-error-red">{acc}%</strong></span>
                          <span>Time: <strong>{(spot.avgTime / 1000).toFixed(2)}s</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-border-hairline flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-text uppercase">Identified automatically</span>
              <a href="/sandbox" className="text-xs font-semibold text-link-blue hover:text-link-blue-deep transition-colors">Start practicing →</a>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Strategy Breakdown */}
      <div className="bg-canvas border border-border-hairline rounded-xl p-6 md:p-8 text-left shadow-vercel-lg flex flex-col">
        <h3 className="text-sm font-bold tracking-tight text-ink border-b border-border-hairline pb-3 mb-5 uppercase tracking-wider font-mono">Strategy Analytics</h3>
        
        {totalAttempts === 0 ? (
          <div className="text-center py-12 text-sm text-muted-text font-mono border border-border-hairline border-dashed rounded-lg bg-canvas-soft">
            No practicing records logged. Start a Zen Sandbox or Typing Drill to view detailed strategy analytics.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {strategyStats.map(stat => {
              const accuracy = stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0;
              const formattedTime = stat.attempts > 0 ? `${(stat.avgTime / 1000).toFixed(2)}s` : '-';
              
              let accuracyColor = 'text-muted-text';
              let barBgColor = 'bg-border-hairline-strong/20';
              if (stat.attempts > 0) {
                if (accuracy >= 80) {
                  accuracyColor = 'text-success-green';
                  barBgColor = 'bg-success-green';
                } else if (accuracy >= 50) {
                  accuracyColor = 'text-warning-orange';
                  barBgColor = 'bg-warning-orange';
                } else {
                  accuracyColor = 'text-error-red';
                  barBgColor = 'bg-error-red';
                }
              }

              return (
                <div 
                  key={stat.id} 
                  className="flex flex-col gap-2 p-4 bg-canvas border border-border-hairline rounded-xl hover:border-border-hairline-strong transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <span className="font-sans text-sm font-bold text-ink">
                      {stat.label}
                    </span>
                    <div className="flex gap-4 font-mono text-xs text-muted-text tabular-nums">
                      <span>
                        Runs: <strong className="text-ink font-semibold">{stat.attempts}</strong>
                      </span>
                      <span>
                        Speed: <strong className="text-ink font-semibold">{formattedTime}</strong>
                      </span>
                      <span>
                        Accuracy: <strong className={`${accuracyColor} font-bold`}>{stat.attempts > 0 ? `${accuracy}%` : '-'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Horizontal accuracy progress bar */}
                  {stat.attempts > 0 && (
                    <div className="w-full h-1.5 bg-canvas-soft-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${barBgColor}`} 
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalAttempts > 0 && (
          <div className="mt-8 flex justify-end">
            <button 
              onClick={handleReset}
              className="cursor-pointer px-4 py-2 bg-canvas hover:bg-canvas-soft-2 border border-error-red/20 text-error-red text-xs font-semibold rounded-md shadow-vercel-sm transition-colors"
            >
              Clear Session History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
