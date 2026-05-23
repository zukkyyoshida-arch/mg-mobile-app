import React from 'react';
import { calculateAnalytics } from '../utils/analytics';

export default function PerformanceReport({ ledger, results, currentPeriod, onClose }) {
  const analytics = calculateAnalytics(ledger, results);

  const getRankColor = (rank) => {
    switch (rank) {
      case 'S': return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
      case 'A': return 'linear-gradient(135deg, #00C853 0%, #64DD17 100%)';
      case 'B': return 'linear-gradient(135deg, #29B6F6 0%, #03A9F4 100%)';
      case 'C': return 'linear-gradient(135deg, #EF5350 0%, #E53935 100%)';
      default: return 'var(--color-surface)';
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 12, 16, 0.95)',
      zIndex: 9999, overflowY: 'auto', padding: '20px',
      color: 'white', display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .report-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
          .report-title { font-size: 1.2rem; color: var(--color-accent); margin-top: 0; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
          .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .kpi-card { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; text-align: center; }
          .kpi-value { font-size: 1.5rem; font-weight: bold; color: var(--text-primary); margin: 8px 0 4px; }
          .kpi-label { font-size: 0.75rem; color: var(--text-secondary); }
          .rank-badge { font-size: 3rem; font-weight: 900; background-clip: text; -webkit-background-clip: text; color: transparent; display: inline-block; }
          .bar-container { width: 100%; height: 24px; background: rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; display: flex; margin-top: 8px; }
          .bar-fill { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; color: rgba(255,255,255,0.9); }
        `}
      </style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>第{currentPeriod}期 経営成績レポート</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>
          閉じる
        </button>
      </div>

      {/* セクション1: 総合評価 */}
      <div className="report-section" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>今期の総合評価</div>
        <div className="rank-badge" style={{ backgroundImage: getRankColor(analytics.rank) }}>
          Rank {analytics.rank}
        </div>
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '1.1rem' }}>
          あなたの利益エンジン：
          <strong style={{ color: 'var(--mg-pink)', fontSize: '1.3rem', marginLeft: '8px' }}>[ M: ¥{Math.round(analytics.M)}万 ] × [ Q: {analytics.Q}個 ]</strong>
        </div>
      </div>

      {/* セクション2: P・V・M・Q 分析 */}
      <div className="report-section">
        <h3 className="report-title">📈 営業・製造パフォーマンス (PVMQ)</h3>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">P (平均販売単価)</div>
            <div className="kpi-value" style={{ color: '#4fc3f7' }}>¥{analytics.P.toFixed(1)}万</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>総販売数: {analytics.totals.salesQty}個</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">V (平均仕入単価)</div>
            <div className="kpi-value" style={{ color: '#81c784' }}>¥{analytics.V.toFixed(1)}万</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>総仕入数: {analytics.totals.purchaseQty}個</div>
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <div className="kpi-card" style={{ flex: 1 }}>
            <div className="kpi-label">M (1個あたり粗利)</div>
            <div className="kpi-value" style={{ color: 'var(--mg-pink)' }}>¥{analytics.M.toFixed(1)}万</div>
          </div>
          <div className="kpi-card" style={{ flex: 1, background: 'rgba(255, 82, 82, 0.15)', border: '1px solid rgba(255, 82, 82, 0.3)' }}>
            <div className="kpi-label" style={{ color: '#ff5252' }}>ロス (火災/ミス/盗難)</div>
            <div className="kpi-value" style={{ color: '#ff5252' }}>{analytics.operations.lossQty}個</div>
          </div>
        </div>
      </div>

      {/* セクション3: 戦略投資 */}
      <div className="report-section">
        <h3 className="report-title">💡 戦略投資パフォーマンス</h3>
        <div className="kpi-grid">
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--mg-blue)' }}>
            <div className="kpi-label">広告投資 (セ)</div>
            <div className="kpi-value">¥{analytics.investments.ads.amount}万</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>購入回数: {analytics.investments.ads.count}回 / 保有: {analytics.investments.ads.active}枚</div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--mg-yellow)' }}>
            <div className="kpi-label">研究開発 (チ)</div>
            <div className="kpi-value">¥{analytics.investments.rd.amount}万</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>購入回数: {analytics.investments.rd.count}回 / 保有: {analytics.investments.rd.active}枚</div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--mg-green)', gridColumn: 'span 2' }}>
            <div className="kpi-label">設備投資 (ケ)</div>
            <div className="kpi-value">¥{analytics.investments.equipment.amount}万</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>新規購入: {analytics.investments.equipment.count}台(アタッチメント含)</div>
          </div>
        </div>
      </div>

      {/* セクション4: コスト構造 (MQ vs F) */}
      <div className="report-section">
        <h3 className="report-title">🏢 コスト構造 (MQ vs F)</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem' }}>稼いだ限界利益 (MQ): <strong style={{ color: 'var(--mg-pink)' }}>¥{analytics.financials.MQ}万</strong></span>
        </div>
        <div className="bar-container">
          <div className="bar-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #ff4081 0%, #f50057 100%)' }}>
            MQ
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem' }}>使った固定費 (F): <strong style={{ color: '#9e9e9e' }}>¥{analytics.financials.F}万</strong></span>
        </div>
        <div className="bar-container" style={{ background: 'transparent' }}>
          {/* MQを100%とした時のFの割合を表示 */}
          <div className="bar-fill" style={{ 
            width: `${Math.min(100, (analytics.financials.F / Math.max(1, analytics.financials.MQ)) * 100)}%`, 
            background: 'rgba(158, 158, 158, 0.7)',
            borderRadius: '12px'
          }}>
            F
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', padding: '12px', background: analytics.financials.G > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 82, 82, 0.15)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>最終営業利益 (G = MQ - F)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: analytics.financials.G > 0 ? '#4caf50' : '#ff5252' }}>
            {analytics.financials.G > 0 ? '+' : ''}¥{analytics.financials.G}万
          </div>
        </div>
      </div>
      
      <button 
        onClick={onClose}
        style={{
          width: '100%', padding: '16px', borderRadius: '12px',
          background: 'var(--color-accent)', color: 'black',
          fontSize: '1.1rem', fontWeight: 'bold', border: 'none',
          marginBottom: '40px'
        }}
      >
        確認して戻る
      </button>

    </div>
  );
}
