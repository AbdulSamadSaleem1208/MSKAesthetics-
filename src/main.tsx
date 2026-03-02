import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const isSupabase = url.includes('.supabase.co/') || url.includes('localhost:54321');
      if (isSupabase) {
        // eslint-disable-next-line no-console
        console.log('[fetch]', init?.method ?? 'GET', url);
      }
      const res = await originalFetch(input as RequestInfo, init);
      if (isSupabase) {
        // eslint-disable-next-line no-console
        console.log('[fetch]', res.status, url);
      }
      return res;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[fetch] failed', e);
      throw e;
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
