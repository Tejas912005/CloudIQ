import { useEffect } from 'react';
import CloudIQContext from './cloudiq-context';
import { useCloudStore } from '../store/useCloudStore';

const POLL_INTERVAL_MS = 45000;

export function CloudIQProvider({ children }) {
  const store = useCloudStore();

  useEffect(() => {
    // Initialize Supabase auth state from existing session on app load
    useCloudStore.getState().initAuth();
    store.refreshData();
    const timer = window.setInterval(() => store.refreshData(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', store.theme);
  }, [store.theme]);

  const value = {
    loading: store.loading,
    error: store.error,
    refreshData: store.refreshData,
    platform: store.getPlatform(),
    language: store.language,
    setLanguage: store.setLanguage,
    updateLanguageFromMessage: store.updateLanguageFromMessage,
    lastUpdated: store.lastUpdated,
    agentRuns: store.agentRuns,
    registerAgentRun: store.registerAgentRun,
    activity: store.getActivity(),
    copy: store.getCopy(),
    systemStatus: store.getSystemStatus(),
    theme: store.theme,
    toggleTheme: store.toggleTheme,
  };

  return (
    <CloudIQContext.Provider value={value}>
      {children}
    </CloudIQContext.Provider>
  );
}
