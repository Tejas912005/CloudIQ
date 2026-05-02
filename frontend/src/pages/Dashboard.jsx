import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import AgentFlow from '../components/dashboard/AgentFlow';
import ThinkingConsole from '../components/dashboard/ThinkingConsole';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StatusPanel';
import GlassPanel from '../components/shared/GlassPanel';
import ParticleField from '../components/shared/ParticleField';
import AnimatedNumber from '../components/shared/AnimatedNumber';
import DeltaBadge from '../components/shared/DeltaBadge';
import SparkLine from '../components/shared/SparkLine';
import WhatIfSimulator from '../components/dashboard/WhatIfSimulator';
import { useCloudIQ } from '../hooks/useCloudIQ';
import { formatCurrency } from '../lib/formatters';

export default function Dashboard() {
  const { platform, loading, error, refreshData } = useCloudIQ();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!platform?.heroSteps?.length) return undefined;
    const timer = window.setInterval(() => {
      setActiveStep((c) => (c + 1) % platform.heroSteps.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [platform]);

  if (loading && !platform) return <LoadingState message="Initialising…" />;
  if (error   && !platform) return <ErrorState title="Unavailable" message={error} onAction={refreshData} />;
  if (!platform)            return <EmptyState  title="No data" message="Waiting for telemetry." />;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 animate-fade relative"
         style={{ position: 'relative', isolation: 'isolate' }}>
      <ParticleField />

      <div style={{ position: 'relative', zIndex: 1 }} className="flex flex-col gap-5">
      {/* Top: Key metric cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {platform.insightCards.map((card, idx) => {
          const isCurrency = String(card.value).includes('$');
          const prefix = isCurrency ? (String(card.value).includes('+') ? '+$' : '$') : '';
          return (
            <GlassPanel
              key={card.id}
              className="card-lift p-4 animate-fade-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                  {card.title}
                </p>
                {card.sparkData?.length > 1 && (
                  <SparkLine
                    data={card.sparkData}
                    width={50}
                    height={18}
                    color={card.id === 'savings' ? 'var(--success)'
                         : card.id === 'anomaly' ? 'var(--warning)'
                         : card.id === 'risk' ? 'var(--danger)'
                         : 'var(--accent)'}
                  />
                )}
              </div>
              <p className="mt-3 font-display text-3xl" style={{ color: 'var(--text-base)' }}>
                <AnimatedNumber value={card.rawValue || card.value} prefix={prefix} />
              </p>
              {card.delta && (
                <div style={{ marginTop: '8px' }}>
                  <DeltaBadge
                    value={card.delta}
                    trend={card.trend}
                    invertColors={card.id === 'savings'}
                  />
                </div>
              )}
            </GlassPanel>
          );
        })}
      </div>

      {/* Middle: Cost transformation + Summary */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">

        {/* Cost transformation */}
        <GlassPanel className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium" style={{ color: 'var(--text-base)' }}>Cost Transformation</h3>
            <button className="command-button" onClick={refreshData}>
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
                <span>Before</span>
                <span>{formatCurrency(platform.beforeAfter.before)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full w-full rounded-full transition-all duration-700"
                  style={{ background: 'var(--text-dim)' }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
                <span>After</span>
                <span>{formatCurrency(platform.beforeAfter.after)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    background: 'var(--success)',
                    width: `${(platform.beforeAfter.after / Math.max(platform.beforeAfter.before || 1, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className="rounded-lg border p-3"
            style={{ borderColor: 'rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.06)' }}
          >
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--success)' }}>Savings</p>
            <p className="mt-1 font-display text-2xl" style={{ color: 'var(--text-base)' }}>{formatCurrency(platform.beforeAfter.savings)}</p>
          </div>
          <WhatIfSimulator />
        </GlassPanel>

        {/* System summary */}
        <GlassPanel className="p-5">
          <h3 className="font-display text-base font-medium mb-4" style={{ color: 'var(--text-base)' }}>System Summary</h3>
          <div className="space-y-3">
            {platform.summaryMetrics.map((metric) => {
              const valueColor =
                metric.label.toLowerCase().includes('idle') ? 'var(--warning)' :
                metric.label.toLowerCase().includes('over') ? 'var(--danger)' :
                metric.label.toLowerCase().includes('healthy') ? 'var(--success)' :
                'var(--accent)';
              return (
                <div
                  key={metric.label}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{metric.label}</p>
                  <p className="mt-1 font-display text-2xl" style={{ color: valueColor }}>{metric.value}</p>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      {/* Bottom: Agent flow (subtle) + Thinking console */}
      <GlassPanel className="p-4 space-y-3">
        <ThinkingConsole
          steps={platform.heroSteps}
          activeIndex={activeStep}
        />
        <AgentFlow
          nodes={platform.agentNodes}
          activeIndex={activeStep % platform.agentNodes.length}
        />
      </GlassPanel>
      </div>
    </div>
  );
}
