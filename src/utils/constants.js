/**
 * アプリ全体で共有する定数と、期データに関する軽量な純粋ヘルパー。
 *
 * 背景: 期の総数はゲーム上20期まで存在する（App.jsx の初期データ生成・
 * PriorPeriodCarryover の期切り替えUIが20期分ある）のに、同期ペイロード・
 * ダッシュボード集計・推移グラフが「1〜5期」をハードコードしており、
 * 第6期以降のデータが集計から無警告で欠落していた。
 * 期数の上限は必ずこの定数を参照すること。
 */
import { calculateFinancials } from './calculations';

// 期の総数（第1期〜第20期）
export const TOTAL_PERIODS = 20;

/**
 * 全期の ledger が空（＝ローカルデータが実質空）かどうかを判定する純粋関数。
 * サーバーへのフルバックアップ送信ガード（C1）で使用:
 * 実質空のローカルで backup を upsert すると、サーバー上の唯一の復元点を
 * 空データで潰してしまうため、このときは backup を送信しない。
 */
export function isAllLedgersEmpty(periods) {
  if (!periods) return true;
  return Object.values(periods).every(
    (p) => !p || !Array.isArray(p.ledger) || p.ledger.length === 0
  );
}

/**
 * 同期ペイロード用の期別サマリーを算出する純粋関数。
 * 第1期〜第TOTAL_PERIODS期のうち、currentPeriod 以下でデータが存在する期のみ含める。
 * （以前は [1..5] ハードコードで第6期以降が欠落していた）
 *
 * 戻り値: { [periodNumber]: { totalNetAssets, sales, profit, salesQty, averagePrice, cash, capital, retainedEarnings } }
 */
export function buildPeriodsSummary(periods, currentPeriod) {
  const periodsData = {};
  if (!periods) return periodsData;
  for (let p = 1; p <= TOTAL_PERIODS; p++) {
    if (p > currentPeriod) continue;
    const pData = periods[p];
    if (!pData) continue;
    const pResults = calculateFinancials(pData.carryover, pData.ledger, pData.actuals, p);
    const pSalesCount = pResults?.prod?.salesCount || 0;
    const pSalesRevenue = pResults?.pl?.salesRevenue || 0;
    periodsData[p] = {
      totalNetAssets: pResults?.bs?.totalNetAssets || 0,
      sales: pSalesRevenue,
      profit: pResults?.pl?.operatingProfit || 0,
      salesQty: pSalesCount,
      averagePrice: pSalesCount > 0 ? Math.round(pSalesRevenue / pSalesCount) : 0,
      cash: pResults?.bs?.cash || 0,
      capital: pResults?.bs?.capital || 0,
      retainedEarnings: pResults?.bs?.retainedEarnings || 0
    };
  }
  return periodsData;
}
