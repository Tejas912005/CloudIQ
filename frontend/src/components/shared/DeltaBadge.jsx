import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export default function DeltaBadge({ value, trend, invertColors = false }) {
  let style = {
    color: 'var(--text-dim)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  };
  let Icon = Minus;

  const isUp = trend === 'increasing' || trend === 'up';
  const isDown = trend === 'decreasing' || trend === 'down';

  if (isUp) {
    Icon = TrendingUp;
    const color = invertColors ? 'var(--success)' : 'var(--danger)';
    const bg = invertColors ? 'rgba(16,217,138,0.10)' : 'rgba(255,68,102,0.10)';
    const border = invertColors ? 'rgba(16,217,138,0.25)' : 'rgba(255,68,102,0.25)';
    style = { color, background: bg, border: `1px solid ${border}` };
  } else if (isDown) {
    Icon = TrendingDown;
    const color = invertColors ? 'var(--danger)' : 'var(--success)';
    const bg = invertColors ? 'rgba(255,68,102,0.10)' : 'rgba(16,217,138,0.10)';
    const border = invertColors ? 'rgba(255,68,102,0.25)' : 'rgba(16,217,138,0.25)';
    style = { color, background: bg, border: `1px solid ${border}` };
  }

  return (
    <div style={{
      ...style,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      borderRadius: '20px',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 600,
    }}>
      <Icon size={11} />
      {value}
    </div>
  );
}
