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

const STATUS_COLORS = ['#c9a84c', '#6b7280', '#9ca3af'];

const TOOLTIP_STYLE = {
  background: 'rgba(18,18,18,0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#e5e5e5',
};

export default function Insights() {
  const { platform, loading, error, refreshData } = useCloudIQ();

  if (loading && !platform) return <LoadingState message="Loading analytics…" />;
  if (error   && !platform) return <ErrorState title="Unavailable" message={error} onAction={refreshData} />;
  if (!platform)            return <EmptyState  title="No insights" message="Waiting for telemetry." />;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 animate-fade">

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
                    <stop offset="0%"   stopColor="#c9a84c" stopOpacity={0.30} />
                    <stop offset="100%" stopColor="#c9a84c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
                <Area type="monotone" dataKey="cost"    stroke="#c9a84c" strokeWidth={1.5} fill="url(#costFlow)" />
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
                  <Cell key={item.label} fill={['#c9a84c', '#9ca3af', '#6b7280', '#ef4444'][index]} />
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
