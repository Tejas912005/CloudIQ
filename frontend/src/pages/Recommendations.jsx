import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import {
  EmptyState, ErrorState, LoadingState,
} from '../components/StatusPanel';
import GlassPanel from '../components/shared/GlassPanel';
import StatusChip from '../components/shared/StatusChip';
import { useCloudIQ } from '../hooks/useCloudIQ';

const FILTERS = ['All', 'High', 'Medium', 'Low'];

export default function Recommendations() {
  const { platform, loading, error, refreshData } = useCloudIQ();
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  if (loading && !platform) return <LoadingState message="Computing savings opportunities..." />;
  if (error   && !platform) return <ErrorState title="Unavailable" message={error} onAction={refreshData} />;
  if (!platform)            return <EmptyState  title="No data" message="Waiting for insights." />;

  const filtered =
    filter === 'All'
      ? platform.recommendations
      : platform.recommendations.filter((item) => item.priority === filter);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 animate-fade">

      {/* Summary numbers */}
      <div className="grid gap-3 sm:grid-cols-3">
        <GlassPanel className="card-lift p-4">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Modeled Savings</p>
          <p className="mt-2 font-display text-2xl" style={{ color: 'var(--text-base)' }}>{platform.meta.savingsLabel}</p>
        </GlassPanel>
        <GlassPanel className="card-lift p-4">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Forecast</p>
          <p className="mt-2 font-display text-2xl" style={{ color: 'var(--text-base)' }}>{platform.meta.forecastLabel}</p>
        </GlassPanel>
        <GlassPanel className="card-lift p-4">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Risk Focus</p>
          <p className="mt-2 font-display text-2xl" style={{ color: 'var(--text-base)' }}>{platform.meta.riskCountLabel}</p>
        </GlassPanel>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-300"
            style={{
              borderColor: filter === item ? 'var(--accent-border)' : 'var(--border)',
              background: filter === item ? 'var(--accent-soft)' : 'var(--surface)',
              color: filter === item ? 'var(--accent)' : 'var(--text-muted)',
            }}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Action cards */}
      <div className="grid gap-3">
        {filtered.map((item) => (
          <GlassPanel
            key={item.id}
            className="card-lift p-5"
          >
            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr_0.5fr]">

              {/* Action + chips */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip
                    label={item.priority}
                    tone={item.priority === 'High' ? 'rose' : item.priority === 'Medium' ? 'amber' : 'emerald'}
                  />
                  <StatusChip label={`${item.confidence}%`} tone="gold" />
                  <StatusChip label={item.riskLevel} tone="slate" />
                </div>
                <h3 className="font-display text-lg font-medium" style={{ color: 'var(--text-base)' }}>{item.action}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.reason}</p>
              </div>

              {/* Impact */}
              <div
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Impact</p>
                <p className="font-display text-lg" style={{ color: 'var(--text-base)' }}>{item.impactLabel}</p>
              </div>

              {/* Resource + CTA */}
              <div className="space-y-2">
                <div
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Resource</p>
                  <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-base)' }}>{item.resource_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{item.resource_type}</p>
                </div>
                <button 
                  className="command-button w-full justify-center"
                  onClick={() => navigate('/assistant', { state: { autoMessage: `Stage action: ${item.action} for ${item.resource_name}` } })}
                >
                  Stage action
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
