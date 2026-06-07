import { create } from 'zustand';
import { fetchJson, getErrorMessage } from '../lib/api';
import {
  buildCommandCenterModel,
  detectLanguageTone,
  getLocalizedCopy,
  buildActivityTimeline,
} from '../lib/commandCenter';
import { supabase } from '../lib/supabase';

const RUNS_STORAGE_KEY = 'cloudiq-agent-runs';
const LANGUAGE_STORAGE_KEY = 'cloudiq-ui-language';

function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (Array.isArray(value)) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value.slice(-6)));
      } catch {
        // Non-critical storage failure.
      }
    }
  }
}

function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') return 'en';
  if ((navigator.language || '').toLowerCase().startsWith('hi')) return 'hi';
  return 'en';
}

export const useCloudStore = create((set, get) => ({
  snapshot: null,
  loading: true,
  error: '',
  lastUpdated: null,
  language: readStorage(LANGUAGE_STORAGE_KEY, detectBrowserLanguage()),
  agentRuns: readStorage(RUNS_STORAGE_KEY, []),
  theme: readStorage('cloudiq-theme', 'dark'),

  // ── Auth state ────────────────────────────────────────────────
  user: null,
  authLoading: true,

  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ user: session?.user || null, authLoading: false });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user || null });
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
  // ──────────────────────────────────────────────────────────────

  setLanguage: (lang) => {
    set({ language: lang });
    writeStorage(LANGUAGE_STORAGE_KEY, lang);
  },

  updateLanguageFromMessage: (text) => {
    const lang = detectLanguageTone(text);
    if (lang !== get().language) {
      get().setLanguage(lang);
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    writeStorage('cloudiq-theme', next);
    set({ theme: next });
  },

  refreshData: async () => {
    set({ loading: true, error: '' });
    try {
      const [health, analyze, predict, recommend] = await Promise.all([
        fetchJson('/api/health'),
        fetchJson('/api/analyze'),
        fetchJson('/api/predict'),
        fetchJson('/api/recommend'),
      ]);

      set({
        snapshot: { health, analyze, predict, recommend },
        lastUpdated: new Date().toISOString(),
        loading: false,
      });
    } catch (err) {
      set({
        error: getErrorMessage(err, 'Unable to sync CloudIQ telemetry.'),
        loading: false,
      });
    }
  },

  registerAgentRun: ({ goal, response, tools = [], status = 'success', intent = 'analysis' }) => {
    get().updateLanguageFromMessage(goal);

    const newRun = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      timestamp: new Date().toISOString(),
      goal,
      summary: response.slice(0, 180),
      tools,
      status,
      intent,
      duration: `${96 + tools.length * 47}ms`,
    };

    set((state) => {
      const runs = [newRun, ...state.agentRuns].slice(0, 12);
      writeStorage(RUNS_STORAGE_KEY, runs);
      return { agentRuns: runs };
    });
  },

  getPlatform: () => {
    const { snapshot, language } = get();
    return snapshot ? buildCommandCenterModel(snapshot, language) : null;
  },

  getActivity: () => {
    const { agentRuns, language, lastUpdated } = get();
    const platform = get().getPlatform();
    return buildActivityTimeline(platform, agentRuns, language, lastUpdated);
  },

  getCopy: () => getLocalizedCopy(get().language),

  getSystemStatus: () => {
    const { loading, agentRuns } = get();
    const copy = get().getCopy();
    if (loading) return 'Syncing…';
    if (agentRuns.length) return copy.statusActive;
    return copy.statusIdle;
  },
}));


