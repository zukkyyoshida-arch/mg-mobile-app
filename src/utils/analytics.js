/**
 * 経営分析ロジック（PVMQ、戦略投資の集計）
 */

export function calculateAnalytics(ledger, results) {
  // P, V, M, Q の集計用
  let totalSalesQty = 0;
  let totalSalesAmount = 0;
  
  let totalPurchaseQty = 0;
  let totalPurchaseAmount = 0;

  // 戦略投資・ロスの集計用
  let adInvestmentAmount = 0;
  let adInvestmentQty = 0;
  
  let rdInvestmentAmount = 0;
  let rdInvestmentQty = 0;
  
  let equipmentInvestmentAmount = 0;
  let machineCount = 0;

  let lossQty = 0;
  let factoringCost = 0;

  let adSalesAmount = 0;
  let adSalesQty = 0;
  let rdSalesAmount = 0;
  let rdSalesQty = 0;
  let completedQty = 0;

  // 全トランザクションを走査
  ledger.forEach(entry => {
    // 1. 販売（キ・ネ）
    if (entry.category === "キ" || entry.category === "ネ") {
      totalSalesQty += entry.quantity || 0;
      totalSalesAmount += entry.amount || 0;
      
      if (entry.usedAd) {
        adSalesQty += entry.quantity || 0;
        adSalesAmount += entry.amount || 0;
      }
      if (entry.usedRD) {
        rdSalesQty += entry.quantity || 0;
        rdSalesAmount += entry.amount || 0;
      }
    }
    
    // 2. 仕入（ツ・ノ）
    if (entry.category === "ツ" || entry.category === "ノ") {
      totalPurchaseQty += entry.quantity || 0;
      totalPurchaseAmount += entry.amount || 0;
    }

    // 3. 広告投資（セ ※クレーム処理などを除外するためカスタム名で判定）
    if (entry.category === "セ" && entry.customShortName === "広告") {
      adInvestmentAmount += entry.amount || 0;
      adInvestmentQty += entry.quantity || 1; 
    }

    // 4. 研究開発投資（チ）
    if (entry.category === "チ") {
      rdInvestmentAmount += entry.amount || 0;
      rdInvestmentQty += entry.quantity || 1;
    }

    // 5. 設備投資（ケ）
    if (entry.category === "ケ") {
      equipmentInvestmentAmount += entry.amount || 0;
      machineCount += (entry.largeMachines || 0) + (entry.smallMachines || 0) + (entry.attachments || 0);
    }

    // 6. 各種ロス（火災、製造ミス、盗難）
    if (["火災", "製造ミス", "盗難"].includes(entry.category)) {
      if (entry.category !== "火災") {
        lossQty += entry.quantity || 1;
      }
    }

    // 7. 売掛割引
    if (entry.category === "売掛割引") {
      factoringCost += entry.amount || 0;
    }
    
    // 8. 製品の完成 (サ)
    if (entry.category === "サ") {
      completedQty += entry.quantity || 0;
    }
  });

  if (results?.mat?.fireCount) {
    lossQty += results.mat.fireCount;
  }

  // --- KPI の算出 ---
  
  // P, V, M, Q
  const P = totalSalesQty > 0 ? (totalSalesAmount / totalSalesQty) : 0;
  const V = totalPurchaseQty > 0 ? (totalPurchaseAmount / totalPurchaseQty) : 0;
  const M = P - V;
  const Q = totalSalesQty;

  const actualMQ = results?.pl?.margin || 0;
  const F = results?.pl?.fixedCost || 0;
  const G = results?.pl?.operatingProfit || 0;

  // 目標達成シミュレーション (BEPと安全余裕度)
  // BEP数量 = F / M (Mが0以下の場合は計算不可)
  let bepQty = M > 0 ? Math.ceil(F / M) : null;
  let remainingForBEP = null;
  let safetyMargin = 0;
  
  if (bepQty !== null) {
    if (Q < bepQty) {
      remainingForBEP = bepQty - Q;
    } else {
      safetyMargin = actualMQ - F;
    }
  }

  // 工場稼働率 (PAC Utilization)
  const maxCapacity = results?.productionCapacity || 0;
  const capacityUtilization = maxCapacity > 0 ? Math.round((completedQty / maxCapacity) * 100) : 0;

  // 総合ランクの判定
  let rank = "C";
  const netAssets = results?.totalEquity || 0;
  
  if (G > 0 && netAssets >= 300) {
    rank = "S";
  } else if (G > 0) {
    rank = "A";
  } else if (netAssets > 0) {
    rank = "B";
  }

  // --- 高度なKPI（資金繰り・在庫・値決め） ---

  // 1. m率（マージン率）
  const mRatio = P > 0 ? Math.round((M / P) * 100) : 0;

  // 2. 在庫の「死に金」合計（材料 + 仕掛品 + 製品）
  const deadStockValue = 
    (results?.bs?.materialsValue || 0) + 
    (results?.bs?.wipValue || 0) + 
    (results?.bs?.productValue || 0);

  // 3. 次期首の資金繰り診断
  const currentCash = results?.bs?.cash || 0;
  const payables = results?.bs?.payables || 0;
  const unpaidTax = results?.bs?.unpaidTax || 0;
  // MGでは通常、次期首に借入金の利息を払うか、借入金の一部を返すなどが必要な場合があるが、
  // 最低限「買掛金」と「未払法人税等」は払う必要がある。
  const nextPeriodInitialCosts = payables + unpaidTax;
  const nextPeriodCashShortfall = currentCash < nextPeriodInitialCosts ? (nextPeriodInitialCosts - currentCash) : 0;

  return {
    rank,
    P,
    V,
    M,
    Q,
    mRatio,
    totals: {
      salesAmount: totalSalesAmount,
      salesQty: totalSalesQty,
      purchaseAmount: totalPurchaseAmount,
      purchaseQty: totalPurchaseQty
    },
    financials: {
      MQ: actualMQ,
      F,
      G
    },
    simulation: {
      bepQty,
      remainingForBEP,
      safetyMargin,
      nextPeriodCashShortfall,
      deadStockValue,
      currentCash,
      nextPeriodInitialCosts
    },
    investments: {
      ads: { 
        amount: adInvestmentAmount, 
        count: adInvestmentQty, 
        active: results?.activeAdChips || 0,
        returnsAmount: adSalesAmount,
        returnsQty: adSalesQty
      },
      rd: { 
        amount: rdInvestmentAmount, 
        count: rdInvestmentQty, 
        active: results?.activeRdChips || 0,
        returnsAmount: rdSalesAmount,
        returnsQty: rdSalesQty
      },
      equipment: { amount: equipmentInvestmentAmount, count: machineCount }
    },
    operations: {
      lossQty,
      factoringCost,
      completedQty,
      maxCapacity,
      capacityUtilization
    }
  };
}
