import {
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  Globe2,
  LayoutDashboard,
  Network,
  ScanSearch,
  Table2,
  TrendingUp,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCloudIQ } from '../../hooks/useCloudIQ';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/assistant', icon: Bot, key: 'assistant' },
  { to: '/insights', icon: ChartNoAxesCombined, key: 'insights' },
  { to: '/actions', icon: BrainCircuit, key: 'actions' },
  { to: '/graph', icon: Network, key: 'graph' },
  { to: '/globe', icon: Globe2, key: 'globe' },
  { to: '/resources', icon: Table2, key: 'resources' },
  { to: '/predictions', icon: TrendingUp, key: 'predictions' },
  { to: '/activity', icon: ScanSearch, key: 'activity' },
];

export default function SidebarNav() {
  const { copy } = useCloudIQ();

  return (
    <>
      <aside
        className="hidden w-[260px] shrink-0 border-r px-5 py-6 lg:flex lg:flex-col"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-mid)' }}
      >
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
          >
            <BrainCircuit className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="font-display text-lg font-semibold tracking-wide" style={{ color: 'var(--text-base)' }}>
            CloudIQ
          </p>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg border-y border-r transition-all duration-300 ${
                    isActive
                      ? 'border-transparent text-[var(--text-base)]'
                      : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-base)]'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'var(--accent-soft)',
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: 'calc(12px - 2px)',
                  paddingTop: '10px',
                  paddingBottom: '10px',
                  paddingRight: '12px'
                } : { 
                  background: 'transparent',
                  borderLeft: '2px solid transparent',
                  padding: '10px 12px'
                }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-105"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">{copy[item.key]}</p>
              </NavLink>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div
          className="mt-auto rounded-lg border p-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>System online</p>
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-1 rounded-2xl border p-1.5 backdrop-blur-xl lg:hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--header-bg)' }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] transition ${
                  isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-base)]'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'var(--accent-soft)' } : {}}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{copy[item.key]}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
