import React from 'react';

interface NumPadProps {
  onKeyPress: (key: string) => void;
}

export default function NumPad({ onKeyPress }: NumPadProps) {
  // ⌫ represents Backspace, C represents Clear, - represents negative sign for subtractions
  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '-', '0', '⌫'
  ];

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mx-auto mt-6" id="numpad-container">
      {keys.map((key) => {
        const isAction = key === '⌫' || key === '-';
        return (
          <button
            key={key}
            className={`
              key-press-animation select-none cursor-pointer h-14 flex items-center justify-center 
              font-mono text-xl font-medium rounded-md border transition-all duration-150 shadow-vercel-sm
              ${isAction 
                ? 'bg-canvas-soft-2 hover:bg-border-hairline-strong/10 border-border-hairline text-link-blue' 
                : 'bg-canvas hover:bg-canvas-soft-2 border-border-hairline text-ink'
              }
            `}
            onClick={() => onKeyPress(key)}
            type="button"
            id={`numpad-key-${key === '⌫' ? 'backspace' : key === '-' ? 'negative' : key}`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
