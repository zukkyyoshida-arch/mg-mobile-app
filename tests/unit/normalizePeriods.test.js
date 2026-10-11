import { describe, it, expect } from 'vitest';
import { normalizePeriods, createDefaultPeriodData, buildNextCarryover, TOTAL_PERIODS } from '../../src/utils/constants.js';
import { calculateFinancials, DEFAULT_PERIOD_DATA } from '../../src/utils/calculations.js';

const keysOf = (o) => Object.keys(o).map(Number).sort((a, b) => a - b);
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe('normalizePeriods', () => {
  it('null / undefined / 非オブジェクトでも20期分の初期データを返す', () => {
    for (const raw of [null, undefined, 'x', 3]) {
      const out = normalizePeriods(raw);
      expect(keysOf(out)).toEqual(range(TOTAL_PERIODS));
      expect(out[1]).toEqual(DEFAULT_PERIOD_DATA);
    }
  });

  it('旧データ（キー1〜5のみ）は20期分に補完され、第6期以降は初期データになる', () => {
    const old = {};
    for (let i = 1; i <= 5; i++) old[i] = createDefaultPeriodData();
    old[3].carryover.cash = 777;
    const out = normalizePeriods(old);
    expect(keysOf(out)).toEqual(range(TOTAL_PERIODS));
    expect(out[3].carryover.cash).toBe(777);
    for (let i = 6; i <= TOTAL_PERIODS; i++) {
      expect(out[i]).toEqual(DEFAULT_PERIOD_DATA);
    }
    // 補完した期を使っても計算が完走する（白画面の原因だった undefined 参照が無い）
    expect(() => calculateFinancials(out[6].carryover, out[6].ledger, out[6].actuals, 6)).not.toThrow();
  });

  it('欠損フィールドは初期値で補完し、既存値は上書きしない', () => {
    const raw = {
      1: { carryover: { cash: 50 }, ledger: [{ id: 'a', amount: 10 }] },
      2: { actuals: { actualCash: 12 }, ledger: 'broken' },
      3: null
    };
    const out = normalizePeriods(raw);
    const def = createDefaultPeriodData();
    expect(out[1].carryover.cash).toBe(50);
    expect(out[1].carryover.capital).toBe(def.carryover.capital);
    expect(out[1].ledger).toEqual([{ id: 'a', amount: 10 }]);
    expect(out[1].actuals).toEqual(def.actuals);
    expect(out[1].budget).toEqual(def.budget);
    expect(out[2].actuals.actualCash).toBe(12);
    expect(out[2].carryover).toEqual(def.carryover);
    expect(out[2].ledger).toEqual([]);
    expect(out[3]).toEqual(def);
  });

  it('完全な既存データは内容を変えずに返す（入力も破壊しない）', () => {
    const full = {};
    for (let i = 1; i <= TOTAL_PERIODS; i++) {
      const p = createDefaultPeriodData();
      p.carryover.cash = 100 + i;
      p.ledger = [{ id: `e${i}`, amount: i }];
      p.extraField = `keep-${i}`;
      full[i] = p;
    }
    const snapshot = JSON.parse(JSON.stringify(full));
    const out = normalizePeriods(full);
    expect(out).toEqual(snapshot);
    expect(full).toEqual(snapshot);
  });

  it('各期は独立したオブジェクト（参照共有しない）', () => {
    const out = normalizePeriods({});
    out[6].carryover.cash = 1;
    expect(out[7].carryover.cash).toBe(DEFAULT_PERIOD_DATA.carryover.cash);
    expect(DEFAULT_PERIOD_DATA.carryover.cash).toBe(300);
  });
});

describe('buildNextCarryover', () => {
  it('前期の決算結果から期首繰越を組み立てる（accruedLaborCost を含む）', () => {
    const p = createDefaultPeriodData();
    const r = calculateFinancials(p.carryover, p.ledger, p.actuals, 1);
    const next = buildNextCarryover(r);
    expect(next.cash).toBe(r.bs.cash);
    expect(next.capital).toBe(r.bs.capital);
    expect(next.retainedEarnings).toBe(r.bs.retainedEarnings);
    expect(next.machinesCount).toBe(r.machines.large + r.machines.small);
    expect(next).toHaveProperty('accruedLaborCost', r.bs.accruedLaborCost || 0);
  });
});
