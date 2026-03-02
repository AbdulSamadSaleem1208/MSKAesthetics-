import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

function toggleInputType(el: HTMLInputElement | null) {
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

export function AuthOverlay() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const outClass = useMemo(() => {
    return user ? 'out' : '';
  }, [user]);

  const doLogin = useCallback(async () => {
    if (busy) return;
    // eslint-disable-next-line no-console
    console.log('[Auth] doLogin clicked');
    setBusy(true);
    setErr('');
    const e = email.trim();
    const p = password;
    if (!e || !p) {
      setErr('Please enter email and password.');
      setBusy(false);
      return;
    }

    try {
      setErr('Signing in…');

      await signIn(e, p);
      setErr('');
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('[Auth] signIn failed', e2);
      const msg = e2 instanceof Error ? e2.message : 'Login failed.';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }, [busy, email, password, signIn]);

  return (
    <div id="auth" className={outClass}>
      <div className="auth-left">
        <div className="auth-grid"></div>
        <div className="o1 orb"></div>
        <div className="o2 orb"></div>
        <div className="o3 orb"></div>
        <div className="auth-brand" style={{ position: 'relative', zIndex: 2 }}>
          <div className="auth-logo">
            MSK<em>Aesthetics</em>
          </div>
          <div className="auth-tagline">
            MSK Aesthetics Inventory Management — precision in every unit.
          </div>
        </div>
        <div className="auth-feats">
          <div className="auth-feat">
            <div className="feat-dot"></div>
            <span className="feat-text">Real-time stock tracking across 6 products</span>
          </div>
          <div className="auth-feat">
            <div className="feat-dot"></div>
            <span className="feat-text">Multi-channel &amp; multi-city sales logging</span>
          </div>
          <div className="auth-feat">
            <div className="feat-dot"></div>
            <span className="feat-text">Automated reorder &amp; low-stock alerts</span>
          </div>
          <div className="auth-feat">
            <div className="feat-dot"></div>
            <span className="feat-text">Full configuration — products, channels, cities</span>
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-wrap">
          <div className="auth-title">Welcome back</div>
          <div className="auth-sub">Sign in to your MSK Aesthetics workspace</div>
          <div className={err ? 'auth-err show' : 'auth-err'} id="login-err">
            {err}
          </div>
          <div className="auth-field">
            <label>Email address</label>
            <div className="auth-inp-wrap">
              <svg
                className="inp-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                className="auth-inp"
                type="email"
                id="l-email"
                placeholder="you@mskaesthetics.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doLogin();
                }}
              />
            </div>
          </div>
          <div className="auth-field">
            <label>Password</label>
            <div className="auth-inp-wrap">
              <svg
                className="inp-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                className="auth-inp"
                type="password"
                id="l-pass"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doLogin();
                }}
              />
              <button
                className="inp-toggle"
                onClick={() => {
                  const el = document.getElementById('l-pass') as HTMLInputElement | null;
                  toggleInputType(el);
                }}
                tabIndex={-1}
                type="button"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
          <button className="auth-btn" type="button" onClick={() => void doLogin()} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
