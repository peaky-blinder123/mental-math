import React, { useRef, useEffect } from 'react';

interface ScrollableNumberPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  step?: number;
}

export default function ScrollableNumberPicker({
  min,
  max,
  value,
  onChange,
  step = 1
}: ScrollableNumberPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Generate options efficiently
  const options: number[] = [];
  for (let i = min; i <= max; i += step) {
    options.push(i);
  }

  // Handle centering the active item smoothly when value changes or component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeRef.current && containerRef.current) {
        const container = containerRef.current;
        const active = activeRef.current;
        
        const containerWidth = container.clientWidth;
        const activeWidth = active.clientWidth;
        const activeLeft = active.offsetLeft;
        
        container.scrollTo({
          left: activeLeft - containerWidth / 2 + activeWidth / 2,
          behavior: 'smooth'
        });
      }
    }, 50); // slight delay to ensure browser layout is ready

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative w-full bg-canvas border border-border-hairline rounded-lg p-1.5 overflow-hidden">
      {/* Left/Right Fading Gradients for Premium Vercel Aesthetic */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-canvas via-canvas/70 to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-canvas via-canvas/70 to-transparent pointer-events-none z-10" />
      
      <div 
        ref={containerRef}
        className="flex gap-1 overflow-x-auto snap-x snap-mandatory scroll-smooth py-1 px-10 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {options.map((opt) => {
          const isActive = opt === value;
          return (
            <button
              key={opt}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => onChange(opt)}
              className={`snap-center flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center font-mono text-xs transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-ink text-canvas font-bold scale-105 shadow-sm border border-ink'
                  : 'text-muted-text hover:text-ink hover:bg-canvas-soft border border-transparent'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
