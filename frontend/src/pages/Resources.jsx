import { useState, useEffect } from 'react';
import { Server, Search } from 'lucide-react';
import { fetchJson, getErrorMessage } from '../lib/api';
import { formatCurrency } from '../lib/formatters';
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/StatusPanel';

const STATUS_FILTERS = ['All', 'Idle', 'Healthy', 'Over-Utilized'];

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
    return <LoadingState message="Loading resources..." />;
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

  return (
    <div>
      <div className="page-header fade-in">
        <h1>Cloud Resources</h1>
        <p>
          Monitor all {resources.length} simulated cloud instances and identify
          idle or over-utilized resources
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total', count: resources.length, color: '#3b82f6' },
          {
            label: 'Idle',
            count: resources.filter((resource) => resource.status === 'Idle').length,
            color: '#ef4444',
          },
          {
            label: 'Healthy',
            count: resources.filter((resource) => resource.status === 'Healthy').length,
            color: '#10b981',
          },
          {
            label: 'Over-Utilized',
            count: resources.filter((resource) => resource.status === 'Over-Utilized').length,
            color: '#f59e0b',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="stat-card fade-in"
            style={{ paddingTop: 18, paddingBottom: 18 }}
          >
            <div
              className="card-value"
              style={{ color: stat.color, fontSize: 24 }}
            >
              {stat.count}
            </div>
            <div className="card-label">{stat.label} Resources</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              className={`chip${filter === status ? ' active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search resources..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-base)',
              fontSize: 13,
              width: 180,
            }}
          />
        </div>
      </div>

      <div className="glass-card fade-in">
        <div className="card-title">
          <Server size={16} /> Resources ({filtered.length})
        </div>
        {filtered.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>CPU %</th>
                  <th>Memory %</th>
                  <th>Uptime (h)</th>
                  <th>Hourly Cost</th>
                  <th>Monthly Cost</th>
                  <th>Efficiency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((resource) => (
                  <tr key={resource.id}>
                    <td
                      style={{
                        fontFamily: 'monospace',
                        color: '#60a5fa',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {resource.name}
                    </td>
                    <td>
                      <span className="badge badge-low" style={{ fontSize: 10 }}>
                        {resource.type}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{resource.region}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${resource.cpu_usage}%`,
                              background:
                                resource.cpu_usage > 85
                                  ? '#ef4444'
                                  : resource.cpu_usage < 10
                                    ? '#f59e0b'
                                    : '#3b82f6',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color:
                              resource.cpu_usage > 85
                                ? '#f87171'
                                : resource.cpu_usage < 10
                                  ? '#fbbf24'
                                  : '#94a3b8',
                          }}
                        >
                          {resource.cpu_usage}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${resource.memory_usage}%`,
                              background:
                                resource.memory_usage > 90 ? '#ef4444' : '#8b5cf6',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: resource.memory_usage > 90 ? '#f87171' : '#94a3b8',
                          }}
                        >
                          {resource.memory_usage}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {resource.uptime_hours.toFixed(0)}h
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>
                      ${resource.hourly_cost.toFixed(4)}
                    </td>
                    <td style={{ fontWeight: 700, color: '#f0f6ff' }}>
                      {formatCurrency(resource.monthly_cost)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-bar" style={{ width: 50 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${resource.efficiency_score}%`,
                              background:
                                resource.efficiency_score > 60
                                  ? '#10b981'
                                  : resource.efficiency_score > 30
                                    ? '#f59e0b'
                                    : '#ef4444',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {resource.efficiency_score}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          resource.status === 'Idle'
                            ? 'idle'
                            : resource.status === 'Healthy'
                              ? 'healthy'
                              : 'over'
                        }`}
                      >
                        {resource.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No matching resources"
            message="Adjust the status filter or search term to see more resources."
          />
        )}
      </div>
    </div>
  );
}
