import { describe, it, expect } from 'vitest';
import { TOTAL_PERIODS, isAllLedgersEmpty, buildPeriodsSummary } from '../../src/utils/constants.js';
import { DEFAULT_PERIOD_DATA, calculateFinancials } from '../../src/utils/calculations.js';
import { buildTrendData } from '../../src/components/TrendCharts.jsx';
import { computeOverallPlayer, getPeriodData } from '../../src/components/Dashboard.jsx';

// ---- テスト用ヘルパー ----

// まっさらな1期分データを都度複製して返す（参照汚染防止）
function freshPeriod() {
  return JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));
}

// 20期分の periods オブジェクトを生成し、指定期にだけ ledger を入れる
function buildPeriods(populatedLedgers = {}) {
  const periods = {};
  for (let i = 1; i <= TOTAL_PERIODS; i++) {
    periods[i] = freshPeriod();
  }
  Object.entries(populatedLedgers).forEach(([p, ledger]) => {
    periods[p].ledger = ledger;
  });
  return periods;
}

// 現金売上1件だけのシンプルな ledger
const SIMPLE_SALE_LEDGER = [{ category: 'キ', amount: 120, quantity: 3 }];

describe('constants.TOTAL_PERIODS', () => {
  it('期の総数は20（PriorPeriodCarryover の期選択UIと一致）', () => {
    expect(TOTAL_PERIODS).toBe(20);
  });
});

describe('constants.isAllLedgersEmpty (C1: 空ローカルでのbackup送信ガード)', () => {
  it('periods が null/undefined なら true', () => {
    expect(isAllLedgersEmpty(null)).toBe(true);
    expect(isAllLedgersEmpty(undefined)).toBe(true);
  });

  it('全期の ledger が空配列なら true（初期状態）', () => {
    expect(isAllLedgersEmpty(buildPeriods())).toBe(true);
  });

  it('どこか1期でも ledger に仕訳があれば false（第6期以降でも検知する）', () => {
    expect(isAllLedgersEmpty(buildPeriods({ 1: SIMPLE_SALE_LEDGER }))).toBe(false);
    expect(isAllLedgersEmpty(buildPeriods({ 6: SIMPLE_SALE_LEDGER }))).toBe(false);
    expect(isAllLedgersEmpty(buildPeriods({ 20: SIMPLE_SALE_LEDGER }))).toBe(false);
  });

  it('期データが欠けていても（null）落ちずに判定できる', () => {
    const periods = buildPeriods({ 3: SIMPLE_SALE_LEDGER });
    periods[2] = null;
    expect(isAllLedgersEmpty(periods)).toBe(false);
  });
});

describe('constants.buildPeriodsSummary (同期ペイロードの期別サマリー)', () => {
  it('第6期のデータが欠落しない（旧実装は[1..5]ハードコードで欠落していた）', () => {
    const periods = buildPeriods({ 1: SIMPLE_SALE_LEDGER, 6: SIMPLE_SALE_LEDGER });
    const summary = buildPeriodsSummary(periods, 6);

    expect(summary[6]).toBeDefined();
    // 値は calculateFinancials の結果と一致する
    const expected = calculateFinancials(periods[6].carryover, periods[6].ledger, periods[6].actuals, 6);
    expect(summary[6].sales).toBe(expected.pl.salesRevenue);
    expect(summary[6].totalNetAssets).toBe(expected.bs.totalNetAssets);
    expect(summary[6].profit).toBe(expected.pl.operatingProfit);
  });

  it('第20期まで含められる', () => {
    const periods = buildPeriods({ 20: SIMPLE_SALE_LEDGER });
    const summary = buildPeriodsSummary(periods, 20);
    expect(summary[20]).toBeDefined();
    expect(summary[20].sales).toBeGreaterThan(0);
  });

  it('currentPeriod より先の期は含めない（既存のゲーティングを維持）', () => {
    const periods = buildPeriods({ 1: SIMPLE_SALE_LEDGER, 6: SIMPLE_SALE_LEDGER });
    const summary = buildPeriodsSummary(periods, 3);
    expect(summary[1]).toBeDefined();
    expect(summary[6]).toBeUndefined();
  });

  it('periods が空/nullでも落ちずに空オブジェクトを返す', () => {
    expect(buildPeriodsSummary(null, 5)).toEqual({});
    expect(buildPeriodsSummary({}, 5)).toEqual({});
  });
});

