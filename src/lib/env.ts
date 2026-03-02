export type AppRole = 'admin' | 'manager';

export type AllowedUser = {
  email: string;
  password?: string;
  role: AppRole;
};

function mustStr(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value;
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
} {
  return {
    url: mustStr(import.meta.env.VITE_SUPABASE_URL),
    anonKey: mustStr(import.meta.env.VITE_SUPABASE_ANON_KEY),
  };
}

export function getAllowedUsers(): AllowedUser[] {
  const e = import.meta.env;
  const all: AllowedUser[] = [
    {
      email: mustStr(e.VITE_ADMIN_1_EMAIL),
      password: mustStr(e.VITE_ADMIN_1_PASSWORD) || undefined,
      role: 'admin',
    },
    {
      email: mustStr(e.VITE_ADMIN_2_EMAIL),
      password: mustStr(e.VITE_ADMIN_2_PASSWORD) || undefined,
      role: 'admin',
    },
    {
      email: mustStr(e.VITE_MANAGER_1_EMAIL),
      password: mustStr(e.VITE_MANAGER_1_PASSWORD) || undefined,
      role: 'manager',
    },
    {
      email: mustStr(e.VITE_MANAGER_2_EMAIL),
      password: mustStr(e.VITE_MANAGER_2_PASSWORD) || undefined,
      role: 'manager',
    },
  ];

  return all.filter((u) => Boolean(u.email));
}

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  return getAllowedUsers().some((u) => u.email.toLowerCase() === e);
}

export function resolveRoleByEmail(email: string): AppRole | null {
  const users = getAllowedUsers();
  const hit = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return hit?.role ?? null;
}

export function isAllowedCredential(email: string): boolean {
  // Login now uses email-only allowlist via isAllowedEmail().
  return isAllowedEmail(email);
}
