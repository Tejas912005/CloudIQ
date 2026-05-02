import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fetchJson, getErrorMessage } from '../lib/api';
import { formatCurrency, formatTrendLabel } from '../lib/formatters';
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/StatusPanel';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const point = payload[0]?.payload;

    return (
      <div
        style={{
          background: '#0a1628',
          border: '1px solid rgba(99,178,255,0.2)',
          borderRadius: 8,
          padding: '10px 14px',
        }}
      >
        <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
          {point?.date}
        </p>
        {payload.map(
          (entry, index) =>
            entry.value !== undefined &&
            entry.value !== null && (
              <p
                key={index}
                style={{ color: entry.color, fontSize: 13, fontWeight: 600 }}
              >
                {entry.name}: {formatCurrency(entry.value)}
              </p>
            )
        )}
      </div>
    );
  }

  return null;
};

export default function Predictions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPredictions = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchJson('/api/predictions');
      setData(response);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load predictions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, []);

  if (loading) {
    return <LoadingState message="Loading predictions..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Predictions unavailable"
        message={`${error} Check that the backend is running on http://localhost:5000.`}
        onAction={loadPredictions}
      />
    );
  }

  if (!data?.historical && !data?.cost_predictions) {
    return (
      <EmptyState
        title="No prediction data"
        message="Prediction charts will appear here after the backend seeds the demo data."
      />
    );
  }

  const cost_predictions = data.cost_predictions || data;
  const resource_risks = data.resource_risks || [];

  const historicalChart = (cost_predictions.historical || [])
    .filter((_, index) => index % 3 === 0)
    .map((point) => ({
      date: point.date.slice(5),
      fullDate: point.date,
      actual: point.actual,
      fitted: point.fitted,
    }));

  const forecastChart = (cost_predictions.forecast || []).map((point) => ({
    date: point.date.slice(5),
    fullDate: point.date,
    predicted: point.predicted,
  }));

  return (
    <div>
      <div className="page-header fade-in">
        <h1>AI Predictions</h1>
        <p>30-day cost forecast using linear regression and resource failure risk scoring</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          {
            label: '30-Day Forecast',
            value: formatCurrency(cost_predictions.monthly_forecast, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }),
            color: '#3b82f6',
          },
          {
            label: 'Cost Trend',
            value: formatTrendLabel(cost_predictions.trend_direction),
            color:
              cost_predictions.trend_direction === 'increasing'
                ? '#ef4444'
                : '#10b981',
          },
          {
            label: 'Daily Slope',
            value: `${formatCurrency(cost_predictions.trend_slope)}/day`,
            color: '#f59e0b',
          },
          {
            label: 'At-Risk Resources',
            value: resource_risks?.length || 0,
            color: '#ef4444',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="stat-card fade-in"
            style={{ paddingTop: 18, paddingBottom: 18 }}
          >
            <div
              className="card-value"
              style={{
                color: stat.color,
                fontSize: stat.value.toString().length > 8 ? 20 : 26,
              }}
            >
              {stat.value}
            </div>
            <div className="card-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card fade-in" style={{ marginBottom: 16 }}>
        <div className="card-title">
          <TrendingUp size={16} /> 90-Day History + 30-Day Forecast
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', fontWeight: 400 }}>
            <span style={{ color: '#3b82f6', marginRight: 12 }}>Actual</span>
            <span style={{ color: '#8b5cf6', marginRight: 12 }}>Fitted</span>
            <span style={{ color: '#10b981' }}>Forecast</span>
          </span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#64748b', fontSize: 12 }}>Historical Data (sampled)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historicalChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,178,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#475569', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={9}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                name="Actual"
              />
              <Line
                type="monotone"
                dataKey="fitted"
                stroke="#8b5cf6"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                name="Fitted"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p style={{ color: '#64748b', fontSize: 12 }}>30-Day Forecast</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={forecastChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,178,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#475569', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: '#10b981' }}
                name="Forecast"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card fade-in">
        <div className="card-title">
          <AlertCircle size={16} style={{ color: '#f59e0b' }} /> Resource Failure
          Risk Assessment
        </div>
        {resource_risks?.length > 0 ? (
          <div className="risk-list">
            {resource_risks.map((risk, index) => (
              <div key={index} className="risk-item">
                <div style={{ minWidth: 160 }}>
                  <div className="risk-name">{risk.name}</div>
                  <div className="risk-type">{risk.type}</div>
                </div>
                <div className="risk-score-bar">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${risk.risk_score}%`,
                        background:
                          risk.risk_level === 'High'
                            ? '#ef4444'
                            : risk.risk_level === 'Medium'
                              ? '#f59e0b'
                              : '#10b981',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {risk.reasons.join(', ')}
                  </div>
                </div>
                <div style={{ minWidth: 100, textAlign: 'right' }}>
                  <span className={`badge badge-${risk.risk_level.toLowerCase()}`}>
                    {risk.risk_level} Risk ({risk.risk_score})
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: 13 }}>
            No high-risk resources detected.
          </p>
        )}
      </div>
    </div>
  );
}
