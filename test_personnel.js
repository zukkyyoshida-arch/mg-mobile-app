import { calculateFinancials, DEFAULT_PERIOD_DATA } from './src/utils/calculations.js';

console.log("=== 人員と減価償却のテスト開始 ===");

// 1. DEFAULT_PERIOD_DATA の確認
console.log("DEFAULT_PERIOD_DATA 初期人員:", DEFAULT_PERIOD_DATA.carryover.workers, "ワーカー /", DEFAULT_PERIOD_DATA.carryover.salesmen, "セールスマン");
console.log("DEFAULT_PERIOD_DATA 初期小型機械:", DEFAULT_PERIOD_DATA.carryover.smallMachines, "台 / 簿価:", DEFAULT_PERIOD_DATA.carryover.machinesValue, "万");

// 2. 1期期末処理前の計算 (1期の減価償却が 0 になっているか)
const p1ResultsBeforeEnd = calculateFinancials(DEFAULT_PERIOD_DATA.carryover, [], {}, 1);
console.log("1期 減価償却費 (期待値: 0):", p1ResultsBeforeEnd.machines.depreciation);
console.log("1期 期末機械簿価 (期待値: 300):", p1ResultsBeforeEnd.machines.endingValue);

// 3. 1期期末処理で、人員数を確定したと想定 (ワーカー3名、セールスマン2名)
// actuals に確定人数を記録
const p1Actuals = {
  actualWorkers: 3,
  actualSalesmen: 2
};
// 給与支払仕訳を追加 (hasProcessedPeriodEnd が true になるようにする)
const p1Ledger = [
  { id: "sal-w", category: "シ", quantity: 1, amount: 54 },
  { id: "sal-s", category: "セ", quantity: 1, amount: 36 },
  { id: "ins", category: "ソ", quantity: 1, amount: 60 }
];

const p1Results = calculateFinancials(DEFAULT_PERIOD_DATA.carryover, p1Ledger, p1Actuals, 1);
console.log("1期決算結果 - ワーカー数 (期待値: 3):", p1Results.workers);
console.log("1期決算結果 - セールスマン数 (期待値: 2):", p1Results.salesmen);

// 4. 2期目へ移行 (rollForwardFromPrevious)
const p2Carryover = {
  cash: p1Results.bs.cash,
  materialsCount: p1Results.mat.endingCount,
  materialsValue: p1Results.mat.endingValue,
  wipCount: p1Results.wip.endingCount,
  wipValue: p1Results.wip.endingValue,
  productCount: p1Results.prod.endingCount,
  productValue: p1Results.prod.endingValue,
  largeMachines: p1Results.machines.large,
  smallMachines: p1Results.machines.small,
  attachments: p1Results.machines.attachments,
  machinesCount: p1Results.machines.large + p1Results.machines.small,
  machinesValue: p1Results.bs.fixedAssets,
  loan: p1Results.bs.loans,
  receivables: p1Results.bs.receivables,
  payables: p1Results.bs.payables,
  taxes: p1Results.bs.unpaidTax,
  retainedEarnings: p1Results.bs.retainedEarnings,
  capital: p1Results.bs.capital,
  workers: p1Results.workers || 0,
  salesmen: p1Results.salesmen || 0
};

console.log("2期期首繰越 - ワーカー数 (期待値: 3):", p2Carryover.workers);
console.log("2期期首繰越 - セールスマン数 (期待値: 2):", p2Carryover.salesmen);

// 5. 2期の減価償却費の計算 (2期は減価償却が発生するはず。小型機械3台で 30万)
const p2Results = calculateFinancials(p2Carryover, [], {}, 2);
console.log("2期 減価償却費 (期待値: 30):", p2Results.machines.depreciation);
console.log("2期 期末機械簿価 (期待値: 270):", p2Results.machines.endingValue);
console.log("2期期末処理前 - ワーカー数 (期待値: 3):", p2Results.workers);
console.log("2期期末処理前 - セールスマン数 (期待値: 2):", p2Results.salesmen);
