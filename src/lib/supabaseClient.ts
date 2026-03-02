import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

const { url, anonKey } = getSupabaseConfig();

// eslint-disable-next-line no-console
console.log('[Supabase] URL:', url || '(missing, using local fallback)');

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Using local fallback (http://localhost:54321).',
  );
}

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'anon-key-not-set', {
  auth: {
    storage: (() => {
      // Some browser setups/extensions block or break localStorage.
      // Supabase auth can hang if storage throws, so we fall back to memory.
      try {
        const k = '__sb_storage_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return window.localStorage;
      } catch {
        const mem = new Map<string, string>();
        return {
          getItem: (key: string) => (mem.has(key) ? mem.get(key)! : null),
          setItem: (key: string, value: string) => {
            mem.set(key, value);
          },
          removeItem: (key: string) => {
            mem.delete(key);
          },
        };
      }
    })(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

if (import.meta.env.DEV) {
  (window as unknown as { supabase?: typeof supabase }).supabase = supabase;
}
