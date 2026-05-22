import { useState, useCallback } from 'react';
import { askGemini, askGeminiChat, generateGameStateContext } from '../utils/gemini';

export function useAI(initialApiKey = '') {
  const [apiKey, setApiKey] = useState(initialApiKey || localStorage.getItem('mg_gemini_api_key') || '');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState(null);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('mg_gemini_api_key', key);
  };

  const getSystemPrompt = () => {
    return `あなたは戦略MG（マネジメントゲーム）の専属AIコンサルタントです。
戦略MGは、製造業の経営シミュレーションゲームです。材料を購入し、ワーカーと機械で製品を製造し、セールスマンと広告で製品を販売して利益（自己資本）を増やすことが目的です。
ユーザーから提供される財務状況（P/L, B/S, キャッシュフロー、リソースなど）をもとに、鋭く、実践的で、専門的な経営アドバイスを提供してください。
口調は「優秀なコンサルタント」として、丁寧ですが率直に課題を指摘してください。`;
  };

  const getRealtimeAdvice = useCallback(async (ledger, results, currentPeriod) => {
    if (!apiKey) return "APIキーを設定してください。";
    setIsLoading(true);
    try {
      const context = generateGameStateContext(ledger, results, currentPeriod);
      const prompt = `${getSystemPrompt()}

以下の現在の財務状況と直近の取引を見て、**次に取るべき行動や現在のリスク（キャッシュショートや在庫過多など）について、2〜3文で簡潔に**アドバイスをしてください。

${context}`;
      
      const advice = await askGemini(prompt, apiKey);
      return advice;
    } catch (err) {
      console.error(err);
      return `エラーが発生しました: ${err.message}`;
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  const generateReport = useCallback(async (ledger, results, currentPeriod) => {
    if (!apiKey) return;
    setIsLoading(true);
    try {
      const context = generateGameStateContext(ledger, results, currentPeriod);
      const prompt = `${getSystemPrompt()}

第${currentPeriod}期の決算が終わりました。以下の財務状況をもとに、**今期の振り返りレポート**を作成してください。
以下の構成で、MQ会計（単価、数量、変動費、限界利益、固定費）の観点を取り入れて分析してください。

1. **全体評価と利益の要因** (なぜ黒字/赤字になったか)
2. **ボトルネックの指摘** (販売力、生産能力、資金繰り、固定費のどれが課題か)
3. **次期（第${currentPeriod + 1}期）に向けた戦略提案**

${context}`;
      
      const reportText = await askGemini(prompt, apiKey);
      setReport(reportText);
    } catch (err) {
      console.error(err);
      setReport(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  const sendMessage = useCallback(async (message, ledger, results, currentPeriod) => {
    if (!apiKey) return;
    
    // Add user message to history
    const newHistory = [...chatHistory, { role: 'user', parts: [{ text: message }] }];
    setChatHistory(newHistory);
    setIsLoading(true);
    
    try {
      const context = generateGameStateContext(ledger, results, currentPeriod);
      
      // We prepend a system prompt and context as a mock 'user' message if this is the first turn,
      // or we just inject the context into the user's message.
      const payloadMessage = `【現在のゲーム状況データ】\n${context}\n\n【ユーザーの質問】\n${message}\n\n※あなたは戦略MGのコンサルタントです。この状況を踏まえてプロフェッショナルに回答してください。`;
      
      // Format history for Gemini API
      const apiHistory = newHistory.map((msg, index) => {
        if (index === newHistory.length - 1) {
          return { role: 'user', parts: [{ text: payloadMessage }] };
        }
        return msg;
      });

      const responseText = await askGeminiChat(apiHistory, apiKey);
      
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `エラーが発生しました: ${err.message}` }] }]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, chatHistory]);

  const clearChat = () => setChatHistory([]);

  return {
    apiKey,
    saveApiKey,
    chatHistory,
    isLoading,
    report,
    getRealtimeAdvice,
    generateReport,
    sendMessage,
    clearChat
  };
}
