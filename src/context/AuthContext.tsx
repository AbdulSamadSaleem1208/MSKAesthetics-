import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseConfig, isAllowedEmail, resolveRoleByEmail, type AppRole } from '../lib/env';
import { supabase } from '../lib/supabaseClient';

export type AuthUser = {
  id: string;
  email: string;
  role: AppRole;
  name: string;
};

type AuthContextValue = {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function roleFromSession(session: Session | null): AppRole | null {
  if (!session) return null;
  const raw = (session.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (raw === 'admin' || raw === 'manager') return raw;
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateUser = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    if (!newSession?.user?.email) {
      setUser(null);
      return;
    }

    const email = newSession.user.email;
    const role = roleFromSession(newSession) ?? resolveRoleByEmail(email) ?? 'manager';

    // Best-effort: set a default name immediately, then try to load name from app_users.
    const fallbackName = role === 'admin' ? 'Admin' : 'Manager';
    setUser({ id: newSession.user.id, email, role, name: fallbackName });

    try {
      const namePromise = supabase.from('app_users').select('name').eq('id', newSession.user.id).maybeSingle();
      const timed = await Promise.race([
        namePromise,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('name lookup timeout')), 4000)),
      ]);
      const { data } = timed as { data?: { name?: string | null } | null };
      if (data?.name) {
        setUser({ id: newSession.user.id, email, role, name: data.name });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await hydrateUser(data.session);
      } catch {
        if (!mounted) return;
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      try {
        await hydrateUser(newSession);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrateUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isAllowedEmail(email)) {
      throw new Error('This email is not allowed.');
    }

    // NOTE: In some browser setups, supabase-js signInWithPassword can hang.
    // We perform the password grant manually via fetch, then hydrate supabase-js with setSession.
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) {
      throw new Error('Supabase URL/key missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const t0 = performance.now();
    // eslint-disable-next-line no-console
    console.log('[Auth] signIn start', email);

    const withTimeout = async <T,>(label: string, p: Promise<T>, ms: number): Promise<T> => {
      const started = performance.now();
      try {
        const out = await Promise.race([
          p,
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
          ),
        ]);
        // eslint-disable-next-line no-console
        console.log('[Auth]', label, 'ok', `${Math.round(performance.now() - started)}ms`);
        return out as T;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[Auth]', label, 'failed', e);
        throw e;
      }
    };

    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await withTimeout(
        'token fetch',
        fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        }),
        10_000,
      );

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const msg =
          (typeof json.msg === 'string' && json.msg) ||
          (typeof json.error_description === 'string' && json.error_description) ||
          (typeof json.error === 'string' && json.error) ||
          `Login failed (${res.status})`;
        throw new Error(msg);
      }

      const access_token = typeof json.access_token === 'string' ? json.access_token : '';
      const refresh_token = typeof json.refresh_token === 'string' ? json.refresh_token : '';
      if (!access_token || !refresh_token) {
        throw new Error('Login succeeded but tokens were missing.');
      }

      const { data: sess, error: setErr } = await withTimeout(
        'setSession',
        supabase.auth.setSession({ access_token, refresh_token }),
        10_000,
      );
      if (setErr) throw setErr;
      if (!sess.session) {
        throw new Error('Login succeeded but session could not be established.');
      }

      const actorId = sess.session.user.id;

      await withTimeout('hydrateUser', hydrateUser(sess.session), 6_000);

      // Best-effort auth activity log (never block login)
      void (async () => {
        try {
          await supabase
            .from('activity_logs')
            .insert({ type: 'auth', message: 'Logged in', actor_id: actorId });
        } catch {
          // ignore
        }
      })();

      // eslint-disable-next-line no-console
      console.log('[Auth] signIn done', `${Math.round(performance.now() - t0)}ms`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error('Login request aborted (timeout).');
      }
      throw e;
    } finally {
      window.clearTimeout(t);
    }
  }, [hydrateUser]);

  const signOut = useCallback(async () => {
    const actor = session?.user?.id;
    if (actor) {
      void (async () => {
        try {
          await supabase.from('activity_logs').insert({ type: 'auth', message: 'Logged out', actor_id: actor });
        } catch {
          // ignore
        }
      })();
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user, loading, signIn, signOut }),
    [session, user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext missing');
  return ctx;
}
