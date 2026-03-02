export function pkr(v: number | string | null | undefined): string {
  return 'PKR ' + Number(v || 0).toLocaleString();
}

export function num(v: number | string | null | undefined): string {
  return Number(v || 0).toLocaleString();
}

export function pct(v: number | null | undefined): string {
  return Math.round(Number(v || 0) * 100) + '%';
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export function initials(name: string): string {
  const init = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return init || 'U';
}
