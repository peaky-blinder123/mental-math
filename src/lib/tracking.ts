export interface SessionRecord {
  strategyId: string;
  deltaMs: number;
  correct: boolean;
  timestamp: number;
}

export function recordAttempt(strategyId: string, deltaMs: number, correct: boolean) {
  if (typeof window === 'undefined') return;
  const historyStr = localStorage.getItem('mental_math_attempts') || '[]';
  try {
    const history: SessionRecord[] = JSON.parse(historyStr);
    history.push({
      strategyId,
      deltaMs,
      correct,
      timestamp: Date.now()
    });
    localStorage.setItem('mental_math_attempts', JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save history", e);
  }
}

export function getAttempts(): SessionRecord[] {
  if (typeof window === 'undefined') return [];
  const historyStr = localStorage.getItem('mental_math_attempts') || '[]';
  try {
    return JSON.parse(historyStr);
  } catch (e) {
    return [];
  }
}

export function clearAttempts() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('mental_math_attempts');
}
