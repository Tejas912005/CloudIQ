import { Clock3 } from 'lucide-react';
import { formatClock } from '../../lib/formatters';
import GlassPanel from '../shared/GlassPanel';
import StatusChip from '../shared/StatusChip';

const STATUS_TONE = {
  success: 'emerald',
  live: 'gold',
  warning: 'amber',
  error: 'rose',
};

export default function ActivityTimeline({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <GlassPanel
          key={item.id}
          className="card-lift grid gap-4 px-4 py-4 lg:grid-cols-[100px_1fr_100px]"
        >
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              {item.phase}
            </p>
            <p className="font-display text-lg" style={{ color: 'var(--text-base)' }}>
              {formatClock(item.timestamp)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{item.title}</p>
              <StatusChip
                label={item.status}
                tone={STATUS_TONE[item.status] || 'slate'}
              />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
          </div>

          <div className="flex items-center gap-2 text-sm lg:justify-end" style={{ color: 'var(--text-muted)' }}>
            <Clock3 className="h-3.5 w-3.5" style={{ color: 'var(--text-dim)' }} />
            <span>{item.duration}</span>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
