import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchJson } from '../lib/api';

// ─── Color mapping by risk level — resolved from CSS variables at runtime ─────
function getRiskColors() {
  const s = typeof getComputedStyle !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null;
  const danger  = s?.getPropertyValue('--danger').trim()  ?? '#ef4444';
  const warning = s?.getPropertyValue('--warning').trim() ?? '#f59e0b';
  const success = s?.getPropertyValue('--success').trim() ?? '#22c55e';
  return {
    High:   { bg: danger,   border: danger,   text: '#fff', glow: `${danger}80`  },
    Medium: { bg: warning,  border: warning,  text: '#000', glow: `${warning}66` },
    Low:    { bg: success,  border: success,  text: '#fff', glow: `${success}66` },
  };
}
const RISK_COLORS = getRiskColors();

export default function GraphView() {
  const [graphData, setGraphData]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [blastRadius, setBlastRadius] = useState(null);
  const [blastLoading, setBlastLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const containerRef = useRef(null);
  const fgRef = useRef();

  // ── Fetch graph data ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJson('/api/graph')
      .then(data => {
        setGraphData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(550, window.innerHeight - 280),
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [graphData]);

  // ── Handle node click: fetch blast radius ────────────────────────────────────
  const handleNodeClick = useCallback(async (node) => {
    if (selected?.id === node.id) {
      setSelected(null);
      setBlastRadius(null);
      return;
    }
    
    // Center view on node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(1.5, 1000);
    }
    
    setSelected(node);
    setBlastRadius(null);
    setBlastLoading(true);
    try {
      const data = await fetchJson(`/api/graph/blast-radius?resource_id=${node.id}`);
      setBlastRadius(data);
    } catch {
      setBlastRadius(null);
    }
    setBlastLoading(false);
  }, [selected]);

  const isAffected = useCallback((nodeId) =>
    blastRadius?.affected_nodes?.some(n => n.id === nodeId), [blastRadius]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const r = Math.sqrt((node.val || 1)) * 5 + 4;
    const colors = RISK_COLORS[node.risk_level] || RISK_COLORS.Low;

    // Glow for high-risk nodes
    if (node.risk_level === 'High') {
      ctx.shadowColor = colors.bg;
      ctx.shadowBlur = 16;
    }

    // Draw circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = colors.bg;
    ctx.fill();

    // Border ring
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Node name label below circle
    const fontSize = Math.max(9, 11 / globalScale);
    ctx.font = `500 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(241,245,249,0.85)';
    const label =
      node.name?.length > 14 ? node.name.slice(0, 13) + '…' : node.name || '';
    ctx.fillText(label, node.x, node.y + r + 3);
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-current border-t-transparent" />
          <p className="text-sm">Building resource dependency graph…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--danger)' }}>
        <p>❌ Failed to load graph: {error}</p>
      </div>
    );
  }

  const { nodes = [], edges = [], stats = {} } = graphData || {};

  return (
    <div className="mx-auto max-w-[1600px] animate-fade space-y-4">
      {/* ── Header ── */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h1 className="font-display text-xl font-bold mb-1" style={{ color: 'var(--text-base)' }}>
          🕸️ Cloud Resource Dependency Graph
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Click any node to simulate its blast radius. Nodes are colored by risk level.
        </p>

        {/* Stats bar */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total Nodes',   value: stats.total_nodes ?? nodes.length },
            { label: 'Total Edges',   value: stats.total_edges ?? edges.length },
            { label: 'High Risk',     value: stats.high_risk_nodes ?? 0, color: '#ef4444' },
            { label: 'Avg Risk',      value: stats.avg_risk_score?.toFixed(1) ?? '—' },
            { label: 'Density',       value: stats.density?.toFixed(4) ?? '—' },
            { label: 'Components',    value: stats.connected_components ?? '—' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl border p-3 text-center"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <p className="text-lg font-bold" style={{ color: s.color || 'var(--accent)' }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4">
          {Object.entries(RISK_COLORS).map(([level, c]) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: c.bg }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{level} Risk</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full animate-pulse" style={{ background: '#a855f7' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Blast Radius</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* ── Graph Canvas ── */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden rounded-2xl border cursor-move"
          style={{
            background: '#060a14',
            borderColor: 'var(--border)',
            minHeight: '560px',
          }}
        >
          {dimensions.width > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={{ nodes: nodes, links: edges }}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI, false);
                ctx.fill();
              }}
              onNodeClick={handleNodeClick}
              linkColor={(link) => {
                const isActive = selected?.id === link.source.id || selected?.id === link.target.id || selected?.id === link.source || selected?.id === link.target;
                return isActive ? 'rgba(168,85,247,0.7)' : 'rgba(148,163,184,0.15)';
              }}
              linkWidth={(link) => {
                const isActive = selected?.id === link.source.id || selected?.id === link.target.id || selected?.id === link.source || selected?.id === link.target;
                return isActive ? 2 : 1;
              }}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
            />
          )}
        </div>

        {/* ── Detail Panel ── */}
        <div
          className="w-72 shrink-0 rounded-2xl border p-4 space-y-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {!selected ? (
            <div className="flex h-full items-center justify-center text-center px-4">
              <div>
                <div className="mx-auto mb-3 text-4xl">👆</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                  Click any node to inspect it
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Shows resource details and cascading failure blast radius
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>
                      {selected.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selected.resource_uid} · {selected.provider}
                    </p>
                  </div>
                </div>

                {/* Risk badge */}
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{
                    background: RISK_COLORS[selected.risk_level]?.bg,
                    color: RISK_COLORS[selected.risk_level]?.text,
                  }}
                >
                  {selected.risk_level} Risk — Score {selected.risk_score?.toFixed(1)}
                </span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'CPU', value: `${selected.cpu_usage?.toFixed(0)}%` },
                  { label: 'Memory', value: `${selected.memory_usage?.toFixed(0)}%` },
                  { label: 'Latency', value: `${selected.latency_ms?.toFixed(0)}ms` },
                  { label: 'Error Rate', value: `${selected.error_rate?.toFixed(1)}%` },
                  { label: 'Monthly Cost', value: `$${selected.monthly_cost?.toFixed(0)}` },
                  { label: 'Status', value: selected.status },
                  { label: 'Sensitivity', value: selected.sensitivity },
                  { label: 'Public', value: selected.public_access ? '⚠️ Yes' : '✅ No' },
                ].map(m => (
                  <div
                    key={m.label}
                    className="rounded-lg border p-2"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                  >
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Blast Radius */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-base)' }}>
                  💥 Blast Radius
                </p>
                {blastLoading && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Computing…</p>
                )}
                {blastRadius && !blastLoading && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold" style={{ color: '#a855f7' }}>
                      {blastRadius.count} resource{blastRadius.count !== 1 ? 's' : ''} affected
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Total cascading risk: {blastRadius.total_cascading_risk?.toFixed(1)}
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {blastRadius.affected_nodes?.map(n => (
                        <div
                          key={n.id}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}
                        >
                          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            {/* icon removed */}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-base)' }}>{n.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {blastRadius && blastRadius.count === 0 && (
                  <p className="text-xs" style={{ color: '#22c55e' }}>
                    ✅ No downstream impact — blast radius contained.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
