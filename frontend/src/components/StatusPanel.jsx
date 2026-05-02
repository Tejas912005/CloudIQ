export function LoadingState({ message = 'Loading...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '200px', gap: '14px' }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        border: '3px solid var(--surface-2)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{message}</p>
    </div>
  );
}

export function ErrorState({ title = 'Error', message, onAction }) {
  return (
    <div style={{
      background: 'rgba(255,68,102,0.06)', border: '1px solid rgba(255,68,102,0.2)',
      borderRadius: '12px', padding: '28px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
    }}>
      <span style={{ fontSize: '32px', color: 'var(--danger)' }}>⚠</span>
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-base)' }}>{title}</p>
      {message && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{message}</p>}
      {onAction && (
        <button onClick={onAction} style={{
          marginTop: '8px', padding: '7px 16px', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
        }}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'No data', message }) {
  return (
    <div style={{
      border: '1px dashed var(--border-active)', borderRadius: '12px',
      padding: '40px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
    }}>
      <span style={{ fontSize: '32px', opacity: 0.3 }}>○</span>
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-base)' }}>{title}</p>
      {message && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{message}</p>}
    </div>
  );
}
