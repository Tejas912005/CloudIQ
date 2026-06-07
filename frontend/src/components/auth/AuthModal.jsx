import { useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, Loader2, Lock, Mail, X } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { ScaleFade } from '../shared/Motion';

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const inputStyle = {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    padding: '12px 14px 12px 38px',
    fontSize: '14px',
    color: 'var(--text-base)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
  };

  return (
    <Motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        background: 'var(--backdrop-bg)',
        backdropFilter: 'blur(12px) saturate(150%)',
      }}
      onClick={onClose}
    >
      <ScaleFade
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '440px',
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-active)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 0 0 1px var(--surface), 0 24px 64px var(--modal-shadow), 0 0 80px var(--accent-glow)',
          position: 'relative',
        }}
      >
        <Motion.button
          onClick={onClose}
          className="btn-icon h-7 w-7 !p-0"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
          title="Close"
          type="button"
          whileHover={{ scale: 1.15, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          <X size={14} />
        </Motion.button>

        <div className="mb-8 text-center">
          <Motion.div
            className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-deep))' }}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.08 }}
          >
            <BrainCircuit className="h-5 w-5" style={{ color: 'var(--text-on-accent)' }} />
          </Motion.div>
          <h2 className="gradient-text text-[22px] font-bold">
            Welcome to CloudIQ
          </h2>
          <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
                onFocus={(event) => {
                  event.target.style.borderColor = 'var(--accent-border)';
                  event.target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
                }}
                onBlur={(event) => {
                  event.target.style.borderColor = 'var(--border)';
                  event.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                minLength={6}
                style={inputStyle}
                onFocus={(event) => {
                  event.target.style.borderColor = 'var(--accent-border)';
                  event.target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
                }}
                onBlur={(event) => {
                  event.target.style.borderColor = 'var(--border)';
                  event.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {error && (
            <Motion.div
              className="rounded-[10px] border px-3 py-2.5 text-[13px]"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                borderColor: 'var(--danger-border)',
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </Motion.div>
          )}

          <Motion.button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] text-sm font-semibold"
            style={{
              height: '44px',
              background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-richer))',
              color: 'var(--text-on-accent)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 16px var(--accent-glow)',
            }}
            whileHover={!loading ? { scale: 1.02, y: -1, boxShadow: '0 8px 28px var(--accent-glow)' } : {}}
            whileTap={!loading ? { scale: 0.98, y: 0 } : {}}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <>{isLogin ? 'Sign In' : 'Create Account'}<ArrowRight size={16} /></>
            }
          </Motion.button>
        </form>

        <div className="mt-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Motion.button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="font-semibold"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </Motion.button>
        </div>
      </ScaleFade>
    </Motion.div>
  );
}
