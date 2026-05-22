// Gemini API (REST) Client

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * 基本的なプロンプトを送信してテキストを取得する
 */
export async function askGemini(prompt, apiKey) {
  if (!apiKey) throw new Error("APIキーが設定されていません");
  
  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 }
    })
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  return data.candidates[0].content.parts[0].text;
}

/**
 * チャット履歴を送信して返答を取得する
 * @param {Array} history [{ role: 'user'|'model', parts: [{ text: '...' }] }]
 */
export async function askGeminiChat(history, apiKey) {
  if (!apiKey) throw new Error("APIキーが設定されていません");
  
  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: history,
      generationConfig: { temperature: 0.7 }
    })
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  return data.candidates[0].content.parts[0].text;
}

/**
 * 現在の財務状況と取引履歴から、AIに渡すための状態サマリー（コンテキスト）を生成する
 */
export function generateGameStateContext(ledger, results, currentPeriod) {
  return `
現在の状況 (第${currentPeriod}期):
【損益計算書 (P/L) の状況】
- 売上高: ${results?.salesRevenue || 0}
- 売上原価: ${results?.variableCost || 0}
- 限界利益 (粗利): ${results?.margin || 0}
- 固定費: ${(results?.laborCost || 0) + (results?.manufacturingFixed || 0) + (results?.salesCost || 0) + (results?.adminCost || 0) + (results?.rdCost || 0) + (results?.nonOperatingCost || 0)}
- 営業利益: ${results?.operatingProfit || 0}
- 経常利益: ${results?.ordinaryProfit || 0}

【貸借対照表 (B/S) の状況】
- 現金残高: ${results?.bookEndingCash || 0}
- 総資産: ${results?.totalAssets || 0}
- 総負債: ${results?.totalLiabilities || 0}
- 自己資本 (純資産): ${results?.netAssets || 0}

【能力・リソース】
- ワーカー数: ${results?.totalWorkersHired || 0}
- セールスマン数: ${results?.totalSalesmenHired || 0}
- 最大生産能力 (PAC): ${results?.productionCapacity || 0}
- 機械保有数: 大型 ${results?.largeMachines || 0}台, 小型 ${results?.smallMachines || 0}台
- 材料在庫: ${results?.matEndingCount || 0}個
- 仕掛品在庫: ${results?.wipEndingCount || 0}個
- 製品在庫: ${results?.prodEndingCount || 0}個

【直近の取引履歴 (最新5件)】
${ledger.slice(-5).map(e => `- ${e.category} (数量: ${e.quantity}, 金額: ${e.amount})`).join('\n')}
`;
}
