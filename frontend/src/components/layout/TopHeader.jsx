import { Clock3, LogIn, LogOut, Moon, RefreshCcw, Sun, User } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCloudIQ } from '../../hooks/useCloudIQ';
import { useCloudStore } from '../../store/useCloudStore';
import { formatRelativeMinutes, formatCurrency } from '../../lib/formatters';
import AuthModal from '../auth/AuthModal';

const TITLES = {
  '/':          'Dashboard',
  '/assistant': 'Assistant',
  '/insights':  'Insights',
  '/actions':   'Actions',
  '/graph':     'Graph',
  '/globe':     'Globe',
  '/resources': 'Resources',
  '/predictions': 'Predictions',
  '/activity':  'Activity',
};

export default function TopHeader() {
  const location = useLocation();
  const { lastUpdated, platform, loading, theme, toggleTheme } = useCloudIQ();
  const user    = useCloudStore(state => state.user);
  const signOut = useCloudStore(state => state.signOut);
  const [showAuth, setShowAuth] = useState(false);
  const title = TITLES[location.pathname] || 'Dashboard';

  const totalResources = platform?.rawSummary?.total_resources || 0;
  const totalCost      = platform?.rawSummary?.total_monthly_cost || 0;
  const geminiActive   = platform?.health?.gemini_available !== false;

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ height: '48px', borderColor: 'var(--border)', background: 'var(--header-bg)' }}
      >
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* LEFT */}
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold" style={{ color: 'var(--text-base)' }}>
              {title}
            </h1>
          </div>

          {/* CENTER HUD */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border px-3 h-[28px]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-base)' }}>{totalResources} Resources</span>
            </div>

            <div className="flex items-center gap-2 rounded-full border px-3 h-[28px]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="pulse-dot" style={{ background: geminiActive ? 'var(--accent)' : 'var(--danger)', width: '6px', height: '6px' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-base)' }}>
                {geminiActive ? 'Gemini Active' : 'Gemini Offline'}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-full border px-3 h-[28px]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-base)' }}>{formatCurrency(totalCost)}/mo</span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            <div
              className="hidden items-center justify-center rounded-lg border h-[28px] w-[80px] text-[11px] transition-colors md:flex cursor-pointer hover:border-[var(--border-active)] hover:text-[var(--text-muted)]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-dim)' }}
            >
              ⌘ K
            </div>

            <button
              onClick={toggleTheme}
              className="btn-icon h-8 w-8 !p-0"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Auth section */}
            {user ? (
              <div className="flex items-center gap-2">
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <span style={{
                  fontSize: '11px', color: 'var(--text-muted)', maxWidth: '90px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.email?.split('@')[0]}
                </span>
                <button onClick={signOut} className="btn-icon h-7 w-7 !p-0" title="Sign out">
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '8px', fontSize: '12px',
                  fontWeight: 600, background: 'var(--accent)', color: '#060a14',
                  border: 'none', cursor: 'pointer', transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <LogIn size={13} />
                Sign In
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-[spin_1s_linear_infinite]' : ''}`} />
              <span className="text-[11px]">Updated {formatRelativeMinutes(lastUpdated)}</span>
            </div>
          </div>
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
