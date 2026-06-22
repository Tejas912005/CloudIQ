import { LogIn, LogOut, Moon, RefreshCcw, Server, Sun, TrendingUp, User } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useCloudIQ } from '../../hooks/useCloudIQ';
import { useCloudStore } from '../../store/useCloudStore';
import { formatRelativeMinutes, formatCurrency } from '../../lib/formatters';
import AuthModal from '../auth/AuthModal';

const TITLES = {
  '/': 'Dashboard',
  '/assistant': 'Assistant',
  '/insights': 'Insights',
  '/actions': 'Actions',
  '/graph': 'Graph',
  '/globe': 'Globe',
  '/resources': 'Resources',
  '/predictions': 'Predictions',
  '/activity': 'Activity',
};

export default function TopHeader() {
  const location = useLocation();
  const { lastUpdated, platform, loading, theme, toggleTheme } = useCloudIQ();
  const user = useCloudStore(state => state.user);
  const signOut = useCloudStore(state => state.signOut);
  const [showAuth, setShowAuth] = useState(false);
  const title = TITLES[location.pathname] || 'Dashboard';

  const totalResources = platform?.rawSummary?.resources?.total_resources || 0;
  const totalCost = platform?.rawSummary?.resources?.total_monthly_cost || 0;
  const geminiActive = platform?.health?.gemini_active !== false;

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          height: '56px',
          borderColor: 'var(--border)',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-7">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
              <span className="hidden sm:inline" style={{ color: 'var(--text-dim)' }}>CloudIQ</span>
              <span className="hidden sm:inline" style={{ color: 'var(--text-dim)' }}>/</span>
              <h1 className="truncate text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
                {title}
              </h1>
            </div>
            <p className="mt-0.5 hidden text-[11px] sm:block" style={{ color: 'var(--text-dim)' }}>
              AI Command Center
            </p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div
              className="flex h-[30px] items-center gap-2 rounded-full border px-3 text-xs font-semibold"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Server className="h-3 w-3" style={{ color: 'var(--text-dim)' }} />
              <span className="font-mono-data" style={{ color: 'var(--data)' }}>{totalResources}</span>
              <span style={{ color: 'var(--text-muted)' }}>Resources</span>
            </div>

            <div
              className="flex h-[30px] items-center gap-2 rounded-full border px-3 text-xs"
              style={{
                background: geminiActive ? 'var(--success-soft)' : 'var(--danger-soft)',
                borderColor: geminiActive ? 'var(--success-border)' : 'var(--danger-border)',
              }}
            >
              <span
                className="pulse-dot"
                style={{
                  width: '6px',
                  height: '6px',
                  background: geminiActive ? 'var(--success)' : 'var(--danger)',
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>Gemini</span>
              <span
                className="font-semibold"
                style={{ color: geminiActive ? 'var(--success)' : 'var(--danger)' }}
              >
                {geminiActive ? 'Active' : 'Offline'}
              </span>
            </div>

            <div
              className="flex h-[30px] items-center gap-2 rounded-full border px-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <TrendingUp className="h-3 w-3" style={{ color: 'var(--text-dim)' }} />
              <span className="font-mono-data text-xs font-semibold" style={{ color: 'var(--data)' }}>
                {formatCurrency(totalCost)}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>/mo</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="hidden h-[30px] w-[72px] items-center justify-center rounded-lg border text-[11px] transition-colors md:flex"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-dim)',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = 'var(--border-active)';
                event.currentTarget.style.color = 'var(--text-muted)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = 'var(--border)';
                event.currentTarget.style.color = 'var(--text-dim)';
              }}
            >
              Ctrl K
            </button>

            <button
              onClick={toggleTheme}
              className="btn-icon h-[34px] w-[34px] rounded-full !p-0"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              type="button"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* HIDDEN FOR VIVA — sign-in / user auth block
            {user ? (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-richer))' }}
                >
                  <User size={14} style={{ color: 'var(--text-on-accent)' }} />
                </div>
                <span
                  className="hidden max-w-20 truncate text-[11px] sm:block"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {user.email?.split('@')[0]}
                </span>
                <button onClick={signOut} className="btn-icon h-7 w-7 !p-0" title="Sign out" type="button">
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="btn-primary h-8 rounded-lg px-3.5 text-xs"
                type="button"
              >
                <LogIn size={12} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
            END HIDDEN */}

            <div className="hidden items-center gap-1.5 sm:flex" style={{ color: 'var(--text-dim)' }}>
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-[spin_1s_linear_infinite]' : ''}`} />
              <span className="font-mono-data text-[11px]">Updated {formatRelativeMinutes(lastUpdated)}</span>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </AnimatePresence>
    </>
  );
}
