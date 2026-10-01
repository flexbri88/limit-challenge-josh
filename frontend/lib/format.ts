const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatCurrency(value: number): string {
  return currency.format(value);
}

/** API dates are plain `YYYY-MM-DD`; format in UTC so they never shift a day. */
export function formatDate(value: string | null | undefined, empty = '—'): string {
  if (!value) return empty;
  const date = new Date(`${value}T00:00:00Z`);
  // Values can come from the URL; show a malformed one as typed instead of throwing.
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function formatDaysAgo(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days.toLocaleString()} days ago`;
}
