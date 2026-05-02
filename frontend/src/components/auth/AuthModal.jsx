import { useEffect, useState } from 'react';
import { Mail, Lock, Loader2, ArrowRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import GlassPanel from '../shared/GlassPanel';

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin]     = useState(true);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Auto-close when Supabase reports a successful sign-in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          onClose();
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data?.session) {
          setError('Account created! Check your email to confirm before signing in.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Modal box — stop propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '420px', maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border-active)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          position: 'relative',
          animation: 'fadeInUp 0.2s ease',
        }}
      >
        {/* Close X button */}
        <button
          onClick={onClose}
          className="btn-icon h-7 w-7 !p-0"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
          title="Close"
        >
          <X size={15} />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
               style={{ border: '1px solid var(--accent-border)', background: 'var(--accent-soft)' }}>
            <Lock className="h-6 w-6" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {isLogin ? 'Sign in to access CloudIQ' : 'Join CloudIQ and automate your infrastructure'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-base)' }}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-dim)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: '100%', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--surface-2)', padding: '10px 12px 10px 36px',
                  fontSize: '14px', color: 'var(--text-base)', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-base)' }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-dim)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                style={{
                  width: '100%', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--surface-2)', padding: '10px 12px 10px 36px',
                  fontSize: '14px', color: 'var(--text-base)', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          {error && (
            <div style={{
              borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', padding: '10px 12px',
              fontSize: '13px', color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '8px', borderRadius: '8px', background: 'var(--accent)',
              color: '#060a14', padding: '10px 16px', fontSize: '14px', fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
            }}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <>{isLogin ? 'Sign In' : 'Create Account'}<ArrowRight size={16} /></>
            }
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ color: 'var(--accent)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
