import React, { useState, useEffect } from 'react';
import { useAI } from '../hooks/useAI';

export default function AIAdvisor({ ledger, results, currentPeriod }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'report', 'settings'
  const [inputText, setInputText] = useState('');
  
  // ユーザーが提供したAPIキーをデフォルト値としてフックに渡す
  const {
    apiKey,
    saveApiKey,
    chatHistory,
    isLoading,
    report,
    generateReport,
    sendMessage,
    clearChat
  } = useAI('AIzaSyBHpLD8gIyMx0n8wzXF_dr0uKPijg1VcTM');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText, ledger, results, currentPeriod);
    setInputText('');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '30px',
          background: 'linear-gradient(135deg, #00C6FF, #0072FF)',
          color: 'white',
          border: 'none',
          boxShadow: '0 8px 16px rgba(0, 114, 255, 0.4)',
          fontSize: '1.5rem',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ✨
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '380px',
      height: '600px',
      maxHeight: '80vh',
      backgroundColor: 'var(--bg-card)',
      borderRadius: '16px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(0, 198, 255, 0.1), rgba(0, 114, 255, 0.1))',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>✨</span>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>AI戦略コンサルタント</h3>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button 
          onClick={() => setActiveTab('chat')}
          style={{ flex: 1, padding: '12px', background: activeTab === 'chat' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'chat' ? 'var(--mg-blue)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          チャット相談
        </button>
        <button 
          onClick={() => setActiveTab('report')}
          style={{ flex: 1, padding: '12px', background: activeTab === 'report' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'report' ? 'var(--mg-green)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          決算レポート
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          style={{ flex: 1, padding: '12px', background: activeTab === 'settings' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'settings' ? '#fff' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          設定
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <h4 style={{ marginTop: 0 }}>API設定</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Gemini APIキーを設定してください。現在はずっきーさん提供のキーがデフォルトでセットされています。
            </p>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => saveApiKey(e.target.value)}
              placeholder="API Key"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', marginBottom: '12px' }}
            />
            <button 
              onClick={() => { alert("保存しました"); }}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--mg-blue)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              保存
            </button>
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {!report ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px' }}>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  第{currentPeriod}期の財務状況と取引履歴をAIに分析させます。<br/>決算が終わったタイミングで実行してください。
                </p>
                <button 
                  onClick={() => generateReport(ledger, results, currentPeriod)}
                  disabled={isLoading}
                  style={{ padding: '12px 24px', borderRadius: '24px', background: 'var(--mg-green)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isLoading ? '分析中...' : 'レポートを作成する'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {report}
                <button 
                  onClick={() => generateReport(ledger, results, currentPeriod)}
                  disabled={isLoading}
                  style={{ width: '100%', marginTop: '16px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  {isLoading ? '再分析中...' : 'もう一度分析する'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px' }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '20px' }}>
                  「次は何をすべき？」「いくらで売ればいい？」など、<br/>現在の状況を踏まえてAIに質問できます。
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'var(--mg-blue)' : 'rgba(255,255,255,0.05)',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: msg.role === 'model' ? '4px' : '16px',
                  maxWidth: '85%',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.parts[0].text}
                </div>
              ))}
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  考え中...
                </div>
              )}
            </div>
            
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="質問を入力..."
                disabled={isLoading}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
              <button 
                type="submit" 
                disabled={isLoading || !inputText.trim()}
                style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'var(--mg-blue)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ➤
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
