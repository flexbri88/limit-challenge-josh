import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDaysAgo } from './format';

describe('formatDate', () => {
  it('formats API dates without shifting them across time zones', () => {
    // Parsed as UTC midnight and formatted in UTC, so it is never "Dec 31".
    expect(formatDate('2025-01-01')).toBe('Jan 1, 2025');
  });

  it('returns malformed input as is instead of throwing', () => {
    // e.g. /vehicles?maintained_from=abc, or a 5-digit year typed in a date input.
    expect(formatDate('abc')).toBe('abc');
    expect(formatDate('20255-01-01')).toBe('20255-01-01');
  });

  it('shows a placeholder for missing dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined, 'Never')).toBe('Never');
  });
});

describe('formatCurrency', () => {
  it('formats US dollars with cents', () => {
    expect(formatCurrency(81250.5)).toBe('$81,250.50');
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatDaysAgo', () => {
  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [400, '400 days ago'],
    [1500, '1,500 days ago'],
  ])('%i -> %s', (days, expected) => {
    expect(formatDaysAgo(days)).toBe(expected);
  });
});
