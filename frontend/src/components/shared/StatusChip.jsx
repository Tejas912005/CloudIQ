const TONES = {
  cyan: {
    background: 'var(--data-soft)',
    borderColor: 'var(--accent-border)',
    color: 'var(--data)',
  },
  gold: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent-border)',
    color: 'var(--accent)',
  },
  emerald: {
    background: 'var(--success-soft)',
    borderColor: 'var(--success-border)',
    color: 'var(--success)',
  },
  amber: {
    background: 'var(--warning-soft)',
    borderColor: 'var(--warning-border)',
    color: 'var(--warning)',
  },
  rose: {
    background: 'var(--danger-soft)',
    borderColor: 'var(--danger-border)',
    color: 'var(--danger)',
  },
  slate: {
    background: 'var(--surface)',
    borderColor: 'var(--border)',
    color: 'var(--text-muted)',
  },
};

export default function StatusChip({ label, tone = 'gold' }) {
  const mappedTone = tone === 'violet' ? 'gold' : tone;
  const style = TONES[mappedTone] || TONES.slate;

  return (
    <span
      className="status-chip uppercase"
      style={style}
    >
      {label}
    </span>
  );
}
