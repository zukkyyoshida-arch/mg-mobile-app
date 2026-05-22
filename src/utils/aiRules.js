/**
 * AI診断ロジック（ルールベース）
 */

/**
 * リアルタイム・アラート（常時監視）
 */
export function getRealtimeAdvice(results) {
  if (!results) return [];

  const warnings = [];

  // 1. 資金ショートの危険（MGの基準）
  // 固定費は results.fixedCost があれば使用、なければ margin - operatingProfit で推測
  const fixedCost = results.fixedCost !== undefined ? results.fixedCost : (results.margin - results.operatingProfit);
  if (results.bookEndingCash < fixedCost) {
    warnings.push({
      type: 'danger',
      message: `現金残高（${results.bookEndingCash}万）が固定費（${fixedCost}万）を下回っています。次期の支払いに危機が迫っています。早急に販売増や借入を検討してください。`
    });
  } else if (results.bookEndingCash < fixedCost * 1.5) {
    warnings.push({
      type: 'warning',
      message: `現金残高（${results.bookEndingCash}万）は固定費（${fixedCost}万）の1.5倍未満です。資金繰りに注意し、余裕を持たせる施策を検討しましょう。`
    });
  }
  // 2. 借入過多の警告（借入が5万以上）
  if (results.loan && results.loan >= 5) {
    warnings.push({
      type: 'warning',
      message: `借入額が ${results.loan}万 です。借入は資金確保に有効ですが、過大になると利息負担が増えます。返済計画を立てましょう。`
    });
  }
  // 3. 広告費過剰の警告（広告費合計が20万超）
  const totalAds = (results.ads && results.ads.total) || 0;
  if (totalAds > 20) {
    warnings.push({
      type: 'warning',
      message: `広告費の合計が ${totalAds}万 と高額です。効果測定を行い、投資対効果が低い場合は削減を検討してください。`
    });
  }
  // 5. その他MG基準警告
  // 借入比率が現金の30%を超える場合
  if (results.loan && results.bookEndingCash && results.loan > results.bookEndingCash * 0.3) {
    warnings.push({
      type: 'warning',
      message: `借入額が現金の30%を超えています（借入: ${results.loan}万 / 現金: ${results.bookEndingCash}万）。返済計画の見直しを検討しましょう。`
    });
  }
  // 広告費が現金の20%を超える場合（既存の広告費チェックに加えて）
  if (results.bookEndingCash && totalAds > results.bookEndingCash * 0.2) {
    warnings.push({
      type: 'warning',
      message: `広告費が現金の20%以上（${totalAds}万）です。投資効果を測定し、必要に応じて削減を検討してください。`
    });
  }
  // ワーカー数が機械数に対して不足している場合
  const totalMachines = (results.largeMachines || 0) + (results.smallMachines || 0);
  if (totalMachines > 0 && results.workers !== undefined && results.workers < totalMachines) {
    warnings.push({
      type: 'warning',
      message: `機械数(${totalMachines})に対してワーカー数(${results.workers})が不足しています。採用や配置転換でバランスを取ってください。`
    });
  }
  // 現金余裕: 固定費の2倍以上
  if (results.bookEndingCash && results.fixedCost && results.bookEndingCash >= results.fixedCost * 2) {
    warnings.push({
      type: 'success',
      message: `現金残高は固定費の2倍以上で十分な余裕があります。今期は安定的に運営できます。`
    });
  }

  // 2. 在庫過多（デッドストック）
  const totalProducts = results.prod?.endingCount || 0;
  const salesmen = results.salesmen || 0;
  if (totalProducts > 10 && salesmen <= 1) {
    warnings.push({
      type: 'warning',
      message: `製品在庫が ${totalProducts} 個も積み上がっていますが、セールスマンが不足しています。販売力を強化するか、安売りを検討しましょう。`
    });
  } else if (totalProducts > 15) {
    warnings.push({
      type: 'warning',
      message: `製品在庫が ${totalProducts} 個も積み上がっています。販売に注力してください。`
    });
  }

  // 3. 材料切れ
  const matCount = results.mat?.endingCount || 0;
  const wipCount = results.wip?.endingCount || 0;
  if (matCount === 0 && wipCount === 0 && totalProducts === 0) {
    warnings.push({
      type: 'danger',
      message: `売るための製品も、作るための材料もありません！まずは材料（ツ・ノ）を仕入れましょう。`
    });
  } else if (matCount === 0 && wipCount === 0) {
    warnings.push({
      type: 'warning',
      message: `材料在庫が0です。これ以上生産できません。早めに仕入れましょう。`
    });
  }

  // 4. 生産能力の上限
  const pac = results.productionCapacity || 0;
  if (wipCount > pac) {
    warnings.push({
      type: 'warning',
      message: `仕掛品（${wipCount}個）が現在の生産能力（${pac}）を超えています。これ以上完成させられません。ワーカーの採用か機械の購入（ケ）が必要です。`
    });
  }

  // 全て問題ない場合
  if (warnings.length === 0) {
    warnings.push({
      type: 'success',
      message: `現在のところ、キャッシュ・在庫ともに危険な兆候は見当たりません。この調子で進めましょう！`
    });
  }

  return warnings;
}