describe('TrendCharts.buildTrendData (期別推移グラフ)', () => {
  it('第6期以降のデータもグラフに含まれる（旧実装は p<=5 で欠落していた）', () => {
    const periods = buildPeriods({ 2: SIMPLE_SALE_LEDGER, 6: SIMPLE_SALE_LEDGER, 20: SIMPLE_SALE_LEDGER });
    const data = buildTrendData(periods);
    const includedPeriods = data.map(d => d.period);
    expect(includedPeriods).toContain(2);
    expect(includedPeriods).toContain(6);
    expect(includedPeriods).toContain(20);
  });

  it('データが空の期は含まれない', () => {
    const periods = buildPeriods({ 6: SIMPLE_SALE_LEDGER });
    const data = buildTrendData(periods);
    expect(data.map(d => d.period)).toEqual([6]);
  });
});

describe('Dashboard.computeOverallPlayer (総合成績の集計)', () => {
  // 期別サマリー（サーバーの periods マップ相当）を組み立てる
  const periodSummary = (n) => ({
    totalNetAssets: 300 + n,
    sales: 100 * n,
    profit: 10 * n,
    salesQty: n
  });

  it('第6期以降のプレイヤーでも純資産が凍結せず・売上/利益が欠落しない', () => {
    const player = {
      id: 'p1',
      currentPeriod: 6,
      periods: { 1: periodSummary(1), 2: periodSummary(2), 3: periodSummary(3), 4: periodSummary(4), 5: periodSummary(5), 6: periodSummary(6) }
    };
    const result = computeOverallPlayer(player);

    // 売上・利益・販売数は第1〜6期の合算（旧実装は第6期が欠落していた）
    expect(result.sales).toBe(100 * (1 + 2 + 3 + 4 + 5 + 6));
    expect(result.profit).toBe(10 * (1 + 2 + 3 + 4 + 5 + 6));
    expect(result.salesQty).toBe(1 + 2 + 3 + 4 + 5 + 6);
    // 純資産は最新到達期（第6期）の値（旧実装は第5期末で凍結していた）
    expect(result.totalNetAssets).toBe(306);
    expect(result.displayPeriod).toBe('総合');
  });

  it('第20期まで集計できる', () => {
    const periods = {};
    for (let p = 1; p <= 20; p++) periods[p] = periodSummary(p);
    const player = { id: 'p1', currentPeriod: 20, periods };
    const result = computeOverallPlayer(player);
    expect(result.sales).toBe(100 * (20 * 21) / 2);
    expect(result.totalNetAssets).toBe(320);
  });

  it('periods を持たない旧形式プレイヤーはフラット値をそのまま使う（後方互換）', () => {
    const player = { id: 'legacy', currentPeriod: 2, sales: 500, profit: 50, salesQty: 5, totalNetAssets: 350 };
    const result = computeOverallPlayer(player);
    expect(result.sales).toBe(500);
    expect(result.totalNetAssets).toBe(350);
    expect(result.averagePrice).toBe(100);
  });

  it('5要素配列の旧形式 periods でも落ちずに第1〜5期を集計できる（後方互換）', () => {
    const player = {
      id: 'legacy-array',
      currentPeriod: 5,
      periods: [periodSummary(1), periodSummary(2), periodSummary(3), periodSummary(4), periodSummary(5)]
    };
    const result = computeOverallPlayer(player);
    expect(result.sales).toBe(100 * (1 + 2 + 3 + 4 + 5));
    expect(result.totalNetAssets).toBe(305);
  });
});

describe('Dashboard.getPeriodData (形式互換の期データ取り出し)', () => {
  it('マップ形式は数値キー・文字列キーの両方で引ける（第6期以降も）', () => {
    const player = { periods: { 6: { sales: 600 } } };
    expect(getPeriodData(player, 6)).toEqual({ sales: 600 });
    const playerStr = { periods: { '6': { sales: 600 } } };
    expect(getPeriodData(playerStr, 6)).toEqual({ sales: 600 });
  });

  it('存在しない期は null（範囲外アクセスで落ちない）', () => {
    expect(getPeriodData({ periods: { 1: {} } }, 15)).toBeNull();
    expect(getPeriodData({ periods: [1, 2, 3, 4, 5].map(() => ({})) }, 15)).toBeNull();
    expect(getPeriodData(null, 1)).toBeNull();
  });
});
