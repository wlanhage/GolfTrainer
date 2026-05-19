import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDateTime, formatRelative, formatRelativeShort } from './format';

describe('formatDate', () => {
  it('handles invalid input', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('uses sv-SE locale', () => {
    const s = formatDate('2025-03-15');
    // sv-SE format: 2025-03-15
    expect(s).toMatch(/2025-03-15|2025\.\s?03\.\s?15/);
  });

  it('accepts Date object', () => {
    const s = formatDate(new Date('2025-03-15'));
    expect(s).not.toBe('-');
  });
});

describe('formatDateTime', () => {
  it('handles invalid', () => {
    expect(formatDateTime('bogus')).toBe('-');
  });

  it('returns date + time', () => {
    const s = formatDateTime('2025-03-15T14:30:00Z');
    expect(s).toMatch(/\d/);
  });
});

describe('formatRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('"nyss" inom en minut', () => {
    expect(formatRelative('2025-06-01T11:59:30Z')).toBe('nyss');
  });

  it('"för X min sen" inom en timme', () => {
    expect(formatRelative('2025-06-01T11:30:00Z')).toBe('för 30 min sen');
  });

  it('"för X timmar sen" inom en dag', () => {
    expect(formatRelative('2025-06-01T08:00:00Z')).toBe('för 4 timmar sen');
  });

  it('singular "timme" för exakt 1', () => {
    expect(formatRelative('2025-06-01T11:00:00Z')).toBe('för 1 timme sen');
  });

  it('"igår" 1-2 dagar bak', () => {
    expect(formatRelative('2025-05-31T11:00:00Z')).toBe('igår');
  });

  it('"för X dagar sen" inom en vecka', () => {
    expect(formatRelative('2025-05-28T12:00:00Z')).toBe('för 4 dagar sen');
  });

  it('faller tillbaka till datum efter en vecka', () => {
    const r = formatRelative('2025-05-20T12:00:00Z');
    expect(r).not.toMatch(/sen|igår|nyss/);
  });

  it('handles invalid date', () => {
    expect(formatRelative('not-a-date')).toBe('-');
  });
});

describe('formatRelativeShort', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('"idag" samma dag', () => {
    expect(formatRelativeShort('2025-06-01T08:00:00Z')).toBe('idag');
  });

  it('"igår" 1 dag tillbaka', () => {
    expect(formatRelativeShort('2025-05-31T12:00:00Z')).toBe('igår');
  });

  it('"för X dagar sen" inom vecka', () => {
    expect(formatRelativeShort('2025-05-29T12:00:00Z')).toBe('för 3 dagar sen');
  });

  it('faller tillbaka till datum efter vecka', () => {
    const r = formatRelativeShort('2025-05-20T12:00:00Z');
    expect(r).not.toMatch(/sen|igår|idag/);
  });
});
