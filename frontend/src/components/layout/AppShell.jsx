import CommandPalette from '../CommandPalette';
import SidebarNav from './SidebarNav';
import TopHeader from './TopHeader';

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>
      <div className="relative flex min-h-screen">
        <SidebarNav />
        <CommandPalette />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopHeader />
          <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
