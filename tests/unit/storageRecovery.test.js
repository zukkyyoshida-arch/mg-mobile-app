import { describe, it, expect } from 'vitest';
import {
  parsePeriodsText, loadPeriodsSafely, saveWithBackup, rotateBackups,
  findLatestValidBackup, setItemWithEviction, backupKeyOf, validatePeriod
} from '../../src/utils/storageRecovery.js';

const KEY = 'mg_periods_data';
function memStorage({ limit = Infinity } = {}) {
  const m = new Map();
  const size = () => [...m.values()].reduce((a, v) => a + v.length, 0);
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const cur = m.has(k) ? m.get(k).length : 0;
      if (size() - cur + v.length > limit) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k) => { m.delete(k); }
  };
}
const good = (n = 0) => JSON.stringify({ 1: { carryover: { cash: n }, ledger: [] }, 2: { ledger: [{ a: 1 }] } });

describe('parsePeriodsText / validatePeriod', () => {
  it('壊れたJSONは ok=false', () => {
    expect(parsePeriodsText('{oops').ok).toBe(false);
  });
  it('配列・プリミティブは全損扱い', () => {
    expect(parsePeriodsText('[1,2]').ok).toBe(false);
    expect(parsePeriodsText('"x"').ok).toBe(false);
  });
  it('壊れた期だけ隔離し他は使える', () => {
    const r = parsePeriodsText(JSON.stringify({ 1: { ledger: [] }, 2: { ledger: 'x' }, 3: null }));
    expect(r.ok).toBe(true);
    expect(Object.keys(r.periods)).toEqual(['1']);
    expect(Object.keys(r.badPeriods).sort()).toEqual(['2', '3']);
  });
  it('全期が不正なら全損', () => {
    expect(parsePeriodsText(JSON.stringify({ 1: 5 })).ok).toBe(false);
  });
  it('validatePeriod: 型不一致は不正', () => {
    expect(validatePeriod({ ledger: [1] })).toBe(false);
    expect(validatePeriod({ carryover: [] })).toBe(false);
    expect(validatePeriod({})).toBe(true);
  });
});

describe('loadPeriodsSafely', () => {
  it('未保存は empty で何も書かない', () => {
    const s = memStorage();
    expect(loadPeriodsSafely(s).status).toBe('empty');
    expect(s.m.size).toBe(0);
  });
  it('壊れたJSONは原文を mg_corrupt_ に退避し、元キーは上書きしない', () => {
    const s = memStorage();
    s.setItem(KEY, '{broken');
    const r = loadPeriodsSafely(s, KEY, new Date('2026-01-02T03:04:05.000Z'));
    expect(r.status).toBe('corrupt');
    expect(r.issue.blocking).toBe(true);
    expect(s.getItem(KEY)).toBe('{broken');
    expect(s.getItem('mg_corrupt_mg_periods_data_2026-01-02T03:04:05.000Z')).toBe('{broken');
  });
  it('スキーマ不一致の期は partial として隔離される', () => {
    const s = memStorage();
    s.setItem(KEY, JSON.stringify({ 1: { ledger: [] }, 2: { ledger: 9 } }));
    const r = loadPeriodsSafely(s);
    expect(r.status).toBe('partial');
    expect(r.issue.blocking).toBe(false);
    expect(r.issue.badPeriodNos).toEqual(['2']);
    expect(Object.keys(r.periods)).toEqual(['1']);
  });
  it('予備があれば hasBackup=true', () => {
    const s = memStorage();
    saveWithBackup(s, KEY, good(1));
    s.setItem(KEY, '{broken');
    expect(loadPeriodsSafely(s).issue.hasBackup).toBe(true);
  });
});

describe('世代の回転', () => {
  it('最新3世代だけが残り _1 が最新', () => {
    const s = memStorage();
    for (let i = 1; i <= 5; i++) saveWithBackup(s, KEY, good(i));
    expect(s.getItem(backupKeyOf(KEY, 1))).toBe(good(5));
    expect(s.getItem(backupKeyOf(KEY, 2))).toBe(good(4));
    expect(s.getItem(backupKeyOf(KEY, 3))).toBe(good(3));
    expect(s.getItem(backupKeyOf(KEY, 4))).toBeNull();
  });
  it('同一内容では回転しない', () => {
    const s = memStorage();
    saveWithBackup(s, KEY, good(1));
    saveWithBackup(s, KEY, good(1));
    expect(s.getItem(backupKeyOf(KEY, 2))).toBeNull();
  });
  it('最新が壊れていれば次の世代から復元', () => {
    const s = memStorage();
    s.setItem(backupKeyOf(KEY, 1), '{bad');
    s.setItem(backupKeyOf(KEY, 2), good(7));
    const b = findLatestValidBackup(s, KEY);
    expect(b.generation).toBe(2);
    expect(b.periods[1].carryover.cash).toBe(7);
  });
  it('正常な予備がなければ null', () => {
    expect(findLatestValidBackup(memStorage(), KEY)).toBeNull();
  });
});

describe('容量超過', () => {
  it('古い世代から消して再試行し保存できる', () => {
    const v = good(1);
    const s = memStorage({ limit: v.length * 3 + 5 });
    s.setItem(backupKeyOf(KEY, 3), 'x'.repeat(v.length));
    s.setItem(backupKeyOf(KEY, 2), 'y'.repeat(v.length));
    s.setItem(backupKeyOf(KEY, 1), 'z'.repeat(v.length));
    expect(setItemWithEviction(s, KEY, v, KEY)).toBe(true);
    expect(s.getItem(KEY)).toBe(v);
    expect(s.getItem(backupKeyOf(KEY, 3))).toBeNull();
  });
  it('どうしても入らなければ saved=false を返す', () => {
    const s = memStorage({ limit: 5 });
    expect(saveWithBackup(s, KEY, good(1)).saved).toBe(false);
  });
  it('rotateBackups: 容量ぎりぎりでも最新世代を確保する', () => {
    const v = good(1);
    const s = memStorage({ limit: v.length * 2 });
    s.setItem(KEY, v);
    expect(rotateBackups(s, KEY, v)).toBe(true);
    expect(s.getItem(backupKeyOf(KEY, 1))).toBe(v);
  });
});
