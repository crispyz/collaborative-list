export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

export function parseDollars(input: string): number | null {
  // Accept both `.` and `,` as the decimal separator (US vs EU input habits).
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Convert a cents value to the dollar string used by the inline price input. */
export function priceToInput(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}
