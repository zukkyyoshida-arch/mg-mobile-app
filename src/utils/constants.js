/**
 * アプリ全体で共有する定数と、期データに関する軽量な純粋ヘルパー。
 *
 * 背景: 期の総数はゲーム上20期まで存在する（App.jsx の初期データ生成・
 * PriorPeriodCarryover の期切り替えUIが20期分ある）のに、同期ペイロード・
 * ダッシュボード集計・推移グラフが「1〜5期」をハードコードしており、
 * 第6期以降のデータが集計から無警告で欠落していた。
 * 期数の上限は必ずこの定数を参照すること。
 */
import { calculateFinancials, DEFAULT_PERIOD_DATA } from './calculations';

// 期の総数（第1期〜第20期）
export const TOTAL_PERIODS = 20;

/**
 * 1期ぶんの初期データを新しいオブジェクトとして生成する純粋ヘルパー。
 * DEFAULT_PERIOD_DATA を直接使い回すと参照共有で全期が連動して壊れるため、必ずこれを使う。
 */
export function createDefaultPeriodData() {
  return JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));
}

/**
 * periods オブジェクトの欠損期・欠損フィールドを初期値で補完する純粋関数。
 *
 * 背景: 20期対応以前の旧データ（キー1〜5のみ）を localStorage やサーバーバックアップから
 * 読み込んだ端末で第6期以降を選ぶと、periods[currentPeriod] が undefined のまま
 * スプレッド・参照されて TypeError（白画面）になっていた。
 * 起動時ロード・サーバー復元・リセット取り消しの入口でこの関数を通すことで、
 * どの期を選んでも必ず完全な期データが存在する状態を保証する。
 *
 * - 期が丸ごと無い → 初期データで生成
 * - 期はあるが carryover/ledger/actuals/budget が欠けている → 欠けたフィールドだけ初期値で補完
 *   （既存の値は一切上書きしない）
 */
export function normalizePeriods(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalized = {};
  for (let i = 1; i <= TOTAL_PERIODS; i++) {
    const p = source[i];
    if (!p || typeof p !== 'object') {
      normalized[i] = createDefaultPeriodData();
      continue;
    }
    const def = createDefaultPeriodData();
    normalized[i] = {
      ...p,
      carryover: {
        ...def.carryover,
        ...(p.carryover && typeof p.carryover === 'object' ? p.carryover : {})
      },
      ledger: Array.isArray(p.ledger) ? p.ledger : [],
      actuals: {
        ...def.actuals,
        ...(p.actuals && typeof p.actuals === 'object' ? p.actuals : {})
      },
      budget: {
        ...def.budget,
        ...(p.budget && typeof p.budget === 'object' ? p.budget : {})
      }
    };
  }
  return normalized;
}

/**
 * 前期の決算計算結果（calculateFinancials の戻り値）から、翌期の期首繰越データを組み立てる純粋関数。
 * App.jsx の「前期データを引き継ぐ」（rollForwardFromPrevious）で使用する。
 *
 * accruedLaborCost（未払給与・社会保険料）も含める:
 * 前期が期末処理（給与支払）未実施の場合、費用は繰越利益剰余金へ反映済みなのに
 * 負債側の未払費用だけが引き継ぎで消えると、翌期以降ずっと B/S 不一致が残るため。
 * 期末処理済みなら 0 になる。calculations.js の C/F 計算（accruedExpenseChange）が
 * carryover.accruedLaborCost を参照しており、その供給元もこの関数になる。
 */
export function buildNextCarryover(prevResults) {
  const prevBS = prevResults.bs;
  const prevMat = prevResults.mat;
  const prevWip = prevResults.wip;
  const prevProd = prevResults.prod;
  const prevMach = prevResults.machines;

  return {
    // 現金
    cash: prevBS.cash,
    // 棚卸資産
    materialsCount: prevMat.endingCount,
    materialsValue: prevMat.endingValue,
    wipCount: prevWip.endingCount,
    wipValue: prevWip.endingValue,
    productCount: prevProd.endingCount,
    productValue: prevProd.endingValue,
    // 機械設備
    largeMachines: prevMach.large,
    smallMachines: prevMach.small,
    attachments: prevMach.attachments,
    machinesCount: prevMach.large + prevMach.small,
    machinesValue: prevBS.fixedAssets,
    // 負債
    loan: prevBS.loans,
    receivables: prevBS.receivables,
    payables: prevBS.payables,
    taxes: prevBS.unpaidTax,                        // 未払法人税等
    accruedLaborCost: prevBS.accruedLaborCost || 0, // 未払給与・社会保険料（期末処理未実施の場合のみ>0）
    // 純資産
    retainedEarnings: prevBS.retainedEarnings,
    capital: prevBS.capital,
    // 人員
    workers: prevResults.workers || 0,
    salesmen: prevResults.salesmen || 0
  };
}

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

/**
 * 期末処理ウィザードが確定済みかどうかを ledger から判定する純粋関数。
 * ウィザード（PeriodEndWizard）が書き込む仕訳には periodEnd: true フラグが付く
 * （2026-08-11 A2修正で導入）ため、その存在で「この期は期末処理済み」と判定する。
 * PeriodEndWizard の再実行ガード（給与シ・セ・保険料ソの二重計上防止）で使用。
 */
export function hasPeriodEndEntries(ledger) {
  if (!Array.isArray(ledger)) return false;
  return ledger.some((entry) => entry && entry.periodEnd === true);
}
