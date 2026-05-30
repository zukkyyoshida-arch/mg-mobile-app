/**
 * 戦略MG（製造業）計算エンジン
 * スプレッドシートの全ての仕訳・在庫棚卸・原価計算・決算書（P/L, B/S, C/F）ロジックを完全再現します。
 */

// 勘定科目の定義
export const CATEGORIES = {
  // 入金系 (Inflow)
  "ネ": { label: "売掛・売上", type: "inflow", color: "pink", symbol: "ネ", isCash: false, shortName: "売掛", actionName: "製品の掛売" },
  "ア": { label: "売掛金入金", type: "inflow", color: "pink", symbol: "ア", shortName: "回収", actionName: "売掛金の回収" },
  "イ": { label: "機械売却", type: "inflow", color: "pink", symbol: "イ", shortName: "売却", actionName: "機械の売却" },
  "エ": { label: "受取保険金", type: "inflow", color: "pink", symbol: "エ", shortName: "保険", actionName: "保険金の受取" },
  "オ": { label: "借入金", type: "inflow", color: "pink", symbol: "オ", shortName: "借入", actionName: "資金の借入" },
  "カ": { label: "資本金増加", type: "inflow", color: "pink", symbol: "カ", shortName: "増資", actionName: "資本金の増加" },
  "キ": { label: "現金売上", type: "inflow", color: "pink", symbol: "キ", shortName: "売上", actionName: "製品の現金販売" },
  
  // 出金系 (Outflow)
  "ケ": { label: "機械工具購入", type: "outflow", color: "purple", symbol: "ケ", shortName: "機械", actionName: "機械の購入" },
  "コ": { label: "材料投入費", type: "outflow", color: "green", symbol: "コ", shortName: "投入", actionName: "材料の投入" },
  "サ": { label: "完成費", type: "outflow", color: "green", symbol: "サ", shortName: "完成", actionName: "製品の完成" },
  "生産": { label: "投入・完成", type: "outflow", color: "green", symbol: "生産", isCash: true, shortName: "生産", actionName: "投入から完成まで" },
  "シ": { label: "労務費", type: "outflow", color: "blue", symbol: "シ", shortName: "労務", actionName: "ワーカー給与支払" },
  "ス": { label: "製造経費", type: "outflow", color: "blue", symbol: "ス", shortName: "製造", actionName: "製造経費支払" },
  "セ": { label: "販売費", type: "outflow", color: "blue", symbol: "セ", shortName: "販売", actionName: "セールス給与・広告費支払" },
  "ソ": { label: "一般管理費", type: "outflow", color: "blue", symbol: "ソ", shortName: "管理", actionName: "保険・その他経費支払" },
  "給与": { label: "給与・保険料 (期末自動)", type: "outflow", color: "blue", symbol: "給与", isCash: true, shortName: "給与", actionName: "給与・保険一括支払" },
  "採用": { label: "採用 (ワーカー・セールスマン)", type: "outflow", color: "blue", symbol: "採用", isCash: true, shortName: "採用", actionName: "スタッフの採用" },
  "保険": { label: "保険", type: "outflow", color: "blue", symbol: "保険", isCash: true, shortName: "保険", actionName: "保険の購入" },
  "MD": { label: "マーチャンダイザー", type: "outflow", color: "blue", symbol: "MD", isCash: true, shortName: "販促", actionName: "マーチャンダイザー" },
  "リサーチ": { label: "マーケットリサーチ", type: "outflow", color: "blue", symbol: "リサーチ", isCash: true, shortName: "調査", actionName: "マーケットリサーチ" },
  "PAC": { label: "PAC生産性", type: "outflow", color: "blue", symbol: "PAC", isCash: true, shortName: "改善", actionName: "PAC（生産性向上）" },
  "緑チップ": { label: "緑チップ購入 (PAC/MD/リサーチ)", type: "outflow", color: "blue", symbol: "緑チップ", isCash: true, shortName: "戦力", actionName: "緑チップの購入" },
  "配置転換": { label: "配置転換", type: "outflow", color: "blue", symbol: "配置", isCash: true, shortName: "配置", actionName: "スタッフの配置転換" },
  "火災": { label: "火災 (材料ロス)", type: "outflow", color: "red", symbol: "火災", isCash: false, shortName: "火災", actionName: "火災による材料喪失" },
  "製造ミス": { label: "製造ミス (仕掛品ロス)", type: "outflow", color: "red", symbol: "ミス", isCash: false, shortName: "ミス", actionName: "製造ミスによる仕掛品喪失" },
  "盗難": { label: "盗難 (製品ロス)", type: "outflow", color: "red", symbol: "盗難", isCash: false, shortName: "盗難", actionName: "盗難による製品喪失" },
  "棚卸ロス(材料)": { label: "材料紛失ロス", type: "outflow", color: "red", symbol: "特損", isCash: false, shortName: "材料ロス", actionName: "棚卸時の材料紛失" },
  "棚卸ロス(仕掛品)": { label: "仕掛品紛失ロス", type: "outflow", color: "red", symbol: "特損", isCash: false, shortName: "仕掛ロス", actionName: "棚卸時の仕掛品紛失" },
  "棚卸ロス(製品)": { label: "製品紛失ロス", type: "outflow", color: "red", symbol: "特損", isCash: false, shortName: "製品ロス", actionName: "棚卸時の製品紛失" },
  "タ": { label: "営業外費用", type: "outflow", color: "blue", symbol: "タ", shortName: "外費", actionName: "営業外費用の支払" },
  "チ": { label: "研究開発費", type: "outflow", color: "blue", symbol: "チ", shortName: "研究", actionName: "研究開発の実行" },
  "ツ": { label: "材料現金仕入", type: "outflow", color: "green", symbol: "ツ", shortName: "材料", actionName: "材料の現金仕入" },
  "ノ": { label: "材料買掛仕入", type: "outflow", color: "green", symbol: "ノ", isCash: false, shortName: "掛買", actionName: "材料の買掛仕入" },
  "ナ": { label: "借入金返済", type: "outflow", color: "yellow", symbol: "ナ", shortName: "返済", actionName: "借入金の返済" },
  "ニ": { label: "納税", type: "outflow", color: "yellow", symbol: "ニ", shortName: "納税", actionName: "法人税の納付" },
  "ヌ": { label: "買掛金支払", type: "outflow", color: "yellow", symbol: "ヌ", shortName: "支払", actionName: "買掛金の支払" },
  "期首処理": { label: "期首一括処理", type: "outflow", color: "yellow", symbol: "期首", isCash: true, shortName: "期首", actionName: "期首処理" },
  "売掛割引": { label: "売掛割引 (5%)", type: "inflow", color: "pink", symbol: "割引", isCash: true, shortName: "割引", actionName: "売掛金の割引" },
  "リスクカード": { label: "リスクカード", type: "outflow", color: "purple", symbol: "リスク", isCash: false, shortName: "事故", actionName: "リスク発生" },
  "退職": { label: "退職", type: "outflow", color: "red", symbol: "退職", isCash: false, shortName: "退職", actionName: "スタッフの退職" },
  "研究開発失敗": { label: "研究開発失敗", type: "outflow", color: "red", symbol: "失敗", isCash: false, shortName: "失敗", actionName: "研究開発の失敗" }
};

