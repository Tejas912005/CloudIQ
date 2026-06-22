import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Brush
} from 'recharts';
import {
  EmptyState, ErrorState, LoadingState,
} from '../components/StatusPanel';
import GlassPanel from '../components/shared/GlassPanel';
import { useCloudIQ } from '../hooks/useCloudIQ';
import { formatCurrency } from '../lib/formatters';

const STATUS_COLORS = ['#a78bfa', '#22d3ee', '#34d399'];

const safeNumber = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const TOOLTIP_STYLE = {
  background: 'var(--bg-mid)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-base)',
};

export default function Insights() {
  const { platform, loading, error, refreshData } = useCloudIQ();

  if (loading && !platform) return <LoadingState message="Analysing cost data..." />;
  if (error   && !platform) return <ErrorState title="Unavailable" message={error} onAction={refreshData} />;
  if (!platform)            return <EmptyState  title="No insights" message="Waiting for telemetry." />;

  const anomalyDays = safeNumber(platform?.rawSummary?.anomalies?.total_anomaly_days);
  const overUtilized = safeNumber(platform?.rawSummary?.resources?.over_utilized_count);
  const highRiskCount = safeNumber(platform?.rawSummary?.graph?.high_risk_nodes);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 animate-fade">

      {/* Insights header (KPI + takeaways) */}
      <GlassPanel className="p-5 space-y-4" glow>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-medium" style={{ color: 'var(--text-base)' }}>Operational Insights</h2>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
              AI-curated summary based on telemetry, anomaly detection, and fleet risk.
            </p>
          </div>
          <div className="status-chip" style={{ background: 'var(--surface-2)' }}>
            <span className="pulse-dot" />
            <span>Live Analytics</span>
          </div>
        </div>

        <div className="stats-grid">
          {[
            {
              label: 'Anomaly Days',
              value: anomalyDays ?? '—',
              color: '#ef4444',
            },
            {
              label: 'Over-Utilized',
              value: overUtilized ?? '—',
              color: '#f59e0b',
            },
            {
              label: 'High-Risk Nodes',
              value: highRiskCount ?? '—',
              color: '#ef4444',
            },
            {
              label: 'Spend Signal',
              value: platform?.charts?.spendDelta != null ? `${platform.charts.spendDelta > 0 ? '+' : ''}${formatCurrency(platform.charts.spendDelta)}` : '—',
              color: 'var(--data)',
            },
          ].map((stat) => (
            <div key={stat.label} className="stat-card fade-in" style={{ paddingTop: 14, paddingBottom: 14, borderColor: 'var(--border)', borderRadius: 14 }}>
              <div style={{ color: stat.color, fontWeight: 800, fontSize: 22 }}>
                {stat.value}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {[
            {
              title: 'What to watch',
              body: overUtilized != null
                ? (overUtilized > 0
                    ? `You have ${overUtilized} over-utilized resources. Prioritize load balancing or rightsizing to reduce risk.`
                    : 'No over-utilized resources detected right now. Keep monitoring anomalies and utilization drift.')
                : 'Utilization drift signal is unavailable—charts will update on next refresh.',
            },
            {
              title: 'Anomaly context',
              body: anomalyDays != null
                ? (anomalyDays > 0
                    ? `Cost anomalies were flagged for ${anomalyDays} days. Review the cost-flow chart around those dates.`
                    : 'No cost anomalies detected in the current window. Spend is stable relative to the baseline.')
                : 'Anomaly day count isn’t exposed yet—use the Spend Over Time chart to spot deviations.',
            },
            {
              title: 'Next action',
              body: 'Open Predictions to see cost forecast drivers and Top Risks, then click Graph nodes to simulate blast radius.',
            },
          ].map((c) => (

            <div key={c.title} className="glass-panel p-4" style={{ background: 'var(--surface)' }}>
              <div className="font-display" style={{ color: 'var(--text-base)', fontSize: 13, fontWeight: 700 }}>{c.title}</div>
              <div className="text-[13px]" style={{ color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Spend + Fleet row */}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">



        {/* Area chart */}
        <GlassPanel className="space-y-3 p-5">
          <h3 className="font-display text-base font-medium" style={{ color: 'var(--text-base)' }}>Spend Over Time</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={platform.charts.costHistory}>
                <defs>
                  <linearGradient id="costFlow" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--data)" stopOpacity={0.30} />
                    <stop offset="100%" stopColor="var(--data)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
                <Area type="monotone" dataKey="cost"    stroke="var(--data)" strokeWidth={1.5} fill="url(#costFlow)" />
                <Area type="monotone" dataKey="anomaly" stroke="#ef4444" strokeWidth={0} fillOpacity={0} activeDot={{ r: 4, fill: '#ef4444' }} />
                <Brush dataKey="date" height={25} stroke="#6b7280" fill="var(--surface-2)" tickFormatter={() => ''} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        {/* Pie chart */}
        <GlassPanel className="space-y-3 p-5">
          <h3 className="font-display text-base font-medium" style={{ color: 'var(--text-base)' }}>Fleet State</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platform.charts.statusBreakdown}
                  dataKey="value" nameKey="name"
                  innerRadius={60} outerRadius={95} paddingAngle={3}
                >
                  {platform.charts.statusBreakdown.map((item, index) => (
                    <Cell key={item.name} fill={STATUS_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      {/* Bar chart */}
      <GlassPanel className="space-y-3 p-5">
        <h3 className="font-display text-base font-medium" style={{ color: 'var(--text-base)' }}>CPU Intensity</h3>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platform.charts.usageBands}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {platform.charts.usageBands.map((item, index) => (
                  <Cell key={item.label} fill={['var(--success)', 'var(--data)', 'var(--warning)', 'var(--danger)'][index]} />
                ))}
              </Bar>
              <Brush dataKey="label" height={25} stroke="#6b7280" fill="var(--surface-2)" tickFormatter={() => ''} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>
    </div>
  );
}
