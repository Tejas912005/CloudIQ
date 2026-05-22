import { useEffect, useRef, useState } from 'react';
import { Bot, SendHorizonal, User, ShieldAlert, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../lib/api';
import {
  detectLanguageTone,
  extractToolUsage,
  stripToolUsage,
} from '../lib/commandCenter';
import GlassPanel from '../components/shared/GlassPanel';
import StatusChip from '../components/shared/StatusChip';
import DynamicChart from '../components/DynamicChart';
import { useCloudIQ } from '../hooks/useCloudIQ';

const CHAT_STORAGE_KEY = 'cloudiq-assistant-thread';
const ASSISTANT_PHASES = [
  'Planning…',
  'Gathering telemetry…',
  'Shaping response…',
  'Finalising…',
];

function createMessageId(role) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${role}-${crypto.randomUUID()}`;
  }
  return `${role}-${Math.round(performance.now() * 1000)}`;
}

function loadThread(copy) {
  if (typeof window === 'undefined') {
    return [{ id: 'seed', role: 'assistant', text: copy.assistantGreeting, tools: [] }];
  }
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [{ id: 'seed', role: 'assistant', text: copy.assistantGreeting, tools: [] }];
    return JSON.parse(raw);
} catch {
    return [{ id: 'seed', role: 'assistant', text: copy.assistantGreeting, tools: [] }];
  }
}

function ActionCard({ card }) {
  const [status, setStatus] = useState('pending');
  const [resultMsg, setResultMsg] = useState('');

  const execute = async () => {
    setStatus('executing');
    const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
    try {
      const res = await fetch(`${API_BASE}${card.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: card.actionId })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatus('success');
        setResultMsg(data.message);
      } else {
        setStatus('error');
        setResultMsg(data.message);
      }
    } catch (err) {
      setStatus('error');
      setResultMsg('Network error executing command.');
    }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-active)] bg-[var(--surface-2)] shadow-sm animate-fade-in-up">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        <ShieldAlert className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-semibold text-[var(--text-base)]">Agentic Execution Required</span>
      </div>
      <div className="p-4">
        <h4 className="text-base font-medium text-[var(--text-base)]">{card.title}</h4>
        <p className="mt-1 text-sm text-[var(--text-muted)] leading-relaxed">{card.description}</p>
        
        {status === 'pending' && (
          <div className="mt-4 flex gap-3">
            <button onClick={execute} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[var(--accent-hover)]">
              Approve & Execute
            </button>
            <button onClick={() => setStatus('error')} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-base)] transition-all hover:bg-[var(--surface)]">
              Reject
            </button>
          </div>
        )}
        
        {status === 'executing' && (
          <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--text-base)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" /> Executing via CloudIQ Agent...
          </div>
        )}

        {status === 'success' && (
          <div className="mt-4 flex flex-col gap-1 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-500">
              <CheckCircle2 className="h-4 w-4" /> Execution Complete
            </div>
            <p className="text-xs text-green-600/80">{resultMsg}</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="mt-4 flex flex-col gap-1 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-500">
              <ShieldAlert className="h-4 w-4" /> Execution Rejected or Failed
            </div>
            {resultMsg && <p className="text-xs text-red-500/80">{resultMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Assistant() {
  const {
    copy, language, platform, registerAgentRun, updateLanguageFromMessage,
  } = useCloudIQ();
  const [messages, setMessages] = useState(() => loadThread(copy));
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const bottomRef = useRef(null);

  const handleClearHistory = async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      window.localStorage.removeItem('cloudiq-ui-overrides');
      const root = document.documentElement;
      root.style.cssText = "";
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      document.body.style.fontFamily = "";
    }
    setMessages([{ id: 'seed', role: 'assistant', text: copy.assistantGreeting, tools: [] }]);
    try {
      const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
      await fetch(`${API_BASE}/api/chat/clear`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear database chat history:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!sending) return undefined;
    const timer = window.setInterval(() => {
      setPhaseIndex((c) => (c + 1) % ASSISTANT_PHASES.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [sending]);

  const handleSend = async (seedText) => {
    const message = (seedText || input).trim();
    if (!message) return;

    setInput('');
    updateLanguageFromMessage(message);

    const userMessage = { id: createMessageId('user'), role: 'user', text: message, tools: [] };
    const assistantId = createMessageId('assistant');
    setMessages((c) => {
      const next = [
        ...c,
        userMessage,
        { id: assistantId, role: 'assistant', text: '', tools: [], streaming: true },
      ];
      return next.slice(-20);
    });
    setSending(true);

    const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let finalIntent = 'analysis';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const line = rawEvent.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;

          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'thinking') {
            finalIntent = payload.intent || finalIntent;
          }
          if (payload.type === 'token') {
            fullText += payload.text || '';
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId ? { ...item, text: fullText, streaming: true } : item
              )
            );
          }
          // --- AGENTIC UI: Command Receiver ---
          if (payload.type === 'action') {
            if (payload.command === 'navigate' && payload.target) {
              setTimeout(() => { window.location.href = payload.target; }, 1500);
            }
            if (payload.command === 'setTheme') {
               const root = document.documentElement;
               if (payload.target === 'dark') {
                  root.classList.add('dark');
                  root.setAttribute('data-theme', 'dark');
                  root.style.setProperty('--bg-base', '#0a0a0f');
                  root.style.setProperty('--surface', '#111116');
               } else {
                  root.classList.remove('dark');
                  root.setAttribute('data-theme', 'light');
                  root.style.setProperty('--bg-base', '#f8fafc');
                  root.style.setProperty('--surface', '#ffffff');
               }
            }
            // ── Universal Agentic UI Control ──
            if (payload.command === 'ui_control' && payload.payload) {
              const cmd = payload.payload;
              if (cmd.action === 'apply_css' && cmd.vars) {
                // Apply each CSS variable to :root instantly
                const root = document.documentElement;
                Object.entries(cmd.vars).forEach(([key, value]) => {
                  if (key === '--theme') {
                    if (value === 'dark') {
                      root.classList.add('dark');
                      root.setAttribute('data-theme', 'dark');
                    } else {
                      root.classList.remove('dark');
                      root.setAttribute('data-theme', 'light');
                    }
                  } else if (key === '--font-size-base') {
                    root.style.fontSize = value;
                  } else if (key === '--font-family') {
                    document.body.style.fontFamily = value;
                  } else {
                    root.style.setProperty(key, value);
                  }
                });
                // Auto-derive accent-soft, accent-border, accent-glow from --accent
                // if --accent was provided but the derived ones were not
                if (cmd.vars['--accent'] && !cmd.vars['--accent-soft']) {
                  const hex = cmd.vars['--accent'];
                  // Parse hex to rgb
                  const r = parseInt(hex.slice(1,3), 16);
                  const g = parseInt(hex.slice(3,5), 16);
                  const b = parseInt(hex.slice(5,7), 16);
                  if (!isNaN(r)) {
                    root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.10)`);
                    root.style.setProperty('--accent-border', `rgba(${r},${g},${b},0.25)`);
                    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.20)`);
                    root.style.setProperty('--border-active', `rgba(${r},${g},${b},0.35)`);
                    root.style.setProperty('--border-focus', `rgba(${r},${g},${b},0.5)`);
                    // Also persist these derived values
                    cmd.vars['--accent-soft'] = `rgba(${r},${g},${b},0.10)`;
                    cmd.vars['--accent-border'] = `rgba(${r},${g},${b},0.25)`;
                    cmd.vars['--accent-glow'] = `rgba(${r},${g},${b},0.20)`;
                    cmd.vars['--border-active'] = `rgba(${r},${g},${b},0.35)`;
                    cmd.vars['--border-focus'] = `rgba(${r},${g},${b},0.5)`;
                  }
                }
                // Persist to localStorage so changes survive refresh
                try {
                  const stored = JSON.parse(localStorage.getItem('cloudiq-ui-overrides') || '{}');
                  localStorage.setItem('cloudiq-ui-overrides', JSON.stringify({ ...stored, ...cmd.vars }));
                } catch {}
              }
              if (cmd.action === 'render_chart') {
                // Attach chart config to the assistant message
                setMessages((current) =>
                  current.map((item) =>
                    item.id === assistantId ? { ...item, chartConfig: cmd, streaming: true } : item
                  )
                );
              }
            }
            // ─────────────────────────────────
            if (payload.command === 'execute_tool') {
               setMessages((current) =>
                  current.map((item) =>
                     item.id === assistantId ? { ...item, actionCard: payload, streaming: true } : item
                  )
               );
            }
          }
          // ------------------------------------
          if (payload.type === 'done') {
            finalIntent = payload.intent || finalIntent;
          }
        }
      }

      const tools = extractToolUsage(fullText);
      const cleaned = stripToolUsage(fullText);
      const inferredTools = tools.length || ['none', 'error'].includes(finalIntent) ? tools : [finalIntent];

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? { ...item, text: cleaned, tools: inferredTools, streaming: false }
            : item
        )
      );
      registerAgentRun({ goal: message, response: cleaned, tools: inferredTools, status: 'success', intent: finalIntent });
    } catch (error) {
      const messageText = `Connection error. ${getErrorMessage(error, 'Could not reach backend.')}`;
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? { ...item, text: messageText, tools: [], streaming: false }
            : item
        )
      );
      registerAgentRun({ goal: message, response: messageText, tools: [], status: 'error', intent: 'error' });
    }

    setSending(false);
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-0 animate-fade">
      <GlassPanel className="flex min-h-[80vh] flex-col overflow-hidden p-0">

        {/* Chat header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="font-display text-base font-medium" style={{ color: 'var(--text-base)' }}>Assistant</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-all duration-300"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--text-base)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: 'inherit' }} />
              Clear Chat
            </button>
            <StatusChip label={language.toUpperCase()} tone="slate" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
                >
                  <Bot className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                </div>
              )}

              <div
                className="max-w-3xl rounded-xl border px-4 py-3"
                style={{
                  borderColor: message.role === 'assistant' ? 'var(--border)' : 'var(--accent-border)',
                  background: message.role === 'assistant' ? 'var(--surface)' : 'var(--accent-soft)',
                }}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-base)' }}>
                  {message.text}
                  {message.streaming && <span className="streaming-cursor"> ▋</span>}
                </p>
                {message.actionCard && <ActionCard card={message.actionCard} />}
                {message.chartConfig && <DynamicChart config={message.chartConfig} />}
                {message.role === 'assistant' && message.tools?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.tools.map((tool) => (
                      <StatusChip key={tool} label={tool} tone="cyan" />
                    ))}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <User className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {sending && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.text && (
            <div className="flex gap-3">
              <div
                className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
              >
                <Bot className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              </div>
              <div
                className="rounded-xl border px-4 py-3"
                style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{ASSISTANT_PHASES[phaseIndex]}</p>
                <div className="mt-2 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ background: 'var(--accent)', animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          {/* Suggestion pills */}
          <div className="mb-3 flex flex-wrap gap-2">
            {(platform?.assistantSuggestions || copy.suggestions).map((s) => (
              <button
                key={s}
                className="rounded-lg border px-3 py-1.5 text-sm transition-all duration-300"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
                onClick={() => handleSend(s)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--text-base)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={copy.assistantPlaceholder}
              rows={2}
              className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-300"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-base)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-border)'; e.target.style.background = 'var(--surface-2)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--surface)'; }}
            />
            <button
              className="command-button h-fit self-end"
              onClick={() => handleSend()}
              disabled={sending}
            >
              <SendHorizonal className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
