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

  // 全トランザクションを走査
  ledger.forEach(entry => {
    // 1. 販売（キ・ネ）
    if (entry.category === "キ" || entry.category === "ネ") {
      totalSalesQty += entry.quantity || 0;
      totalSalesAmount += entry.amount || 0;
    }
    
    // 2. 仕入（ツ・ノ）
    if (entry.category === "ツ" || entry.category === "ノ") {
      totalPurchaseQty += entry.quantity || 0;
      totalPurchaseAmount += entry.amount || 0;
    }

    // 3. 広告投資（セ ※クレーム処理などを除外するためカスタム名で判定）
    if (entry.category === "セ" && entry.customShortName === "広告") {
      adInvestmentAmount += entry.amount || 0;
      adInvestmentQty += entry.quantity || 1; // 数量がなければ1回とカウント
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
      // 火災は全損だが記録上は quantity:1 になっていることが多いので、results 側のロストカウントを後で使うか、ここで大まかに拾う
      if (entry.category !== "火災") {
        lossQty += entry.quantity || 1;
      }
    }

    // 7. 売掛割引
    if (entry.category === "売掛割引") {
      factoringCost += entry.amount || 0;
    }
  });

  // 結果オブジェクトから火災ロスを正確に拾う
  // 火災は結果（results.mat.fireCount）で正確な喪失数がわかる
  if (results?.mat?.fireCount) {
    lossQty += results.mat.fireCount;
  }

  // --- KPI の算出 ---
  
  // P: 平均販売単価 (Price)
  const P = totalSalesQty > 0 ? (totalSalesAmount / totalSalesQty) : 0;
  
  // V: 平均仕入単価 (Variable Cost)
  const V = totalPurchaseQty > 0 ? (totalPurchaseAmount / totalPurchaseQty) : 0;
  
  // M: 1個あたりの限界利益 (Marginal Profit Unit)
  const M = P - V;
  
  // Q: 販売数量 (Quantity)
  const Q = totalSalesQty;

  // MQ: 総限界利益
  // ※理論値は M * Q だが、実際は期首在庫の原価なども絡むため results の粗利を使うのが正確
  const actualMQ = results?.grossProfit || 0;

  // F: 固定費
  const F = results?.fixedCosts || 0;

  // G: 営業利益
  const G = results?.operatingProfit || 0;

  // 総合ランクの判定 (自己資本と利益に基づく独自ロジック)
  // 例: 黒字で自己資本300以上ならS、黒字ならA、赤字ならB、債務超過ならC
  let rank = "C";
  const netAssets = results?.totalNetAssets || 0;
  
  if (G > 0 && netAssets >= 300) {
    rank = "S";
  } else if (G > 0) {
    rank = "A";
  } else if (netAssets > 0) {
    rank = "B";
  }

  // リターン計算用（簡易）
  // ※実際はどの売上がどのチップによるものか完全な紐付けは難しいが、
  // 「広告チップを持っている状態での売上」として恩恵を算出可能。
  // 今回はシンプルに、投資額とチップ保有数を返す。

  return {
    rank,
    P,
    V,
    M,
    Q,
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
    investments: {
      ads: { amount: adInvestmentAmount, count: adInvestmentQty, active: results?.activeAdChips || 0 },
      rd: { amount: rdInvestmentAmount, count: rdInvestmentQty, active: results?.activeRdChips || 0 },
      equipment: { amount: equipmentInvestmentAmount, count: machineCount }
    },
    operations: {
      lossQty,
      factoringCost
    }
  };
}
