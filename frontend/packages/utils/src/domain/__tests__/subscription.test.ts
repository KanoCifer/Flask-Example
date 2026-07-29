import { describe, it, expect } from 'vitest';
import {
  getMonthlyEstimate,
  getDaysUntil,
  formatPrice,
  toDateInputValue,
  upsertSubscription,
  getDefaultNextBillingDate,
  getCycleLabel,
  toStringArray,
  cycleOptions,
} from '../subscription';
import type { Subscription } from '@readinglist/types';

const makeSub = (overrides: Partial<Subscription>): Subscription => ({
  id: 1,
  name: 'Test',
  provider: 'Prov',
  price: 100,
  currency: 'USD',
  billing_cycle: 'monthly',
  next_billing_date: '2026-08-01',
  reminder_config: null,
  status: 'active',
  notes: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...overrides,
});

describe('getMonthlyEstimate', () => {
  it('monthly = price as-is', () => {
    expect(getMonthlyEstimate(makeSub({ billing_cycle: 'monthly', price: 120 }))).toBe(120);
  });
  it('yearly = price / 12', () => {
    expect(getMonthlyEstimate(makeSub({ billing_cycle: 'yearly', price: 120 }))).toBe(10);
  });
  it('quarterly = price / 3', () => {
    expect(getMonthlyEstimate(makeSub({ billing_cycle: 'quarterly', price: 30 }))).toBe(10);
  });
  it('weekly = price * 52 / 12', () => {
    expect(getMonthlyEstimate(makeSub({ billing_cycle: 'weekly', price: 12 }))).toBe(52);
  });
  it('daily = price * 30', () => {
    expect(getMonthlyEstimate(makeSub({ billing_cycle: 'daily', price: 2 }))).toBe(60);
  });
});

describe('formatPrice', () => {
  it('CNY → ¥', () => {
    expect(formatPrice(99.9, 'CNY')).toBe('¥99.90');
  });
  it('RMB → ¥', () => {
    expect(formatPrice(99.9, 'RMB')).toBe('¥99.90');
  });
  it('USD → $', () => {
    expect(formatPrice(99.9, 'USD')).toBe('$99.90');
  });
  it('EUR → €', () => {
    expect(formatPrice(99.9, 'EUR')).toBe('€99.90');
  });
  it('unknown → fallback', () => {
    expect(formatPrice(99.9, 'GBP')).toBe('GBP 99.90');
  });
});

describe('getDaysUntil', () => {
  it('returns 0 for invalid date', () => {
    expect(getDaysUntil('not-a-date')).toBe(0);
  });
  it('returns 0 for past date', () => {
    expect(getDaysUntil('2020-01-01')).toBe(0);
  });
});

describe('toDateInputValue', () => {
  it('extracts yyyy-mm-dd prefix', () => {
    expect(toDateInputValue('2026-08-15T12:00:00Z')).toBe('2026-08-15');
  });
  it('returns empty for invalid', () => {
    expect(toDateInputValue('invalid')).toBe('');
  });
});

describe('upsertSubscription', () => {
  it('updates matching id', () => {
    const items = [makeSub({ id: 1 }), makeSub({ id: 2 })];
    const result = upsertSubscription(items, makeSub({ id: 1, name: 'Updated' }));
    expect(result[0].name).toBe('Updated');
    expect(result[1].name).toBe('Test');
  });
});

describe('getDefaultNextBillingDate', () => {
  it('returns a yyyy-mm-dd string ~30 days out', () => {
    const v = getDefaultNextBillingDate();
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getCycleLabel', () => {
  it('maps known cycle', () => {
    expect(getCycleLabel('monthly')).toBe('月付');
  });
  it('falls back to raw value', () => {
    expect(getCycleLabel('weird')).toBe('weird');
  });
});

describe('toStringArray', () => {
  it('filters non-strings', () => {
    expect(toStringArray(['a', 1, 'b'])).toEqual(['a', 'b']);
  });
  it('returns [] for non-array', () => {
    expect(toStringArray('x')).toEqual([]);
  });
});

describe('cycleOptions', () => {
  it('has 5 entries', () => {
    expect(cycleOptions).toHaveLength(5);
  });
});
