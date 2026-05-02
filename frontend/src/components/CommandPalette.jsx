import { useEffect, useMemo, useState } from 'react';
import { Bot, Gauge, Globe2, LayoutDashboard, Network, RefreshCw, Search, Table2, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { useCloudIQ } from '../hooks/useCloudIQ';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Assistant', path: '/assistant', icon: Bot },
  { label: 'Insights', path: '/insights', icon: Gauge },
  { label: 'Recommendations', path: '/actions', icon: TrendingUp },
  { label: 'Graph', path: '/graph', icon: Network },
  { label: 'Globe', path: '/globe', icon: Globe2 },
  { label: 'Resources', path: '/resources', icon: Table2 },
  { label: 'Predictions', path: '/predictions', icon: TrendingUp },
];

function riskColor(resource) {
  if ((resource.risk_score || 0) > 10) return 'var(--danger)';
  if ((resource.risk_score || 0) > 5) return 'var(--warning)';
  return 'var(--success)';
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { platform, refreshData, toggleTheme } = useCloudIQ();

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const items = useMemo(() => {
    const resources = platform?.charts ? [] : [];
    const resourceItems = (platform?.resources || resources).map((resource) => ({
      label: resource.name,
      detail: `${resource.type || resource.resource_type} · ${resource.region}`,
      action: () => navigate(`/graph?focus=${resource.id}`),
      color: riskColor(resource),
    }));

    return [
      ...NAV_ITEMS.map((item) => ({
        ...item,
        detail: item.path,
        action: () => navigate(item.path),
      })),
      ...resourceItems,
      { label: 'Refresh data', detail: 'Sync latest telemetry', icon: RefreshCw, action: refreshData },
      { label: 'Toggle theme', detail: 'Switch light or dark mode', action: toggleTheme },
      { label: 'Clear chat history', detail: 'Reset local assistant thread', action: () => window.localStorage.removeItem('cloudiq-assistant-thread') },
    ];
  }, [platform, navigate, refreshData, toggleTheme]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24" onMouseDown={() => setOpen(false)}>
      <Command
        className="w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl bg-surface"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onMouseDown={(event) => event.stopPropagation()}
        loop
      >
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <Search className="h-4 w-4" style={{ color: 'var(--text-dim)' }} />
          <Command.Input
            autoFocus
            placeholder="Search commands, screens, resources..."
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-base)' }}
          />
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No results found.</Command.Empty>
          
          <Command.Group heading="Actions & Pages" className="px-2 py-1 text-xs text-gray-400 font-semibold uppercase tracking-wider mt-2 mb-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Command.Item
                  key={`${item.label}-${item.detail}`}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition cursor-pointer ui-selected:bg-white/10 hover:bg-white/5"
                  style={{ color: 'var(--text-base)' }}
                  onSelect={() => {
                    item.action();
                    setOpen(false);
                  }}
                  value={`${item.label} ${item.detail}`}
                >
                  {Icon ? <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />}
                  <span className="flex-1">
                    <span className="block font-medium">{item.label}</span>
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{item.detail}</span>
                  </span>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
