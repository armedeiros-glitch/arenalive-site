import { describe, expect, it, vi } from 'vitest';
import { CONDITION_LABELS, kmLabel, relativeTime } from '@/lib/sprint2/format';

describe('Sprint 2 presentation helpers', () => {
  it('labels approved conditions', () => expect(CONDITION_LABELS.used_original).toBe('Usada original'));
  it('formats distance without inventing values', () => {
    expect(kmLabel(null)).toBe('Distância não disponível');
    expect(kmLabel(8)).toContain('8');
  });
  it('formats recent opportunity time', () => {
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(relativeTime('2026-08-15T11:57:00Z')).toBe('há 3 min');
    vi.useRealTimers();
  });
});
