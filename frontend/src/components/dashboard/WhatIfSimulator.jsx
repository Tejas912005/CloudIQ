import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useCloudIQ } from '../../hooks/useCloudIQ';
import AnimatedNumber from '../shared/AnimatedNumber';

export default function WhatIfSimulator() {
  const { platform } = useCloudIQ();
  const [idleToStop, setIdleToStop] = useState(0);
  const navigate = useNavigate();

  if (!platform) return null;

  const idleCount = platform.rawSummary?.idle_count || 0;
  const totalCost = platform.rawSummary?.total_monthly_cost || 0;
  const avgIdleCost = idleCount > 0 ? (totalCost * 0.15) / idleCount : 0;
  const projectedSavings = Math.round(idleToStop * avgIdleCost);
  const projectedTotal = Math.max(0, totalCost - projectedSavings);

  const handleExecute = () => {
    navigate('/assistant');
  };

  return (
    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', background: 'var(--accent-soft)', borderRadius: '6px' }}>
            <Play size={14} color="var(--accent)" />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-base)' }}>
            What-If Simulator
          </p>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600,
                       background: 'var(--surface-2)', border: '1px solid var(--border)',
                       borderRadius: '20px', padding: '4px 12px' }}>
          {idleToStop} / {idleCount} idle stopped
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={idleCount}
        step={1}
        value={idleToStop}
        onChange={e => setIdleToStop(Number(e.target.value))}
        style={{ 
          width: '100%', 
          accentColor: 'var(--accent)', 
          marginBottom: '20px',
          cursor: 'pointer'
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '14px', background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: '10px' }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: '4px' }}>
            Projected Spend
          </p>
          <p style={{ fontSize: '20px', fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 700, color: 'var(--text-base)' }}>
            $<AnimatedNumber value={projectedTotal} />
          </p>
        </div>
        <div style={{ padding: '14px',
                      background: projectedSavings > 0 ? 'rgba(16,217,138,0.08)' : 'var(--surface)',
                      border: `1px solid ${projectedSavings > 0 ? 'rgba(16,217,138,0.2)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      transition: 'all 0.3s ease' }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: '4px' }}>
            You Save
          </p>
          <p style={{ fontSize: '20px', fontFamily: 'Space Grotesk, sans-serif',
                      fontWeight: 700, color: projectedSavings > 0 ? 'var(--success)' : 'var(--text-dim)',
                      transition: 'color 0.3s ease' }}>
            +$<AnimatedNumber value={projectedSavings} />
          </p>
        </div>
      </div>

      <button 
        onClick={handleExecute}
        disabled={idleToStop === 0}
        className="card-lift"
        style={{ 
          width: '100%', 
          padding: '12px', 
          borderRadius: '8px', 
          background: idleToStop > 0 ? 'var(--accent)' : 'var(--surface-2)',
          color: idleToStop > 0 ? '#fff' : 'var(--text-dim)',
          fontWeight: 600,
          border: 'none',
          cursor: idleToStop > 0 ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          opacity: idleToStop > 0 ? 1 : 0.6
        }}
      >
        Ask Agent to Execute
      </button>
    </div>
  );
}
