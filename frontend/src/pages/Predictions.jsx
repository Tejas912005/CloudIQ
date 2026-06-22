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
import GlassPanel from '../components/shared/GlassPanel';
import AnimatedNumber from '../components/shared/AnimatedNumber';
import { StaggerParent, StaggerChild, FadeUp } from '../components/shared/Motion';
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
          background: 'var(--bg-tooltip)',
          border: '1px solid rgba(99, 178, 255, 0.2)',
          borderRadius: '8px',
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
    return <LoadingState message="Running cost forecast..." />;
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

  const sortedRisks = [...(resource_risks || [])].sort(
    (a, b) => (b.risk_score || 0) - (a.risk_score || 0)
  );
  const topRisks = sortedRisks.slice(0, 3);

  const interpretation = (() => {
    const trend = cost_predictions?.trend_direction;
    if (trend === 'increasing')
      return 'Costs are trending upward; the forecast indicates elevated spend into the next window.';
    if (trend === 'decreasing')
      return 'Costs are trending downward; forecast expects lower spend if current conditions persist.';
    return 'Costs appear stable; forecast suggests limited movement with ongoing risk variance.';
  })();

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      {/* Page header */}
      <FadeUp>
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-base)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            AI Predictions
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              marginTop: 4,
            }}
          >
            30-day cost forecast using linear regression and resource failure risk scoring
          </p>
        </div>
      </FadeUp>

      {/* 4 metric cards in a row */}
      <StaggerParent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: '30-Day Forecast',
            rawValue: cost_predictions.monthly_forecast || 0,
            display: formatCurrency(cost_predictions.monthly_forecast || 0, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }),

            accentColor: 'var(--data)',
            isCurrency: true,
          },
          {
            label: 'Cost Trend',
            display: formatTrendLabel(cost_predictions.trend_direction),
            accentColor:
              cost_predictions.trend_direction === 'increasing'
                ? 'var(--danger)'
                : 'var(--success)',
            isCurrency: false,
          },
          {
            label: 'Daily Slope',
            display: `${formatCurrency(cost_predictions.trend_slope || 0)}/day`,
            accentColor: 'var(--warning)',
            isCurrency: false,
          },
          {
            label: 'At-Risk Resources',
            rawValue: resource_risks?.length || 0,
            display: String(resource_risks?.length || 0),
            accentColor: 'var(--danger)',
            isCurrency: false,
          },
        ].map((stat) => (
          <StaggerChild key={stat.label}>
            <GlassPanel
              className="card-lift p-5"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {/* Colored accent line at bottom */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: stat.accentColor,
                  borderRadius: '0 0 14px 14px',
                }}
              />
              <p
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--text-dim)',
                  marginBottom: 12,
                }}
              >
                {stat.label}
              </p>
              {stat.isCurrency && stat.rawValue !== undefined ? (
                <p
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: stat.accentColor,
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  $<AnimatedNumber value={stat.rawValue} />
                </p>
              ) : (
                <p
                  style={{
                    fontSize: stat.display.length > 8 ? 20 : 28,
                    fontWeight: 700,
                    color: stat.accentColor,
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  {stat.display}
                </p>
              )}
            </GlassPanel>
          </StaggerChild>
        ))}
      </StaggerParent>

      {/* Historical chart */}
      <FadeUp delay={0.15}>
        <GlassPanel className="p-5">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-base)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
              90-Day History + 30-Day Forecast
            </h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
              <span style={{ color: '#3b82f6' }}>â— Actual</span>
              <span style={{ color: '#8b5cf6' }}>â— Fitted</span>
              <span style={{ color: 'var(--success)' }}>â— Forecast</span>
            </div>
          </div>

          <p
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              marginBottom: 8,
            }}
          >
            Historical Data (sampled)
          </p>
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

          <p
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              marginTop: 20,
              marginBottom: 8,
            }}
          >
            30-Day Forecast
          </p>
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
        </GlassPanel>
      </FadeUp>

      {/* Resource risk table */}
      <FadeUp delay={0.22}>
        <GlassPanel className="p-5">
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-base)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={15} style={{ color: 'var(--warning)' }} />
            Resource Failure Risk Assessment
          </h3>

          {resource_risks?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resource_risks.map((risk, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 110px',
                    gap: 16,
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Name */}
                  <div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-base)',
                      }}
                    >
                      {risk.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{risk.type}</p>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: 'var(--surface-2)',
                        overflow: 'hidden',
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(risk.risk_score, 100)}%`,
                          borderRadius: 3,
                          background:
                            risk.risk_level === 'High'
                              ? 'var(--danger)'
                              : risk.risk_level === 'Medium'
                                ? 'var(--warning)'
                                : 'var(--success)',
                          transition: 'width 600ms ease-out',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {risk.reasons?.join(', ')}
                    </p>
                  </div>

                  {/* Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          risk.risk_level === 'High'
                            ? 'rgba(248,113,113,0.12)'
                            : risk.risk_level === 'Medium'
                              ? 'rgba(251,191,36,0.12)'
                              : 'rgba(52,211,153,0.12)',
                        color:
                          risk.risk_level === 'High'
                            ? 'var(--danger)'
                            : risk.risk_level === 'Medium'
                              ? 'var(--warning)'
                              : 'var(--success)',
                        border: `1px solid ${
                          risk.risk_level === 'High'
                            ? 'rgba(248,113,113,0.25)'
                            : risk.risk_level === 'Medium'
                              ? 'rgba(251,191,36,0.25)'
                              : 'rgba(52,211,153,0.25)'
                        }`,
                      }}
                    >
                      {risk.risk_level} ({risk.risk_score})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No high-risk resources detected.</p>
          )}
        </GlassPanel>
      </FadeUp>
    </div>
  );
}
