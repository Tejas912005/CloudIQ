import { Clock3 } from 'lucide-react';
import { formatClock } from '../../lib/formatters';
import GlassPanel from '../shared/GlassPanel';
import StatusChip from '../shared/StatusChip';
import { SlideInLeft } from '../shared/Motion';

const STATUS_TONE = {
  success: 'emerald',
  live: 'gold',
  warning: 'amber',
  error: 'rose',
};

export default function ActivityTimeline({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <SlideInLeft key={item.id} delay={index * 0.05}>
          <GlassPanel
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
                <span
                  className={item.status === 'live' ? 'pulse-dot shrink-0' : 'shrink-0'}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: item.status === 'success' ? 'var(--success)' :
                                item.status === 'live' ? 'var(--accent)' :
                                item.status === 'warning' ? 'var(--warning)' :
                                item.status === 'error' ? 'var(--danger)' :
                                'var(--text-muted)',
                  }}
                />
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
        </SlideInLeft>
      ))}
    </div>
  );
}