// 期別の給料・社会保険料テーブル (period は 1〜5)
export const SALARY_TABLE = {
  // 通常給料 (1人あたり、ワーカー・セールスマン共通)
  normal:    { 1: 18, 2: 20, 3: 23, 4: 25, 5: 28 },
  // 退職時給料 (1人あたり、退職費5万とは別)
  severance: { 1: 12, 2: 14, 3: 17, 4: 19, 5: 22 },
  // 社会保険料 (1人あたり、期中最大人数 × この単価)
  insurance: { 1: 12, 2: 13, 3: 14, 4: 16, 5: 17 }
};

/**
 * 初期状態（第1期のデフォルト値など）
 */
export const DEFAULT_PERIOD_DATA = {
  carryover: {
    cash: 300,              // ⑬現金
    materialsCount: 0,      // ⑧材料個数
    materialsValue: 0,      // ⑧材料金額
    wipCount: 0,            // ⑯仕掛品個数
    wipValue: 0,            // ⑯仕掛品金額
    productCount: 0,        // ⑧製品個数
    productValue: 0,        // ⑧製品金額
    machinesCount: 0,       // ⑭機械台数 (合計)
    machinesValue: 0,       // ⑭機械金額 (合計)
    loan: 0,                // ⑰借入金
    receivables: 0,         // ⑱売掛金
    payables: 0,            // ⑲買掛金
    retainedEarnings: 0,    // ㉒繰越利益剰余金
    capital: 300,           // 資本金 (初期値300)
    
    // 機械内訳
    largeMachines: 0,       // 大型機械台数
    smallMachines: 0,       // 小型機械台数
    attachments: 0,         // アタッチメント数
    
    // 人員
    workers: 0,             // ワーカー数
    salesmen: 0             // セールスマン数
  },
  ledger: [],               // 現金出納帳
  actuals: {
    actualCash: 300,
    actualMaterials: 0,
    actualWip: 0,
    actualProduct: 0,
    fireCount: 0,           // 火災（材料）
    missCount: 0,           // 製造ミス（仕掛品）
    theftCount: 0           // 盗難（製品）
  },
  budget: {
    targetG: 0,             // 目標G
    // 固定費予算
    laborBudget: 0,
    manufacturingBudget: 0,
    depreciationBudget: 0,
    salesBudget: 0,
    adminBudget: 0,
    nonOperatingBudget: 0,
    rdBudget: 0
  }
};

