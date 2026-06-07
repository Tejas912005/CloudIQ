import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import CommandPalette from '../CommandPalette';
import { useCloudIQ } from '../../hooks/useCloudIQ';
import SidebarNav from './SidebarNav';
import TopHeader from './TopHeader';

export default function AppShell({ children }) {
  const location = useLocation();
  const { platform } = useCloudIQ();
  const isAssistant = location.pathname === '/assistant';

  useEffect(() => {
    const body = document.body;
    body.classList.remove('ambient-healthy', 'ambient-warning', 'ambient-critical');

    if (!platform) return undefined;

    const highRisk =
      platform.rawSummary?.high_risk_count ??
      platform.rawSummary?.graph_stats?.high_risk_nodes ??
      0;
    const anomalies =
      platform.rawSummary?.anomaly_count ??
      platform.rawSummary?.anomalies?.total_anomaly_days ??
      0;

    if (highRisk > 5 || anomalies > 8) {
      body.classList.add('ambient-critical');
    } else if (highRisk > 2 || anomalies > 4) {
      body.classList.add('ambient-warning');
    } else {
      body.classList.add('ambient-healthy');
    }

    return () => {
      body.classList.remove('ambient-healthy', 'ambient-warning', 'ambient-critical');
    };
  }, [platform]);

  return (
    <div
      className="relative flex min-h-screen flex-row overflow-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}
    >
      <div aria-hidden="true" className="cyber-grid" />
      <div className="relative z-[1]">
        <SidebarNav />
      </div>
      <CommandPalette />
      <div className="relative z-[1] flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main
          className={`flex-1 overflow-y-auto ${
            isAssistant
              ? 'p-0'
              : 'p-4 pb-20 lg:px-7 lg:py-6 lg:pb-6'
          }`}
          style={{ background: 'transparent' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
