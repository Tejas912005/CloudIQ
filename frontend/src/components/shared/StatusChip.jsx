const TONES = {
  cyan:    'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
  gold:    'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  amber:   'border-amber-500/20 bg-amber-500/10 text-amber-400',
  rose:    'border-rose-500/20 bg-rose-500/10 text-rose-400',
  slate:   'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]',
};

export default function StatusChip({ label, tone = 'gold' }) {
  const mappedTone = tone === 'violet' ? 'cyan' : tone;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONES[mappedTone] || TONES.slate}`}
    >
      {label}
    </span>
  );
}
