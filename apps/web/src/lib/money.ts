export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

export function parseDollars(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
