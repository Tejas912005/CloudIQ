import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { CheckCircle2, Loader2, SendHorizonal, ShieldAlert, Trash2 } from 'lucide-react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { getErrorMessage } from '../lib/api';
import {
  extractToolUsage,
  stripToolUsage,
} from '../lib/commandCenter';
import DynamicChart from '../components/DynamicChart';
import { useCloudIQ } from '../hooks/useCloudIQ';
import { FadeUp, StaggerParent, StaggerChild, PressButton } from '../components/shared/Motion';

const AICore = lazy(() => import('../components/shared/AICore'));

const CHAT_STORAGE_KEY = 'cloudiq-assistant-thread';
const ASSISTANT_PHASES = [
  'Planning...',
  'Gathering telemetry...',
  'Shaping response...',
  'Finalising...',
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
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY,
        },
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
    } catch {
      setStatus('error');
      setResultMsg('Network error executing command.');
    }
  };

  return (
    <div
      className="mt-4 overflow-hidden rounded-[14px] border animate-fade-in-up"
      style={{ borderColor: 'var(--border-active)', background: 'var(--surface-2)' }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <ShieldAlert className="h-4 w-4" style={{ color: 'var(--warning)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
          Agentic Execution Required
        </span>
      </div>
      <div className="p-4">
        <h4 className="text-base font-semibold" style={{ color: 'var(--text-base)' }}>{card.title}</h4>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{card.description}</p>

        {status === 'pending' && (
          <div className="mt-4 flex flex-wrap gap-3">
            <PressButton onClick={execute} className="btn-primary" type="button">
              Approve & Execute
            </PressButton>
            <PressButton onClick={() => setStatus('error')} className="btn-ghost" type="button">
              Reject
            </PressButton>
          </div>
        )}

        {status === 'executing' && (
          <div className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-base)' }}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />
            Executing via CloudIQ Agent...
          </div>
        )}

        {status === 'success' && (
          <div
            className="mt-4 flex flex-col gap-1 rounded-lg border p-3"
            style={{ borderColor: 'var(--success-border)', background: 'var(--success-soft)' }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              <CheckCircle2 className="h-4 w-4" />
              Execution Complete
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{resultMsg}</p>
          </div>
        )}

        {status === 'error' && (
          <div
            className="mt-4 flex flex-col gap-1 rounded-lg border p-3"
            style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--danger)' }}>
              <ShieldAlert className="h-4 w-4" />
              Execution Rejected or Failed
            </div>
            {resultMsg && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{resultMsg}</p>}
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
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [coreState, setCoreState] = useState('idle');
  const bottomRef = useRef(null);
  const showSuggestions = messages.length === 1 && messages[0]?.id === 'seed';

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
      await fetch(`${API_BASE}/api/chat/clear`, {
        method: 'POST',
        headers: {
          'X-API-Key': import.meta.env.VITE_API_KEY,
        },
      });
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

  useEffect(() => {
    if (sending) {
      setCoreState('thinking');
      return undefined;
    }

    const anomalyCount =
      platform?.rawSummary?.anomaly_count ??
      platform?.rawSummary?.anomalies?.total_anomaly_days ??
      0;

    if (anomalyCount > 5) {
      setCoreState('anomaly');
      const timer = window.setTimeout(() => setCoreState('idle'), 4000);
      return () => window.clearTimeout(timer);
    }

    setCoreState('idle');
    return undefined;
  }, [platform, sending]);

  const [pendingUpload, setPendingUpload] = useState(null);
  const pendingExtractedText = pendingUpload?.extracted_text
    ? String(pendingUpload.extracted_text).trim()
    : '';

  // Used by the upload UI (file picker / drag-drop) to call the backend upload endpoint.
  const uploadToBackend = async (file) => {
    const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${API_BASE}/api/assistant/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': import.meta.env.VITE_API_KEY,
      },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }

    return await res.json();
  };

  const handleSend = async (seedText) => {
    let message = (seedText || input).trim();

    // If a file was uploaded, prepend extracted text so the assistant can use it.
    if (pendingExtractedText) {
      message = `Uploaded file content (extracted):\n${pendingExtractedText}\n\nUser request:\n${message || ''}`.trim();
      setPendingUpload(null);
    }

    if (!message) return;

    // Update input state early so UI feels responsive
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
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY,
        },
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

          // Agentic UI: Command Receiver
          if (payload.type === 'action') {
            if (payload.command === 'navigate' && payload.target) {
              setTimeout(() => { window.location.href = payload.target; }, 1500);
            }
            if (payload.command === 'setTheme') {
              const root = document.documentElement;
              if (payload.target === 'dark') {
                root.classList.add('dark');
                root.setAttribute('data-theme', 'dark');
                root.style.removeProperty('--bg-base');
                root.style.removeProperty('--surface');
              } else {
                root.classList.remove('dark');
                root.setAttribute('data-theme', 'light');
                root.style.removeProperty('--bg-base');
                root.style.removeProperty('--surface');
              }
            }

            // Universal Agentic UI Control
            if (payload.command === 'ui_control' && payload.payload) {
              const cmd = payload.payload;
              if (cmd.action === 'apply_css' && cmd.vars) {
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

                if (cmd.vars['--accent'] && !cmd.vars['--accent-soft']) {
                  const hex = cmd.vars['--accent'];
                  const r = parseInt(hex.slice(1,3), 16);
                  const g = parseInt(hex.slice(3,5), 16);
                  const b = parseInt(hex.slice(5,7), 16);
                  if (!isNaN(r)) {
                    root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.10)`);
                    root.style.setProperty('--accent-border', `rgba(${r},${g},${b},0.25)`);
                    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.20)`);
                    root.style.setProperty('--border-active', `rgba(${r},${g},${b},0.35)`);
                    root.style.setProperty('--border-focus', `rgba(${r},${g},${b},0.5)`);
                    cmd.vars['--accent-soft'] = `rgba(${r},${g},${b},0.10)`;
                    cmd.vars['--accent-border'] = `rgba(${r},${g},${b},0.25)`;
                    cmd.vars['--accent-glow'] = `rgba(${r},${g},${b},0.20)`;
                    cmd.vars['--border-active'] = `rgba(${r},${g},${b},0.35)`;
                    cmd.vars['--border-focus'] = `rgba(${r},${g},${b},0.5)`;
                  }
                }

                try {
                  const stored = JSON.parse(localStorage.getItem('cloudiq-ui-overrides') || '{}');
                  localStorage.setItem('cloudiq-ui-overrides', JSON.stringify({ ...stored, ...cmd.vars }));
                } catch (storageError) {
                  console.warn('Failed to persist UI overrides:', storageError);
                }
              }

              if (cmd.action === 'render_chart') {
                setMessages((current) =>
                  current.map((item) =>
                    item.id === assistantId ? { ...item, chartConfig: cmd, streaming: true } : item
                  )
                );
              }
            }

            if (payload.command === 'execute_tool') {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId ? { ...item, actionCard: payload, streaming: true } : item
                )
              );
            }
          }

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
          item.id === assistantId ? { ...item, text: cleaned, tools: inferredTools, streaming: false } : item
        )
      );

      registerAgentRun({ goal: message, response: cleaned, tools: inferredTools, status: 'success', intent: finalIntent });
    } catch (error) {
      const messageText = `Connection error. ${getErrorMessage(error, 'Could not reach backend.')}`;
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, text: messageText, tools: [], streaming: false } : item
        )
      );
      registerAgentRun({ goal: message, response: messageText, tools: [], status: 'error', intent: 'error' });
    }

    setSending(false);
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 56px)', background: 'var(--bg-base)' }}
    >
      <div
        className="flex h-[52px] shrink-0 items-center justify-between border-b px-4 sm:px-6"
        style={{ background: 'var(--bg-mid)', borderColor: 'var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Suspense
            fallback={
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              />
            }
          >
            <AICore state={coreState} size={52} />
          </Suspense>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-base)' }}>
              CloudIQ Agent
            </p>
            <p
              style={{
                fontSize: '11px',
                color:
                  coreState === 'thinking'
                    ? 'var(--accent)'
                    : coreState === 'anomaly'
                      ? 'var(--warning)'
                      : 'var(--text-dim)',
                transition: 'color 0.5s ease',
              }}
            >
              {coreState === 'thinking'
                ? 'Processing...'
                : coreState === 'anomaly'
                  ? 'Anomaly detected'
                  : `Online · Ready / ${language.toUpperCase()}`}
            </p>
          </div>
        </div>

        <PressButton onClick={handleClearHistory} className="btn-ghost" type="button">
          <Trash2 className="h-3.5 w-3.5" />
          Clear Chat
        </PressButton>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
        <AnimatePresence mode="popLayout" initial={false}>
          {messages.map((message) => {
            const isUser = message.role === 'user';

            return (
              <Motion.div
                key={message.id}
                layout
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                initial={{ opacity: 0, x: isUser ? 20 : -20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: isUser ? 12 : -12, scale: 0.97 }}
                transition={{
                  type: 'spring',
                  stiffness: isUser ? 400 : 380,
                  damping: isUser ? 28 : 26,
                }}
              >
                <div
                  className="w-full max-w-[88%]"
                  style={{
                    maxWidth: isUser ? '78%' : '88%',
                    color: isUser ? 'var(--text-on-accent)' : 'var(--text-base)',
                  }}
                >
                  <div
                    className="border px-4 py-3 text-sm"
                    style={{
                      borderColor: isUser ? 'transparent' : 'var(--border)',
                      borderRadius: isUser
                        ? '18px 18px 4px 18px'
                        : '4px 18px 18px 18px',
                      background: isUser
                        ? 'linear-gradient(135deg, var(--accent-solid), var(--accent-richer))'
                        : 'var(--bg-elevated)',
                      boxShadow: isUser ? '0 4px 16px var(--accent-glow)' : 'none',
                      lineHeight: isUser ? 1.6 : 1.7,
                    }}
                  >
                    <p className="whitespace-pre-wrap">
                      {message.text}
                      {message.streaming && <span className="streaming-cursor"> |</span>}
                    </p>
                    {message.actionCard && <ActionCard card={message.actionCard} />}
                    {message.chartConfig && <DynamicChart config={message.chartConfig} />}
                  </div>

                  {!isUser && message.tools?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.tools.map((tool) => (
                        <span
                          key={tool}
                          className="status-chip text-[10px] uppercase"
                          style={{ height: '24px', color: 'var(--text-dim)' }}
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Motion.div>
            );
          })}
        </AnimatePresence>

        {showSuggestions && (
          <StaggerParent className="mx-auto grid w-full max-w-[680px] grid-cols-1 gap-3 sm:grid-cols-2">
            {(platform?.assistantSuggestions || copy.suggestions).slice(0, 4).map((suggestion) => (
              <StaggerChild key={suggestion}>
                <Motion.button
                  className="w-full rounded-[12px] border px-4 py-3 text-left text-[13px]"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                  }}
                  whileHover={{
                    borderColor: 'var(--accent-border)',
                    background: 'var(--accent-soft)',
                    color: 'var(--text-base)',
                    y: -2,
                    scale: 1.02,
                  }}
                  whileTap={{ scale: 0.98, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  onClick={() => handleSend(suggestion)}
                  type="button"
                >
                  {suggestion}
                </Motion.button>
              </StaggerChild>
            ))}
          </StaggerParent>
        )}

        {sending &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === 'assistant' &&
          !messages[messages.length - 1]?.text && (
            <div className="flex justify-start">
              <FadeUp
                className="border px-4 py-3"
                style={{
                  maxWidth: '88%',
                  borderColor: 'var(--border)',
                  borderRadius: '4px 18px 18px 18px',
                  background: 'var(--bg-elevated)',
                }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
                  {ASSISTANT_PHASES[phaseIndex]}
                </p>
                <div className="mt-2 flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full border"
                      style={{
                        background: 'var(--accent-soft)',
                        borderColor: 'var(--accent)',
                        animation: `assistantDotBounce 1s ease-in-out ${i * 150}ms infinite`,
                      }}
                    />
                  ))}
                </div>
              </FadeUp>
            </div>
          )}

        <div ref={bottomRef} />
      </div>

      <div
        className="flex min-h-[72px] shrink-0 items-center gap-3 border-t px-4 py-3 sm:px-6"
        style={{ background: 'var(--bg-mid)', borderColor: 'var(--border)' }}
      >
        <div className="flex-1 flex items-stretch">
          <label
            className="flex items-center justify-center px-3 rounded-[14px] border"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              marginRight: 10,
            }}
            title="Upload a file for analysis"
          >
            <UploadCloud className="h-4 w-4" />
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const result = await uploadToBackend(file);
                  setPendingUpload(result);
                } catch (err) {
                  console.error(err);
                  setPendingUpload(null);
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </label>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={copy.assistantPlaceholder}
            rows={1}
            className="flex-1 resize-none rounded-[14px] border px-4 py-3 text-sm outline-none transition-all duration-200"
            style={{
              minHeight: '46px',
              maxHeight: '92px',
              borderColor: 'var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-base)',
            }}
            onFocus={(event) => {
              event.target.style.borderColor = 'var(--accent-border)';
              event.target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
            }}
            onBlur={(event) => {
              event.target.style.borderColor = 'var(--border)';
              event.target.style.boxShadow = 'none';
            }}
          />

          <PressButton
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
            onClick={() => handleSend()}
            disabled={sending}
            whileHover={!sending ? { scale: 1.05, boxShadow: '0 0 24px var(--accent-glow)' } : {}}
            whileTap={!sending ? { scale: 0.95 } : {}}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            style={{
              background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-richer))',
              color: 'var(--text-on-accent)',
              border: 'none',
              boxShadow: sending ? 'none' : '0 0 16px var(--accent-glow)',
              opacity: sending ? 0.35 : 1,
              cursor: sending ? 'not-allowed' : 'pointer',
            }}
            type="button"
          >
            <SendHorizonal className="h-[18px] w-[18px]" />
          </PressButton>
        </div>
      </div>
    </Motion.div>
  );
}

