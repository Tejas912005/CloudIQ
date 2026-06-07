import { useEffect, useMemo, useState, useRef } from 'react';
import { Globe2, RadioTower } from 'lucide-react';
import GlobeGL from 'react-globe.gl';
import { fetchJson } from '../lib/api';
import { LoadingState, ErrorState, EmptyState } from '../components/StatusPanel';
import GlassPanel from '../components/shared/GlassPanel';

// Read semantic colors from the design system CSS variables
const CSS = typeof getComputedStyle !== 'undefined'
  ? getComputedStyle(document.documentElement)
  : null;
const COLOR_DANGER  = CSS ? CSS.getPropertyValue('--danger').trim()  : '#ef4444';
const COLOR_SUCCESS = CSS ? CSS.getPropertyValue('--success').trim() : '#22c55e';

const REGION_COORDS = {
  'us-east-1': { lat: 39.0, lng: -77.5 },
  'us-west-2': { lat: 45.5, lng: -122.7 },
  'eu-west-1': { lat: 53.3, lng: -6.3 },
  'ap-south-1': { lat: 19.0, lng: 72.9 },
  'ap-southeast-1': { lat: 1.3, lng: 103.8 },
  'us-central1': { lat: 41.3, lng: -88.8 },
  eastus: { lat: 38.0, lng: -78.0 },
};

export default function Globe() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const globeRef = useRef();

  useEffect(() => {
    fetchJson('/api/resources')
      .then(setResources)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const regions = useMemo(() => {
    const grouped = new Map();
    resources.forEach((resource) => {
      const key = resource.region || 'unknown';
      const current = grouped.get(key) || { name: key, count: 0, risk: 0, cost: 0 };
      current.count += 1;
      current.risk = Math.max(current.risk, resource.risk_score || 0);
      current.cost += resource.monthly_cost || 0;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((r, index) => {
      const coords = REGION_COORDS[r.name] || { lat: (index % 5) * 15, lng: (index % 10) * 30 - 150 };
      return {
        ...r,
        lat: coords.lat,
        lng: coords.lng,
        size: Math.max(0.1, r.count * 0.05),
        color: r.risk > 10 ? COLOR_DANGER : COLOR_SUCCESS,
      };
    });
  }, [resources]);

  const arcsData = useMemo(() => {
    // Deterministic arcs — same topology every visit (seeded by region pair index)
    if (regions.length < 2) return [];
    const arcs = [];
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        // Deterministic "30% connection chance" using index hash instead of Math.random()
        const deterministicHash = (i * 31 + j * 17) % 10;
        if (deterministicHash > 6) {
          arcs.push({
            startLat: regions[i].lat,
            startLng: regions[i].lng,
            endLat: regions[j].lat,
            endLng: regions[j].lng,
            color: ['rgba(0, 212, 255, 0.2)', 'rgba(168, 85, 247, 0.8)'],
          });
        }
      }
    }
    return arcs;
  }, [regions]);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
      globeRef.current.pointOfView({ altitude: 2.2 });
    }
  }, [loading]);

  if (loading) return <LoadingState message="Plotting global infrastructure..." />;
  if (error) return <ErrorState title="Globe unavailable" message={error} />;
  if (!resources.length) return <EmptyState title="No resources found" message="Start the backend to seed infrastructure data." />;

  return (
    <div className="grid min-h-[calc(100vh-120px)] gap-4 lg:grid-cols-[1fr_320px] animate-fade">
      <div className="relative overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: '#060a14' }}>
        <div className="absolute inset-0">
          <GlobeGL
            ref={globeRef}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            labelsData={regions}
            labelLat="lat"
            labelLng="lng"
            labelText="name"
            labelSize={1.5}
            labelDotRadius="size"
            labelColor="color"
            labelResolution={2}
            arcsData={arcsData}
            arcColor="color"
            arcDashLength={0.4}
            arcDashGap={4}
            arcDashInitialGap={(_arc, index) => (index * 1.618) % 5}
            arcDashAnimateTime={2000}
            backgroundColor="#060a14"
          />
        </div>
        
        <div className="absolute left-6 top-6 z-10 pointer-events-none">
          <div className="flex items-center gap-3">
            <Globe2 className="h-8 w-8" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="font-display text-2xl font-semibold text-white drop-shadow-md">Global Cloud Map</h2>
              <p className="text-sm font-medium drop-shadow-md" style={{ color: 'var(--text-muted)' }}>{resources.length} assets across {regions.length} regions</p>
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold" style={{ color: 'var(--text-base)' }}>
          <RadioTower className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          Regions
        </h3>
        <div className="space-y-3 overflow-y-auto flex-1">
          {regions.map((region) => (
            <GlassPanel key={region.name} className="p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm" style={{ color: 'var(--text-base)' }}>{region.name}</p>
                <span className="text-xs font-bold" style={{ color: region.color }}>{region.count} resources</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full" style={{ background: 'var(--surface)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, region.risk * 8)}%`, background: region.color }} />
              </div>
            </GlassPanel>
          ))}
        </div>
      </aside>
    </div>
  );
}
