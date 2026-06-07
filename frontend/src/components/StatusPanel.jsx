import { AlertTriangle, Circle } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4"
      style={{ minHeight: '240px' }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '3px solid var(--surface-2)',
          borderTop: '3px solid var(--accent)',
          animation: 'spin 0.9s linear infinite',
          boxShadow: '0 0 20px var(--accent-glow)',
        }}
      />
      <p
        className="text-[13px]"
        style={{ color: 'var(--text-muted)', animation: 'textPulse 2s ease-in-out infinite' }}
      >
        {message}
      </p>
    </div>
  );
}

export function ErrorState({ title = 'Error', message, onAction }) {
  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-[14px] border p-8 text-center"
      style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger-border)' }}
    >
      <AlertTriangle className="h-9 w-9" style={{ color: 'var(--danger)' }} />
      <p className="text-base font-semibold" style={{ color: 'var(--text-base)' }}>{title}</p>
      {message && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{message}</p>}
      {onAction && (
        <button
          onClick={onAction}
          className="btn-ghost mt-2"
          style={{ borderColor: 'var(--danger-border)' }}
          type="button"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'No data', message }) {
  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-[14px] border border-dashed p-12 text-center"
      style={{ borderColor: 'var(--border-active)' }}
    >
      <Circle className="h-9 w-9" style={{ color: 'var(--text-muted)', opacity: 0.25 }} />
      <p className="text-base font-semibold" style={{ color: 'var(--text-base)' }}>{title}</p>
      {message && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{message}</p>}
    </div>
  );
}
