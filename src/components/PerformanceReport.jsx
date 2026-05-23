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
          .report-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; margin-bottom: 16px; }
          .report-title { font-size: 1.1rem; color: var(--color-accent); margin-top: 0; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
          .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .kpi-card { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; text-align: center; }
          .kpi-value { font-size: 1.25rem; font-weight: bold; color: var(--text-primary); margin: 6px 0 2px; }
          .kpi-label { font-size: 0.7rem; color: var(--text-secondary); }
          .rank-badge { font-size: 2.5rem; font-weight: 900; background-clip: text; -webkit-background-clip: text; color: transparent; display: inline-block; }
          .bar-container { width: 100%; height: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; display: flex; margin-top: 6px; }
          .bar-fill { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: bold; color: rgba(255,255,255,0.9); }
        `}
      </style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>第{currentPeriod}期 経営成績</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>
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

      {/* セクション2: 経営コンサル・タラレバ分析 */}
      <div className="report-section" style={{ background: 'rgba(255, 215, 0, 0.05)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
        <h3 className="report-title" style={{ color: '#FFD700' }}>💡 コンサルタントのアドバイス</h3>
        
        {analytics.financials.G < 0 ? (
          <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '8px', color: '#ff5252', fontWeight: 'bold' }}>⚠️ 赤字決算でした（営業利益: {analytics.financials.G}万）</div>
            {analytics.M > 0 && analytics.simulation.bepQty !== null ? (
              <>
                <p style={{ margin: '0 0 8px 0' }}>
                  今の1個あたりの粗利(M: {analytics.M.toFixed(1)}万)で、固定費(F: {analytics.financials.F}万)を回収するためには、<strong>最低 {analytics.simulation.bepQty} 個</strong>売る必要がありました。（損益分岐点）
                </p>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#ffcc80' }}>
                  👉 あと <strong>{analytics.simulation.remainingForBEP} 個</strong> 多く売れていれば黒字でした！次期は販売数量を増やすか、販売単価を上げてMを改善しましょう。
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: '#ffcc80' }}>
                👉 1個あたりの粗利(M)がマイナスまたはゼロです。「安売りしすぎ」か「仕入が高すぎ」ます。まずは単価(P)を上げるか、安く材料(V)を仕入れることに集中してください。
              </p>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '8px', color: '#4caf50', fontWeight: 'bold' }}>🎉 黒字達成おめでとうございます！（営業利益: +{analytics.financials.G}万）</div>
            <p style={{ margin: '0 0 8px 0' }}>
              損益分岐点（最低販売数）は <strong>{analytics.simulation.bepQty} 個</strong> でした。それを超えてしっかりと売上を作れています。
            </p>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#81c784' }}>
              👉 あなたの安全余裕額は <strong>{analytics.simulation.safetyMargin} 万</strong> です。<br/>
              つまり、今期あとこれだけ広告や研究開発に「追加投資」しても、赤字にはなりませんでした。次期はさらに強気でチップを買いに行っても大丈夫です！
            </div>
          </div>
        )}
      </div>

      {/* セクション3: P・V・M・Q 分析と工場稼働率 */}
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
          <div className="kpi-card" style={{ flex: 1, borderBottom: '3px solid var(--mg-pink)' }}>
            <div className="kpi-label">M (1個あたり粗利)</div>
            <div className="kpi-value" style={{ color: 'var(--mg-pink)' }}>¥{analytics.M.toFixed(1)}万</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>高いほど利益が出やすい体質</div>
          </div>
        </div>

        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem' }}>🏭 工場稼働率（生産スピード）</span>
            <span style={{ fontWeight: 'bold' }}>{analytics.operations.capacityUtilization}%</span>
          </div>
          <div className="bar-container" style={{ marginTop: 0, height: '12px' }}>
            <div className="bar-fill" style={{ 
              width: `${Math.min(100, analytics.operations.capacityUtilization)}%`, 
              background: analytics.operations.capacityUtilization < 50 ? '#ffb74d' : '#4caf50' 
            }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            今期の最大生産可能数 <strong>{analytics.operations.maxCapacity}個</strong> に対し、実際に完成させたのは <strong>{analytics.operations.completedQty}個</strong> です。
            {analytics.operations.capacityUtilization < 50 && " 機会損失が起きています。ワーカーをもっと生産に回しましょう！"}
          </div>
        </div>
      </div>

      {/* セクション4: 戦略投資とROI */}
      <div className="report-section">
        <h3 className="report-title">💡 戦略投資とそのリターン(ROI)</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 広告 */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--mg-yellow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--mg-yellow)' }}>広告投資 (セ)</span>
              <span>投資額: ¥{analytics.investments.ads.amount}万</span>
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-secondary)' }}>
              広告を活用して販売できた実績: <strong>{analytics.investments.ads.returnsQty}個</strong> (売上: ¥{analytics.investments.ads.returnsAmount}万)<br/>
              {analytics.investments.ads.amount > 0 && analytics.investments.ads.returnsQty === 0 && (
                <span style={{ color: '#ffb74d' }}>⚠️ チップを買ったのに使えていません！「独占販売」を狙いましょう。</span>
              )}
            </div>
          </div>

          {/* 研究開発 */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--mg-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--mg-blue)' }}>研究開発 (チ)</span>
              <span>投資額: ¥{analytics.investments.rd.amount}万</span>
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-secondary)' }}>
              青チップを活用して販売できた実績: <strong>{analytics.investments.rd.returnsQty}個</strong> (売上: ¥{analytics.investments.rd.returnsAmount}万)<br/>
              {analytics.investments.rd.amount > 0 && analytics.investments.rd.returnsQty === 0 && (
                <span style={{ color: '#ffb74d' }}>⚠️ 研究開発は完了していますが、高単価販売に結びついていません。</span>
              )}
            </div>
          </div>
          
          {/* 設備 */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--mg-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--mg-green)' }}>設備投資 (ケ)</span>
              <span>投資額: ¥{analytics.investments.equipment.amount}万</span>
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
              新規購入: {analytics.investments.equipment.count}台 (アタッチメント含)
            </div>
          </div>
        </div>
      </div>

      {/* セクション5: コスト構造 (MQ vs F) */}
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
