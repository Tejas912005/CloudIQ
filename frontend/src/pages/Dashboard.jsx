import { useEffect, useState } from 'react';
import { RefreshCcw, Zap } from 'lucide-react';
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
import { FadeUp, StaggerParent, StaggerChild, PressButton } from '../components/shared/Motion';

function getMetricTone(cardId) {
  if (cardId === 'anomaly') return 'var(--warning)';
  if (cardId === 'risk') return 'var(--danger)';
  return 'var(--data)';
}

function getAccentTone(cardId) {
  if (cardId === 'savings') return 'var(--success)';
  if (cardId === 'anomaly') return 'var(--warning)';
  if (cardId === 'risk') return 'var(--danger)';
  return 'var(--data)';
}

function getSummaryTone(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes('idle')) return 'var(--warning)';
  if (normalized.includes('over')) return 'var(--danger)';
  if (normalized.includes('healthy')) return 'var(--success)';
  return 'var(--accent)';
}

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

  if (loading && !platform) return <LoadingState message="Loading your cloud overview..." />;
  if (error && !platform) return <ErrorState title="Unavailable" message={error} onAction={refreshData} />;
  if (!platform) return <EmptyState title="No data" message="Waiting for telemetry." />;

  return (
    <div
      className="relative mx-auto flex max-w-[1600px] flex-col gap-5"
      style={{ isolation: 'isolate' }}
    >
      <ParticleField />

      <div className="relative z-[1] flex flex-col gap-5">
        <StaggerParent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {platform.insightCards.map((card) => {
            const isCurrency = String(card.value).includes('$');
            const prefix = isCurrency ? (String(card.value).includes('+') ? '+$' : '$') : '';
            const metricTone = getMetricTone(card.id);
            const accentTone = getAccentTone(card.id);

            return (
              <StaggerChild key={card.id}>
                <GlassPanel className="metric-card">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className="text-[10px] font-semibold uppercase"
                      style={{ color: 'var(--text-dim)', letterSpacing: '0.12em' }}
                    >
                      {card.title}
                    </p>
                    {card.sparkData?.length > 1 && (
                      <SparkLine
                        data={card.sparkData}
                        width={54}
                        height={20}
                        color={accentTone}
                      />
                    )}
                  </div>

                  <p
                    className="mt-3.5 font-display text-[32px] font-bold leading-none"
                    style={{ color: metricTone }}
                  >
                    <AnimatedNumber value={card.rawValue || card.value} prefix={prefix} />
                  </p>

                  {card.delta && (
                    <div className="mt-2.5">
                      <DeltaBadge
                        value={card.delta}
                        trend={card.trend}
                        invertColors={card.id === 'savings'}
                      />
                    </div>
                  )}

                  <div
                    className="absolute inset-x-0 bottom-0 h-0.5"
                    style={{ background: accentTone, borderRadius: '0 0 14px 14px' }}
                  />
                </GlassPanel>
              </StaggerChild>
            );
          })}
        </StaggerParent>

        <FadeUp delay={0.18} className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <GlassPanel className="space-y-4 p-5" glow>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-base)' }}>
                    Cost Transformation
                  </h3>
                </div>
                <PressButton className="command-button" onClick={refreshData} type="button">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </PressButton>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span>Before</span>
                    <span className="font-mono-data">{formatCurrency(platform.beforeAfter.before)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="h-full w-full rounded-full transition-all duration-700"
                      style={{
                        background: 'repeating-linear-gradient(45deg, var(--text-dim), var(--text-dim) 2px, transparent 2px, transparent 8px)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span>After</span>
                    <span className="font-mono-data">{formatCurrency(platform.beforeAfter.after)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        background: 'linear-gradient(90deg, var(--success), var(--data))',
                        width: `${(platform.beforeAfter.after / Math.max(platform.beforeAfter.before || 1, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="rounded-[14px] border p-3"
                style={{
                  borderColor: 'var(--success-border)',
                  background: 'var(--success-soft)',
                  animation: 'borderFlow 3s ease-in-out infinite',
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: 'var(--success)', letterSpacing: '0.12em' }}
                >
                  Savings
                </p>
                <p className="mt-1 font-display text-2xl font-bold" style={{ color: 'var(--text-base)' }}>
                  {formatCurrency(platform.beforeAfter.savings)}
                </p>
              </div>

              <WhatIfSimulator />
            </GlassPanel>

            <GlassPanel className="p-5">
              <h3 className="mb-4 font-display text-base font-semibold" style={{ color: 'var(--text-base)' }}>
                System Summary
              </h3>
              <div className="space-y-3">
                {platform.summaryMetrics.map((metric) => {
                  const valueColor = getSummaryTone(metric.label);

                  return (
                    <div
                      key={metric.label}
                      className="rounded-[12px] border p-3"
                      style={{
                        borderColor: 'var(--border)',
                        borderLeft: `3px solid ${valueColor}`,
                        background: 'var(--surface)',
                      }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase"
                        style={{ color: 'var(--text-dim)', letterSpacing: '0.12em' }}
                      >
                        {metric.label}
                      </p>
                      <p className="mt-1 font-display text-2xl font-bold" style={{ color: valueColor }}>
                        {metric.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
        </FadeUp>

        <FadeUp delay={0.28}>
          <GlassPanel
            className="space-y-3 p-4"
            style={{ background: 'linear-gradient(135deg, var(--bg-card), var(--surface))' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: 'var(--accent)',
                  animation: 'glowPulse 2.2s ease-in-out infinite',
                }}
              />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-base)' }}>
                Agent Intelligence
              </h3>
            </div>
            <ThinkingConsole
              steps={platform.heroSteps}
              activeIndex={activeStep}
            />
            <AgentFlow
              nodes={platform.agentNodes}
              activeIndex={activeStep % platform.agentNodes.length}
            />
          </GlassPanel>
        </FadeUp>
      </div>
    </div>
  );
}
