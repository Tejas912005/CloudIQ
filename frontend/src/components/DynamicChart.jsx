/**
 * DynamicChart.jsx
 * ----------------
 * Universal Agentic UI: renders any chart type the AI specifies.
 * Supports: pie, bar, line, area, donut (pie with innerRadius)
 *
 * The AI emits a ui_command like:
 * { "action": "render_chart", "chartType": "pie", "title": "...", "data": [...] }
 * This component renders it beautifully inside the chat window.
 */

import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PALETTE = [
  '#6366f1', '#22d3ee', '#f43f5e', '#f59e0b',
  '#10b981', '#a78bfa', '#fb923c', '#34d399',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15,15,20,0.95)',
  border: '1px solid rgba(99,102,241,0.3)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

export default function DynamicChart({ config }) {
  const { chartType = 'bar', title = 'Chart', data = [] } = config;

  const renderChart = () => {
    if (chartType === 'pie' || chartType === 'donut') {
      const innerRadius = chartType === 'donut' ? '55%' : '0%';
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="75%"
            innerRadius={innerRadius}
            paddingAngle={3}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
          />
        </PieChart>
      );
    }

    if (chartType === 'line') {
      const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'name') : [];
      return (
        <LineChart data={data}>
          <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      );
    }

    if (chartType === 'area') {
      const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'name') : [];
      return (
        <AreaChart data={data}>
          <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          {keys.map((k, i) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={PALETTE[i % PALETTE.length]}
              fill={`${PALETTE[i % PALETTE.length]}22`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      );
    }

    // Default: bar chart
    const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'name' && k !== 'label') : ['value'];
    const nameKey = data[0]?.name !== undefined ? 'name' : 'label';
    return (
      <BarChart data={data} barCategoryGap="30%">
        <XAxis dataKey={nameKey} stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    );
  };

  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border animate-fade-in-up"
      style={{
        borderColor: 'rgba(99,102,241,0.2)',
        background: 'var(--surface-2)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: 'rgba(99,102,241,0.15)', background: 'var(--surface)' }}
      >
        <span style={{ color: 'var(--accent)' }}>📊</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
          {title}
        </span>
        <span
          className="ml-auto rounded px-2 py-0.5 text-xs"
          style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)' }}
        >
          AI Generated · {chartType}
        </span>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={260}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