/**
 * 帳簿データを元にすべての数値を再計算するメイン関数
 */
export function calculateFinancials(carryover, ledger, actuals, period = 1) {
  // 期番号を1〜5にクランプ
  const periodKey = Math.min(5, Math.max(1, Number(period) || 1));
  // 1. 現金の出入金集計
  let cashInflow = 0;
  let cashOutflow = 0;
  
  // 出納帳カテゴリ別の集計
  const ledgerTotals = {};
  Object.keys(CATEGORIES).forEach(k => {
    ledgerTotals[k] = { amount: 0, quantity: 0 };
  });

  // 事故災害・保険の時系列シミュレーション用変数
  let currentMatCount = carryover.materialsCount || 0;
  let currentWipCount = carryover.wipCount || 0;
  let currentProdCount = carryover.productCount || 0;
  let insuranceChips = 0;
  let totalFireCount = 0;
  let totalMissCount = 0;
  let totalTheftCount = 0;
  let autoInsurancePayout = 0;

  ledger.forEach(entry => {
    const amt = Number(entry.amount) || 0;
    const qty = Number(entry.quantity) || 0;
    const cat = entry.category;
    
    // 時系列の在庫・保険追跡
    switch(cat) {
        case "ツ":
        case "ノ": {
          currentMatCount += qty;
          break;
        }
        case "コ": {
          currentMatCount -= qty;
          currentWipCount += qty;
          break;
        }
        case "サ": {
          currentWipCount -= qty;
          currentProdCount += qty;
          break;
        }
        case "キ":
        case "ネ": {
          currentProdCount -= qty;
          break;
        }
        case "保険": {
          insuranceChips += qty;
          break;
        }
        case "火災": {
          const lostMat = Math.max(0, currentMatCount);
          if (lostMat > 0) {
            totalFireCount += lostMat;
            currentMatCount = 0;
            if (insuranceChips > 0) {
              autoInsurancePayout += lostMat * 8;
            }
          }
          if (insuranceChips > 0) {
            insuranceChips -= 1;
          }
          break;
        }
        case "製造ミス": {
          const missQty = qty > 0 ? qty : 1;
          const lostWip = Math.min(Math.max(0, currentWipCount), missQty);
          if (lostWip > 0) {
            totalMissCount += lostWip;
            currentWipCount -= lostWip;
          }
          break;
        }
        case "盗難": {
          const theftQty = qty > 0 ? qty : 2;
          const lostProd = Math.min(Math.max(0, currentProdCount), theftQty);
          if (lostProd > 0) {
            totalTheftCount += lostProd;
            currentProdCount -= lostProd;
            if (insuranceChips > 0) {
              autoInsurancePayout += lostProd * 10;
            }
          }
          if (insuranceChips > 0) {
            insuranceChips -= 1;
          }
          break;
        }
        case "棚卸ロス(材料)": {
          const lostMat = Math.min(Math.max(0, currentMatCount), qty);
          if (lostMat > 0) {
            totalFireCount += lostMat;
            currentMatCount -= lostMat;
          }
          break;
        }
        case "棚卸ロス(仕掛品)": {
          const lostWip = Math.min(Math.max(0, currentWipCount), qty);
          if (lostWip > 0) {
            totalMissCount += lostWip;
            currentWipCount -= lostWip;
          }
          break;
        }
        case "棚卸ロス(製品)": {
          const lostProd = Math.min(Math.max(0, currentProdCount), qty);
          if (lostProd > 0) {
            totalTheftCount += lostProd;
            currentProdCount -= lostProd;
          }
          break;
        }
      }

    if (CATEGORIES[cat]) {
      ledgerTotals[cat].amount += amt;
      ledgerTotals[cat].quantity += qty;
      
      const isCashTransaction = CATEGORIES[cat].isCash !== false;
      if (isCashTransaction) {
        if (CATEGORIES[cat].type === "inflow") {
          cashInflow += Math.abs(amt);
        } else {
          cashOutflow += Math.abs(amt);
        }
      }
    }
  });

  // 保険の自動支払いを現金流入に加算
  cashInflow += autoInsurancePayout;

  // 人員の集計（期首 + 採用 + 配置転換）と最大人数追跡（社会保険料用）
  let totalWorkersHired = carryover.workers || 0;
  let totalSalesmenHired = carryover.salesmen || 0;
  let maxTotalStaff = totalWorkersHired + totalSalesmenHired; // 期中最大人数
  let totalSeveranceWorkers = 0;  // 退職ワーカー合計
  let totalSeveranceSalesmen = 0; // 退職セールスマン合計

  ledger.forEach(entry => {
    if (entry.category === "採用" || entry.category === "配置転換") {
      totalWorkersHired += Number(entry.workersHired) || 0;
      totalSalesmenHired += Number(entry.salesmenHired) || 0;
      
      const currentTotal = totalWorkersHired + totalSalesmenHired;
      if (currentTotal > maxTotalStaff) maxTotalStaff = currentTotal;
    }
    if (entry.category === "退職") {
      const resignedWorkers = Number(entry.workersResigned) || 0;
      const resignedSalesmen = Number(entry.salesmenResigned) || 0;
      totalWorkersHired -= resignedWorkers;
      totalSalesmenHired -= resignedSalesmen;
      totalSeveranceWorkers += resignedWorkers;
      totalSeveranceSalesmen += resignedSalesmen;
    }
  });

  // --- 期中予測（ハイブリッド）給与・保険料計算 ---
  // 期末処理を行う前でも「給与を払ったら経常利益がいくらになるか」をPLに反映するための予測計算
  const hiresWorkers = ledger.reduce((sum, e) => e.category === '採用' ? sum + (Number(e.workersHired) || 0) : sum, 0);
  const hiresSalesmen = ledger.reduce((sum, e) => e.category === '採用' ? sum + (Number(e.salesmenHired) || 0) : sum, 0);
  
  // 今期採用したワーカーやセールスマンも含めて、期中予測では給与を計上する
  const staffForSalaryWorkers = totalWorkersHired;
  const staffForSalarySalesmen = totalSalesmenHired;
  
  const salaryUnit_early    = SALARY_TABLE.normal[periodKey] || 0;
  const severanceUnit_early = SALARY_TABLE.severance[periodKey] || 0;
  const insuranceUnit_early = SALARY_TABLE.insurance[periodKey] || 0;
  
  const estimatedWorkerSalary = staffForSalaryWorkers * salaryUnit_early;
  const estimatedWorkerSeverance = totalSeveranceWorkers * severanceUnit_early;
  const estimatedSalesmanSal = staffForSalarySalesmen * salaryUnit_early;
  const estimatedSalesmanSev = totalSeveranceSalesmen * severanceUnit_early;
  const estimatedInsurance = maxTotalStaff * insuranceUnit_early;

  // 出納帳に「シ」「セ」「ソ」が1件でもあれば、期末処理済み（または個別支払い済み）とみなす
  const actualWorkerSalary = ledgerTotals["シ"]?.amount || 0;
  const actualSalesmanSal = ledgerTotals["セ"]?.amount || 0;
  const actualInsurance = ledgerTotals["ソ"]?.amount || 0;

  const hasProcessedPeriodEnd = actualWorkerSalary > 0 || actualSalesmanSal > 0 || actualInsurance > 0;

  // PL用の最終的な給与・保険料
  // 期末処理前：推定値を使う
  // 期末処理後：出納帳の実績値を使う（二重計上を防ぐ）
  const plWorkerSalary    = hasProcessedPeriodEnd ? actualWorkerSalary : (estimatedWorkerSalary + estimatedWorkerSeverance);
  const plSalesmanSalary  = hasProcessedPeriodEnd ? actualSalesmanSal  : (estimatedSalesmanSal + estimatedSalesmanSev);
  const plInsurance       = hasProcessedPeriodEnd ? actualInsurance    : estimatedInsurance;

// 現金残高 = 期首 + 入金 - 出金（人件費は現金流出に含めない。ただし損益計算書の費用としては計上）
const bookEndingCash = carryover.cash + cashInflow - cashOutflow;

  // 2. 在庫・原価計算 (材料 -> 仕掛品 -> 製品)
  
  // A. 材料 (Materials)
  const matBeginningCount = carryover.materialsCount || 0;
  const matBeginningValue = carryover.materialsValue || 0;
  const matPurchaseCount = ledgerTotals["ツ"].quantity + (ledgerTotals["ノ"]?.quantity || 0);
  const matPurchaseValue = ledgerTotals["ツ"].amount + (ledgerTotals["ノ"]?.amount || 0);
  
  const matTotalCount = matBeginningCount + matPurchaseCount;
  const matTotalValue = matBeginningValue + matPurchaseValue;
  
  // 平均単価（表示用のみ。B/S計算には比例配分を使用）
  const matUnitCost = matTotalCount > 0 ? Math.round(matTotalValue / matTotalCount) : 0;
  
  // 投入 (コ) → 比例配分で計算し誤差を排除
  const matInputCount = ledgerTotals["コ"].quantity;
  const matInputValue = matTotalCount > 0
    ? Math.round((matInputCount / matTotalCount) * matTotalValue)
    : 0;
  
  // 事故災害：火災 (材料) → 比例配分
  const fireCount = totalFireCount;
  const matFireValue = matTotalCount > 0
    ? Math.round((fireCount / matTotalCount) * matTotalValue)
    : 0;
  
  // 材料の次期繰越 (理論値) → 差引きで正確に計算
  const matEndingCount = matTotalCount - matInputCount - fireCount;
  const matEndingValue = Math.max(0, matTotalValue - matInputValue - matFireValue);

  // B. 仕掛品 (Work-in-Progress)
  const wipBeginningCount = carryover.wipCount || 0;
  const wipBeginningValue = carryover.wipValue || 0;
  
  // WIPへのインプット：材料投入金額 + 投入費(コ) + 完成費(サ) の支払金額
  const wipInputCount = matInputCount; 
  const wipInputValue = matInputValue + ledgerTotals["コ"].amount + ledgerTotals["サ"].amount; // 材料費 + 投入加工費 + 完成加工費
  
  const wipTotalCount = wipBeginningCount + wipInputCount;
  const wipTotalValue = wipBeginningValue + wipInputValue;
  
  const wipUnitCost = wipTotalCount > 0 ? Math.round(wipTotalValue / wipTotalCount) : 0;
  
  // 完成 (サ の生産個数) → 比例配分で計算
  const wipCompletedCount = ledgerTotals["サ"].quantity;
  const wipCompletedValue = wipTotalCount > 0
    ? Math.round((wipCompletedCount / wipTotalCount) * wipTotalValue)
    : 0;
  
  // 事故災害：製造ミス (仕掛品) → 比例配分
  const missCount = totalMissCount;
  const wipMissValue = wipTotalCount > 0
    ? Math.round((missCount / wipTotalCount) * wipTotalValue)
    : 0;
  
  // 仕掛品の次期繰越 (理論値) → 差引きで正確に計算
  const wipEndingCount = wipTotalCount - wipCompletedCount - missCount;
  const wipEndingValue = Math.max(0, wipTotalValue - wipCompletedValue - wipMissValue);

  // C. 製品 (Finished Goods)
  const prodBeginningCount = carryover.productCount || 0;
  const prodBeginningValue = carryover.productValue || 0;
  const prodCompletedCount = wipCompletedCount;
  const prodCompletedValue = wipCompletedValue;
  
  const prodTotalCount = prodBeginningCount + prodCompletedCount;
  const prodTotalValue = prodBeginningValue + prodCompletedValue;
  
  const prodUnitCost = prodTotalCount > 0 ? Math.round(prodTotalValue / prodTotalCount) : 0;
  
  // 売上個数 (キ + ネ の合計個数) → 比例配分で計算
  const salesCount = ledgerTotals["キ"].quantity + ledgerTotals["ネ"].quantity;
  const cogsValue = prodTotalCount > 0
    ? Math.round((salesCount / prodTotalCount) * prodTotalValue)
    : 0; // 売上原価
  
  // 事故災害：盗難 (製品) → 比例配分
  const theftCount = totalTheftCount;
  const prodTheftValue = prodTotalCount > 0
    ? Math.round((theftCount / prodTotalCount) * prodTotalValue)
    : 0;
  
  // 製品の次期繰越 (理論値) → 差引きで正確に計算
  const prodEndingCount = prodTotalCount - salesCount - theftCount;
  const prodEndingValue = Math.max(0, prodTotalValue - cogsValue - prodTheftValue);

  // 3. 機械資産の計算
  // 減価償却費の決定 (大型機械・小型機械・アタッチメントの台数に基づく固定費)
  // 機械内訳は、期首＋購入（ケ の数量）−売却（イ の数量）
  // 簡略化のため、機械の台数は前期繰越に「ケ」で買った分を加算、売却「イ」を減算
  let newLargeMachines = 0;
  let newSmallMachines = 0;
  let newAttachments = 0;

  ledger.forEach(entry => {
    if (entry.category === "ケ") {
      newLargeMachines += entry.largeMachines || 0;
      newSmallMachines += entry.smallMachines || 0;
      newAttachments += entry.attachments || 0;
    }
    // TODO: 売却（イ）でどの機械を売ったかのトラッキングは未実装のため今回は加算のみ
  });

  const largeMachines = (carryover.largeMachines || 0) + newLargeMachines;
  const smallMachines = (carryover.smallMachines || 0) + newSmallMachines;
  const attachments = (carryover.attachments || 0) + newAttachments;
  
  // 生産能力(PAC)の計算
  // ワーカーの稼働割り当て（大型優先）
  let remainingWorkersForPac = totalWorkersHired;
  let operatingLarge = Math.min(largeMachines, remainingWorkersForPac); // 大型機械は1台につきワーカー1人必要
  remainingWorkersForPac -= operatingLarge;
  let operatingSmall = Math.min(smallMachines, remainingWorkersForPac); // 小型機械も1台につきワーカー1人必要

  let productionCapacity = 0;
  productionCapacity += operatingLarge * 4; // 大型機械の基本生産能力: 4
  productionCapacity += operatingSmall * 1; // 小型機械の基本生産能力: 1
  
  // アタッチメント効果: 小型機械1台につき+1 (最大は稼働中の小型機械の台数まで)
  const effectiveAttachments = Math.min(attachments, operatingSmall);
  productionCapacity += effectiveAttachments * 1;
  
  // PACチップの効果: 稼働中の各機械につき+1
  const hasPAC = ledger.some(entry => entry.category === "PAC");
  if (hasPAC) {
    productionCapacity += operatingLarge * 1;
    productionCapacity += operatingSmall * 1;
  }

  // 減価償却費 (大型: 20/台, 小型: 10/台, アタッチメント: 2/台)
  const depreciation = (largeMachines * 20) + (smallMachines * 10) + (attachments * 2);
  
  // 購入された機械工具 (ケ)
  const purchasedMachineValue = ledgerTotals["ケ"].amount;
  // 機械資産の期末残高 (理論値)
  // 期首金額 + 新規購入 - 減価償却 (機械売却による資産減は帳簿上は簡易化するため売却額を引かない。※売却益として処理済みのため引くと二重マイナスになる)
  const bookEndingMachines = Math.max(0, carryover.machinesValue + purchasedMachineValue - depreciation);

  // 4. P/L (変動損益計算書) の計算
  const salesRevenue = ledgerTotals["キ"].amount + ledgerTotals["ネ"].amount; // 売上高 PQ
  const variableCost = cogsValue; // 売上原価 vPQ (変動費)
  const margin = salesRevenue - variableCost; // 付加価値 mPQ
  const marginRatio = salesRevenue > 0 ? (margin / salesRevenue) * 100 : 0; // m率
  
  // 固定費 F (シ, ス, セ, ソ, タ, チ + 減価償却)
  // 注: サ(完成費)、コ(投入費)、ツ(材料)、ケ(機械)、ナ(借入返済)、ニ(納税)、ヌ(買掛支払)は固定費ではない

  // ── 人件費の参照（上で計算済みの変数を再利用） ──
  // 以前の変数を後方互換性のため維持
  const workerSalary    = estimatedWorkerSalary;
  const workerSeverance = estimatedWorkerSeverance;
  const autoLaborCost   = plWorkerSalary;
  const salesmanSalary    = estimatedSalesmanSal;
  const salesmanSeverance = estimatedSalesmanSev;
  const autoSalesmanCost  = plSalesmanSalary;
  const autoInsuranceCost = plInsurance;

  // 労務費 = 期中推定 or 出納帳実績 (シ)
  const laborCost = plWorkerSalary;
  const manufacturingFixed = ledgerTotals["ス"].amount + depreciation + (ledgerTotals["PAC"] ? ledgerTotals["PAC"].amount : 0);
  
  // 販売費 = 期中推定 or 出納帳実績 (セ) + リサーチ
  const salesCost = plSalesmanSalary + (ledgerTotals["リサーチ"] ? ledgerTotals["リサーチ"].amount : 0);
  
  // 一般管理費: 期中推定 or 出納帳実績 (ソ) + 「採用」+ 「保険チップ」+ 「MD」+ 「配置転換」
  const adminCost = plInsurance 
    + (ledgerTotals["採用"] ? ledgerTotals["採用"].amount : 0) 
    + (ledgerTotals["保険"] ? ledgerTotals["保険"].amount : 0)
    + (ledgerTotals["MD"] ? ledgerTotals["MD"].amount : 0)
    + (ledgerTotals["配置転換"] ? ledgerTotals["配置転換"].amount : 0);
    
  const rdCost = ledgerTotals["チ"].amount;
  const nonOperatingCost = ledgerTotals["タ"].amount;
  
  const fixedCost = laborCost + manufacturingFixed + salesCost + adminCost + rdCost + nonOperatingCost; // 固定費合計 F
  
  const operatingProfit = margin - fixedCost; // 経常利益 G
  const fmRatio = margin > 0 ? (fixedCost / margin) * 100 : 0; // f/m比率

  // 特別損益 (災害損失 + 受取保険金など)
  // 事故災害損失 = 火災金額 + 製造ミス金額 + 盗難金額
  const accidentLoss = matFireValue + wipMissValue + prodTheftValue;
  const extraordinaryLoss = accidentLoss;
  // 保険金(自動算出) + 保険金(エの手入力分) + 機械売却収入
  const extraordinaryGain = autoInsurancePayout + ledgerTotals["エ"].amount + ledgerTotals["イ"].amount;
  const extraordinaryProfit = extraordinaryGain - extraordinaryLoss;

  const profitBeforeTax = operatingProfit + extraordinaryProfit; // 税引前当期純利益

  // 法人税等の計算
  // ルール: 前期繰越利益剰余金がマイナスで合計(税引前＋前期繰越)がプラスなら合計の50%。
  // 前期繰越利益剰余金がプラスなら税引前当期純利益の50%。
  const priorRetained = carryover.retainedEarnings || 0;
  const totalTaxBase = profitBeforeTax + priorRetained;
  let corporateTax = 0;
  
  if (profitBeforeTax > 0) {
    if (priorRetained < 0) {
      corporateTax = totalTaxBase > 0 ? Math.round(totalTaxBase * 0.3) : 0;
    } else {
      corporateTax = Math.round(profitBeforeTax * 0.3);
    }
  }

  // 支払いが7万円以下になる場合や赤字の場合は一律で7万円
  if (corporateTax <= 7) {
    corporateTax = 7;
  }

  const netProfit = profitBeforeTax - corporateTax; // 当期純利益
  const endingRetained = priorRetained + netProfit; // 次期繰越利益剰余金

  // 5. B/S (貸借対照表) の計算
  const endingCash = bookEndingCash;
  // 売掛金: 期首 + 新規売掛発生(ネ) - 回収(ア) - 売掛割引
  const endingReceivables = Math.max(0, carryover.receivables + ledgerTotals["ネ"].amount - ledgerTotals["ア"].amount - ledgerTotals["売掛割引"].amount);
  
  // 買掛金: 期首 + 新規材料買掛仕入(ノ) - 支払(ヌ)
  const endingPayables = Math.max(0, carryover.payables + (ledgerTotals["ノ"]?.amount || 0) - ledgerTotals["ヌ"].amount);
  
  // 借入金: 期首 + 新規借入(オ) - 返済(ナ)
  const endingLoans = Math.max(0, carryover.loan + ledgerTotals["オ"].amount - ledgerTotals["ナ"].amount);
  
  // 資産合計
  const totalCurrentAssets = endingCash + endingReceivables + matEndingValue + wipEndingValue + prodEndingValue;
  const totalFixedAssets = bookEndingMachines;
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  // 負債合計
  const unpaidTax = corporateTax; // 未払法人税
  
  // ハイブリッドPL予測による未払給与・社会保険料の計上
  // 期末処理前の場合、予想利益としてすでにPLから引かれているため、同額を未払金として負債に計上しB/Sを一致させる
  const accruedLaborCost = hasProcessedPeriodEnd ? 0 : (estimatedWorkerSalary + estimatedWorkerSeverance + estimatedSalesmanSal + estimatedSalesmanSev + estimatedInsurance);
  
  const totalLiabilities = endingPayables + endingLoans + unpaidTax + accruedLaborCost;

  // 純資産合計
  const endingCapital = carryover.capital + ledgerTotals["カ"].amount; // 資本金
  const totalNetAssets = endingCapital + endingRetained;

  // 各種チップと人員の実効数
  const activeRdChips = Math.max(0, Math.floor(ledgerTotals["チ"].amount / 20) - (ledgerTotals["研究開発失敗"]?.quantity || 0) - (ledgerTotals["研究開発成功"]?.quantity || 0));
  const activeAdChips = Math.floor(ledgerTotals["セ"].amount / 5);
  
  const purchasedIns = ledgerTotals["保険"]?.quantity || 0;
  const usedIns = ledger.filter(tx => tx.category === '特別利益' && tx.customName?.includes('保険金')).length;
  const activeInsuranceChips = Math.max(0, purchasedIns - usedIns);

  const activeMdChips = ledgerTotals["MD"]?.quantity || 0;
  const activePacChips = ledgerTotals["PAC"]?.quantity || 0;
  const activeResearchChips = ledgerTotals["リサーチ"]?.quantity || 0;
  const activeGenericGreenChips = ledgerTotals["緑チップ"]?.quantity || 0;
  
  const activeGreenChips = activeGenericGreenChips + activeMdChips + activePacChips + activeResearchChips;
  
  const activeSalesmen = totalSalesmenHired;
  const activeWorkers = totalWorkersHired;
  
  const totalLiabilitiesAndNetAssets = totalLiabilities + totalNetAssets;

  // B/S不一致（バランスエラー）のチェック
  const bsDifference = Math.abs(totalAssets - totalLiabilitiesAndNetAssets);

  // 6. C/F (キャッシュフロー計算書)
  // 営業キャッシュフロー
  const operatingCF = 
    profitBeforeTax 
    + depreciation 
    - (endingReceivables - carryover.receivables) 
    - (matEndingValue - matBeginningValue) 
    - (wipEndingValue - wipBeginningValue) 
    - (prodEndingValue - prodBeginningValue) 
    + (endingPayables - carryover.payables)
    - ledgerTotals["ニ"].amount; // 納税出金
  
  // 投資キャッシュフロー
  const investingCF = extraordinaryGain - purchasedMachineValue; // 売却/保険収入 - 新規購入
  
  // 財務キャッシュフロー
  const financingCF = ledgerTotals["カ"].amount + ledgerTotals["オ"].amount - ledgerTotals["ナ"].amount; // 資本金増 + 新規借入 - 返済
  
  const freeCF = operatingCF + investingCF;
  const totalCF = freeCF + financingCF;

  // 評価ランク (経営戦略分析用)
  let evaluationRank = "C";
  if (operatingProfit >= 500) evaluationRank = "S";
  else if (operatingProfit >= 200) evaluationRank = "A";
  else if (operatingProfit >= 50) evaluationRank = "B";

  return {
    bookEndingCash,
    cashInflow,
    cashOutflow,
    
    // 原価・在庫
    mat: {
      beginningCount: matBeginningCount,
      beginningValue: matBeginningValue,
      purchaseCount: matPurchaseCount,
      purchaseValue: matPurchaseValue,
      totalCount: matTotalCount,
      totalValue: matTotalValue,
      unitCost: matUnitCost,
      inputCount: matInputCount,
      inputValue: matInputValue,
      fireCount: fireCount,
      fireValue: matFireValue,
      endingCount: matEndingCount,
      endingValue: matEndingValue
    },
    wip: {
      beginningCount: wipBeginningCount,
      beginningValue: wipBeginningValue,
      inputCount: wipInputCount,
      inputValue: wipInputValue,
      totalCount: wipTotalCount,
      totalValue: wipTotalValue,
      unitCost: wipUnitCost,
      completedCount: wipCompletedCount,
      completedValue: wipCompletedValue,
      missCount: missCount,
      missValue: wipMissValue,
      endingCount: wipEndingCount,
      endingValue: wipEndingValue
    },
    prod: {
      beginningCount: prodBeginningCount,
      beginningValue: prodBeginningValue,
      completedCount: prodCompletedCount,
      completedValue: prodCompletedValue,
      totalCount: prodTotalCount,
      totalValue: prodTotalValue,
      unitCost: prodUnitCost,
      salesCount: salesCount,
      cogsValue: cogsValue,
      theftCount: theftCount,
      theftValue: prodTheftValue,
      endingCount: prodEndingCount,
      endingValue: prodEndingValue
    },
    
    // 機械情報
    machines: {
      large: largeMachines,
      small: smallMachines,
      attachments: attachments,
      purchased: purchasedMachineValue,
      depreciation: depreciation,
      endingValue: bookEndingMachines
    },

    // P/L項目
    pl: {
      salesRevenue,
      variableCost,
      margin,
      marginRatio,
      fixedCost,
      laborCost,
      // 労務費内訳
      workerSalary,
      workerSeverance,
      autoLaborCost,
      manufacturingFixed,
      salesCost,
      // 販売費内訳
      salesmanSalary,
      salesmanSeverance,
      autoSalesmanCost,
      adminCost,
      // 一般管理費内訳
      autoInsuranceCost,
      maxTotalStaff,
      rdCost,
      nonOperatingCost,
      operatingProfit,
      fmRatio,
      extraordinaryGain,
      extraordinaryLoss,
      extraordinaryProfit,
      profitBeforeTax,
      corporateTax,
      netProfit,
      endingRetained
    },

    // B/S項目
    bs: {
      cash: endingCash,
      receivables: endingReceivables,
      materialsValue: matEndingValue,
      wipValue: wipEndingValue,
      productValue: prodEndingValue,
      totalCurrentAssets,
      fixedAssets: bookEndingMachines,
      totalAssets,
      
      payables: endingPayables,
      loans: endingLoans,
      unpaidTax: unpaidTax,
      accruedLaborCost: accruedLaborCost,
      totalLiabilities,
      
      capital: endingCapital,
      retainedEarnings: endingRetained,
      totalNetAssets,
      totalLiabilitiesAndNetAssets,
      difference: bsDifference
    },

    // C/F項目
    cf: {
      operatingCF,
      investingCF,
      financingCF,
      freeCF,
      totalCF
    },
    
    activeRdChips,
    activeAdChips,
    activeInsuranceChips,
    activeMdChips,
    activePacChips,
    activeResearchChips,
    activeGenericGreenChips,
    activeGreenChips,
    activeWorkers,
    activeSalesmen,
    
    endingReceivables,
    endingPayables,
    endingLoans,
    totalCurrentAssets,
    totalFixedAssets,
    totalAssets,
    totalLiabilities,
    totalEquity: totalNetAssets,
    workers: activeWorkers,
    salesmen: activeSalesmen,
    productionCapacity: productionCapacity,
    rank: evaluationRank
  };
}

/**
 * 予定計画 (Budget) の計算ロジック
 */
export function calculateBudget(budget, carryover) {
  const G = Number(budget.targetG) || 0;
  
  // 固定費合計
  const F = 
    (Number(budget.laborBudget) || 0) +
    (Number(budget.manufacturingBudget) || 0) +
    (Number(budget.depreciationBudget) || 0) +
    (Number(budget.salesBudget) || 0) +
    (Number(budget.adminBudget) || 0) +
    (Number(budget.nonOperatingBudget) || 0) +
    (Number(budget.rdBudget) || 0);

  // 必要MQ = G + F
  const requiredMQ = G + F;
  
  return {
    fixedCostTotal: F,
    requiredMQ
  };
}
