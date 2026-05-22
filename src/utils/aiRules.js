/**
 * AI診断ロジック（ルールベース）
 */

/**
 * リアルタイム・アラート（常時監視）
 */
export function getRealtimeAdvice(results) {
  if (!results) return [];

  const warnings = [];

  // 1. 資金ショートの危険
  // 仮に基本固定費を 200万と仮定
  const estimatedFixedCosts = 200;
  if (results.bookEndingCash < estimatedFixedCosts) {
    warnings.push({
      type: 'danger',
      message: `現金残高（${results.bookEndingCash}万）が少なくなっています。次期の固定費支払いに向けて、早急な販売か借入を検討してください。`
    });
  } else if (results.bookEndingCash < estimatedFixedCosts * 1.5) {
    warnings.push({
      type: 'warning',
      message: `現金残高（${results.bookEndingCash}万）に余裕がありません。資金繰りに注意してください。`
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
    variableCost = 0,
    margin = 0,
    operatingProfit = 0,
    salesmen = 0,
    workers = 0,
    largeMachines = 0,
    smallMachines = 0
  } = results;

  const fixedCost = margin - operatingProfit; // MQ - G = F
  const marginRate = salesRevenue > 0 ? (margin / salesRevenue) : 0;
  const totalMachines = largeMachines + smallMachines;

  let report = `### 📊 第${currentPeriod}期 決算分析レポート\n\n`;

  // 1. 総合評価
  report += `#### 1. 全体評価\n`;
  if (operatingProfit > 0) {
    report += `**見事な黒字決算（営業利益: +${operatingProfit}万）です！** 🎉\n`;
    report += `固定費（${fixedCost}万）をしっかり限界利益（${margin}万）でカバーできています。この調子で自己資本を拡大していきましょう。\n\n`;
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
  } else {
    report += `- まずは **損益分岐点（BEP）** を意識してください。次期の固定費（F）がいくらかかるかを予測し、それをカバーするために「いくらで（P）」「何個（Q）」売れば良いかを逆算して計画（Management Plan）を立てましょう。\n`;
  }

  return report;
}
