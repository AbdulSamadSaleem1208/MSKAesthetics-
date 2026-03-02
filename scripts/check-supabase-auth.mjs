import fs from 'node:fs';

function readDotEnv(dotEnvPath) {
  const raw = fs.readFileSync(dotEnvPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

const env = readDotEnv(new URL('../.env', import.meta.url));
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const adminEmail = env.VITE_ADMIN_1_EMAIL;
const adminPassword = env.VITE_ADMIN_1_PASSWORD;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(2);
}

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log('Supabase URL:', url);

  // Health check
  {
    const res = await fetchWithTimeout(`${url}/auth/v1/health`, { headers: { apikey: anonKey } }, 8000);
    console.log('AUTH health status:', res.status);
    const text = await res.text();
    console.log('AUTH health body:', text.slice(0, 200));
  }

  // Token endpoint quick response test (intentionally wrong password)
  {
    const body = { email: 'admin1@mskaesthetics.com', password: '__wrong__password__' };
    const res = await fetchWithTimeout(
      `${url}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      8000,
    );
    console.log('AUTH token status:', res.status);
    const text = await res.text();
    console.log('AUTH token body:', text.slice(0, 300));
  }

  // Verify the real admin1 password from .env matches Supabase Auth (no token printed)
  if (adminEmail && adminPassword) {
    const res = await fetchWithTimeout(
      `${url}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      },
      8000,
    );
    console.log('AUTH token (admin1 from .env) status:', res.status);
    if (!res.ok) {
      const text = await res.text();
      console.log('AUTH token (admin1 from .env) error:', text.slice(0, 300));
    } else {
      console.log('AUTH token (admin1 from .env): OK (token omitted)');
    }
  } else {
    console.log('Skipping admin1 credential test (missing VITE_ADMIN_1_EMAIL/PASSWORD)');
  }
}

main().catch((e) => {
  console.error('FAILED:', e?.message ?? e);
  process.exit(1);
});
