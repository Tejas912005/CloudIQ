import { lazy, Suspense } from 'react';
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

const LogoIcon3D = lazy(() => import('../shared/LogoIcon3D'));

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
        className="hidden w-[240px] shrink-0 border-r lg:flex lg:flex-col"
        style={{
          borderColor: 'var(--border)',
          background: 'linear-gradient(180deg, var(--bg-mid) 0%, var(--bg-base) 100%)',
        }}
      >
        <div
          className="flex h-16 items-center gap-3 border-b px-5"
          style={{ borderColor: 'var(--border)' }}
        >
          <Suspense fallback={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-deep))',
                boxShadow: '0 0 20px var(--accent-glow)',
                flexShrink: 0,
              }}
            />
          }
          >
            <LogoIcon3D size={36} />
          </Suspense>
          <p className="font-display text-lg font-bold" style={{ color: 'var(--text-muted)' }}>
            Cloud<span style={{ color: 'var(--accent)' }}>IQ</span>
          </p>
        </div>

        <nav className="flex-1 px-2.5 py-3">
          <p
            className="px-2.5 pb-2 pt-4 text-[9px] font-bold uppercase"
            style={{ color: 'var(--text-dim)', letterSpacing: '0.12em' }}
          >
            Navigation
          </p>

          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'group flex h-[42px] items-center gap-2.5 rounded-[10px] border px-2.5 text-[13px] font-medium transition-all duration-200',
                      isActive
                        ? 'text-[var(--text-base)]'
                        : 'border-transparent text-[var(--text-dim)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text-muted)]',
                    ].join(' ')
                  }
                  style={({ isActive }) => (
                    isActive
                      ? {
                          background: 'var(--accent-soft)',
                          borderColor: 'var(--accent-border)',
                          boxShadow: '0 0 12px var(--accent-glow)',
                        }
                      : {}
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className="h-4 w-4 shrink-0 transition-all duration-200"
                        style={isActive ? {
                          color: 'var(--accent)',
                          filter: 'drop-shadow(0 0 6px var(--accent-glow))',
                        } : {}}
                      />
                      <span className="truncate">{copy[item.key]}</span>
                      {isActive && (
                        <span
                          className="ml-auto h-[5px] w-[5px] rounded-full"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="border-t px-2.5 pb-5 pt-3" style={{ borderColor: 'var(--border)' }}>
          <div
            className="flex items-center gap-2 rounded-[10px] px-2.5 py-2"
            style={{ background: 'var(--surface)' }}
          >
            <span className="pulse-dot" style={{ width: '6px', height: '6px', background: 'var(--success)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>System Online</span>
            <span
              className="ml-auto rounded-full border px-1.5 py-px text-[9px] font-bold"
              style={{
                color: 'var(--success)',
                background: 'var(--success-soft)',
                borderColor: 'var(--success-border)',
              }}
            >
              LIVE
            </span>
          </div>
        </div>
      </aside>

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
                [
                  'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] transition',
                  isActive
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-base)]',
                ].join(' ')
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