/**
 * 決算レポート（MQ会計に基づく振り返り）
 */
export function generateReport(results, currentPeriod) {
  if (!results) return "データがありません。";

  const {
    salesRevenue = 0,
    margin = 0,
    operatingProfit = 0,
    salesmen = 0,
    workers = 0,
    largeMachines = 0,
    smallMachines = 0
  } = results;
  const totalProducts = results.totalProducts ?? 0;

  const fixedCost = margin - operatingProfit; // MQ - G = F
  const marginRate = salesRevenue > 0 ? (margin / salesRevenue) : 0;
  const totalMachines = largeMachines + smallMachines;

  let report = `### 📊 第${currentPeriod}期 決算分析レポート\n\n`;

  // 0. 市場単価評価
  const priceCapByCity = { 札幌: 40, 仙台: 36, 東京: 32, 名古屋: 28, 大阪: 24, 福岡: 20 };
  const city = results.city || '不明';
  const avgPrice = results.averagePrice ?? ((results.minPrice + results.maxPrice) / 2);
  const cap = priceCapByCity[city] ?? 30;
  if (avgPrice > cap) {
    report += `#### 0. 市場単価評価\n- 現在の平均販売単価は ${avgPrice.toFixed(1)} 万円で、${city} の上限 ${cap} 万円を超えています。\n- 価格調整は不要と判断し、より高価格の市場（${Object.entries(priceCapByCity).filter(([c, v]) => v > cap).map(([c]) => c).join('、')}）での販売を検討してください。\n\n`;
  } else {
    report += `#### 0. 市場単価評価\n- 現在の平均販売単価は ${avgPrice.toFixed(1)} 万円で、${city} の上限 ${cap} 万円以内です。高価格市場（${Object.entries(priceCapByCity).filter(([c, v]) => v >= cap).map(([c]) => c).join('、')}）での販売が有望です。\n\n`;
  }
  // 1. 総合評価
  if (operatingProfit > 0) {
    report += `**見事な黒字決算（営業利益: +${operatingProfit}万）です！** 🎉\n`;
    report += `固定費（${fixedCost}万）をしっかり限界利益（${margin}万）でカバーできています。この調子で自己資本を拡大していきましょう。\n\n`;
    // 販売数評価（MG基準）
    if (totalProducts >= 100) {
      report += `- 🎖️ 販売数が **${totalProducts} 個** でトップ層です。現在の戦略を維持し、さらに高付加価値商品や青チップで単価(P)を上げることを検討しましょう。\n`;
    } else if (totalProducts >= 50) {
      report += `- ⭐ 販売数が **${totalProducts} 個** で優秀です。引き続きQ（数量）を伸ばすために、販売促進やセールスマンの増員をおすすめします。\n`;
    } else if (totalProducts >= 20) {
      report += `- ✅ 初心者にとっては **${totalProducts} 個** の販売で上出来です。まずはこの調子を維持し、販売力強化で更なる成長を目指しましょう。\n`;
    } else {
      report += `- ⚠️ 販売数が **${totalProducts} 個** と低めです。まずは販売力強化（セールスマン増員や広告投資）を優先し、Qを増やす施策を実行しましょう。\n`;
    }
  } else if (operatingProfit === 0 && salesRevenue > 0) {
    report += `**収支トントン（営業利益: ±0万）です。**\n`;
    report += `固定費（${fixedCost}万）と限界利益（${margin}万）が完全に一致しました（損益分岐点ピタリ）。次はもう一段階の黒字化を目指しましょう。\n\n`;
  } else {
    report += `**残念ながら赤字決算（営業損失: ${operatingProfit}万）となりました。** ⚠️\n`;
    report += `稼いだ限界利益（${margin}万）では、かかった固定費（${fixedCost}万）を吸収しきれませんでした（F > MQ）。\n\n`;
  }

  // 2. ボトルネックと原因分析
  report += `#### 2. ボトルネック分析 (MQ会計)\n`;
  const bottlenecks = [];
  
  if (salesRevenue === 0) {
    bottlenecks.push(`- **売上がゼロです:** 商品が一つも売れていません。まずは販売を最優先で行う必要があります。`);
  } else {
    if (marginRate < 0.4) {
      bottlenecks.push(`- **限界利益率（粗利率）が低すぎます:** 現在のMQ率は ${(marginRate * 100).toFixed(1)}% です。安売りしすぎているか、材料費が高くついている（高値掴み）可能性があります。P（単価）を上げる努力をしましょう。`);
    } else if (marginRate > 0.6) {
      bottlenecks.push(`- **高い限界利益率:** MQ率は ${(marginRate * 100).toFixed(1)}% と非常に優秀です。高単価販売戦略が上手く機能しています！`);
    }

    if (operatingProfit < 0 && marginRate >= 0.4) {
      bottlenecks.push(`- **固定費（F）の圧迫:** 利益率は悪くありませんが、固定費（${fixedCost}万）が重すぎます。Q（販売数）を増やすか、次期のFを削減する必要があります。`);
    }
  }

  if (salesmen === 0) {
    bottlenecks.push(`- **販売力不足:** セールスマンが0人です。これでは商品は勝手には売れません。採用か配置転換を検討しましょう。`);
  }
  
  if (totalMachines > 0 && workers === 0) {
    bottlenecks.push(`- **生産力バランスの崩れ:** 機械があるのにワーカーが0人です。設備が遊んでしまっています。`);
  }

  if (bottlenecks.length > 0) {
    report += bottlenecks.join('\n') + '\n\n';
  } else {
    report += `- 特に目立ったボトルネックはありません。生産・販売のバランスが取れています。\n\n`;
  }

  // 3. 次期へのアドバイス
  report += `#### 3. 次期へのアクションプラン\n`;
  if (operatingProfit > 0) {
    report += `- 現在の戦略が機能しています。次期はさらにQ（数量）を追い求めるか、研究開発（青チップ）でP（単価）を上げて利益率を高めるのがおすすめです。\n`;
    // 具体的な意思決定
    if (salesmen > 0) {
      const targetSalesmen = Math.max(salesmen, Math.ceil(totalProducts / 5));
      report += `  - 目標: セールスマンを ${targetSalesmen} 人に増やし、販売力を強化しましょう。\n`;
    }
    if (totalMachines > 0 && workers < totalMachines) {
      const needed = totalMachines - workers;
      report += `  - 目標: ワーカーを ${needed} 人増員して、機械稼働率を 100% に保ちましょう。\n`;
    }
    if (results.bookEndingCash && results.fixedCost && results.bookEndingCash >= results.fixedCost * 2) {
      const invest = Math.floor(results.bookEndingCash / 2);
      report += `  - 余裕資金があるので、追加の機械投資やR&Dに ${invest} 万円程度割り当てることを検討してください。\n`;
    }
  } else {
    report += `- まずは **損益分岐点（BEP）** を意識してください。次期の固定費（F）がいくらかかるかを予測し、それをカバーするために「いくらで（P）」「何個（Q）」売れば良いかを逆算して計画（Management Plan）を立てましょう。\n`;
  }

  return report;
}
