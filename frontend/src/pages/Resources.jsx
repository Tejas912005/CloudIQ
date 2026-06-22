import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { fetchJson, getErrorMessage } from '../lib/api';
import { formatCurrency } from '../lib/formatters';
import GlassPanel from '../components/shared/GlassPanel';
import AnimatedNumber from '../components/shared/AnimatedNumber';
import { StaggerParent, StaggerChild, FadeUp } from '../components/shared/Motion';
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/StatusPanel';

const STATUS_FILTERS = ['All', 'Idle', 'Healthy', 'Over-Utilized'];

const safeNumber = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const loadResources = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchJson('/api/resources');
      setResources(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load resources.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const filtered = resources.filter((resource) => {
    const matchStatus =
      filter === 'All' || resource.status.toLowerCase() === filter.toLowerCase();
    const normalizedSearch = search.toLowerCase();
    const matchSearch =
      resource.name.toLowerCase().includes(normalizedSearch) ||
      resource.type.toLowerCase().includes(normalizedSearch) ||
      resource.region.toLowerCase().includes(normalizedSearch);

    return matchStatus && matchSearch;
  });

  if (loading) {
    return <LoadingState message="Fetching resource inventory..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Resources unavailable"
        message={`${error} Check that the backend service is running and accessible.`}
        onAction={loadResources}
      />
    );
  }

  if (resources.length === 0) {
    return (
      <EmptyState
        title="No resources found"
        message="Start the backend to seed demo infrastructure data."
      />
    );
  }

  // Derived insight cards (top offenders) to make this page less table-only.
  const overUtilizedResources = filtered.filter((r) => r.status === 'Over-Utilized');
  const highestCpu = [...filtered]
    .sort((a, b) => (safeNumber(b?.cpu_usage) ?? 0) - (safeNumber(a?.cpu_usage) ?? 0))
    .slice(0, 3);
  const lowestEfficiency = [...filtered]
    .sort((a, b) => (safeNumber(a?.efficiency_score) ?? 0) - (safeNumber(b?.efficiency_score) ?? 0))
    .slice(0, 3);

  const topSpend = [...filtered]
    .sort((a, b) => (safeNumber(b?.monthly_cost) ?? 0) - (safeNumber(a?.monthly_cost) ?? 0))
    .slice(0, 3);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      {/* Page header */}
      <FadeUp>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-base)', fontFamily: 'Space Grotesk, sans-serif' }}>
            Cloud Resources
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Monitor all {resources.length} simulated cloud instances and identify
            idle or over-utilized resources
          </p>
        </div>
      </FadeUp>

      {/* 4 stat cards */}
      <StaggerParent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Resources', count: resources.length, color: 'var(--data)', accent: 'var(--data)' },
          { label: 'Idle Resources', count: resources.filter(r => r.status === 'Idle').length, color: 'var(--warning)', accent: 'var(--warning)' },
          { label: 'Healthy Resources', count: resources.filter(r => r.status === 'Healthy').length, color: 'var(--success)', accent: 'var(--success)' },
          { label: 'Over-Utilized', count: resources.filter(r => r.status === 'Over-Utilized').length, color: 'var(--danger)', accent: 'var(--danger)' },
        ].map((stat) => (
          <StaggerChild key={stat.label}>
            <GlassPanel className="card-lift p-5" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: stat.accent, borderRadius: '0 0 14px 14px' }} />
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 12 }}>
                {stat.label}
              </p>
              <p style={{ fontSize: 32, fontWeight: 700, color: stat.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                <AnimatedNumber value={stat.count} />
              </p>
            </GlassPanel>
          </StaggerChild>
        ))}
      </StaggerParent>

      {/* Filter row + search â€” horizontal flex, gap 12px */}
      <FadeUp delay={0.12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Status filter pills â€” gap: 8px between each button */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${filter === status ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: filter === status ? 'var(--accent-soft)' : 'var(--surface)',
                  color: filter === status ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 150ms ease',
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 30,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-base)',
                fontSize: 13,
                outline: 'none',
                minWidth: 200,
              }}
            />
          </div>
        </div>
      </FadeUp>

      {/* Table */}
      <FadeUp delay={0.18}>
        <GlassPanel className="overflow-hidden" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-base)' }}>
              Resources ({filtered.length})
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {['Name', 'Type', 'Region', 'CPU %', 'Memory %', 'Uptime (h)', 'Hourly Cost', 'Monthly Cost', 'Efficiency', 'Status'].map((col) => (
                    <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((resource, idx) => (
                  <tr
                    key={resource.id || idx}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 100ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {resource.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {resource.type || resource.resource_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {resource.region}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: (resource.cpu_usage || 0) > 80 ? 'var(--danger)' : (resource.cpu_usage || 0) > 50 ? 'var(--warning)' : 'var(--text-base)' }}>
                      {(resource.cpu_usage || 0).toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: (resource.memory_usage || 0) > 85 ? 'var(--danger)' : 'var(--text-base)' }}>
                      {(resource.memory_usage || 0).toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {resource.uptime_hours || 0}h
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ${(resource.hourly_cost || 0).toFixed(4)}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-base)', fontFamily: 'var(--font-mono)' }}>
                      ${(resource.monthly_cost || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {(resource.efficiency_score || 0).toFixed(1)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: resource.status === 'Healthy' ? 'rgba(52,211,153,0.10)' : resource.status === 'Idle' ? 'rgba(251,191,36,0.10)' : 'rgba(248,113,113,0.10)',
                        color: resource.status === 'Healthy' ? 'var(--success)' : resource.status === 'Idle' ? 'var(--warning)' : 'var(--danger)',
                        border: `1px solid ${resource.status === 'Healthy' ? 'rgba(52,211,153,0.25)' : resource.status === 'Idle' ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`,
                      }}>
                        {resource.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </FadeUp>
    </div>
  );
}
