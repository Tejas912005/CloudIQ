import { useEffect, useState, useRef } from 'react';

export default function ThinkingConsole({ steps, activeIndex }) {
  const visibleSteps = steps.slice(0, activeIndex + 1);
  const activeStepData = steps[activeIndex] || steps[0];
  const [displayedText, setDisplayedText] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    const fullText = activeStepData?.detail || activeStepData?.description || '';
    setDisplayedText('');
    let i = 0;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(intervalRef.current);
    }, 28);
    return () => clearInterval(intervalRef.current);
  }, [activeIndex, activeStepData]);

  return (
    <div
      className="overflow-hidden rounded-lg border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-mid)' }}
    >
      <div className="space-y-1.5">
        {visibleSteps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={`${step.label}-${index}`}
              className="rounded-lg border px-3 py-2 transition-all duration-400"
              style={{
                borderColor: isActive ? 'var(--accent-border)' : 'var(--border)',
                background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: isActive ? 'var(--accent)' : 'var(--success)' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{step.label}</p>
                  {isActive ? (
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {displayedText}
                      {displayedText.length < (step.detail || '').length && (
                        <span className="streaming-cursor">▋</span>
                      )}
                    </span>
                  ) : (
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-dim)' }}>{step.detail}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
