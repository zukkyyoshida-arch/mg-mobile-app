import React, { useEffect } from 'react';
import { calculateAnalytics } from '../utils/analytics';
import { useAI } from '../hooks/useAI';

export default function PerformanceReport({ ledger, results, prevLedger, prevResults, currentPeriod, onClose }) {
  const analytics = calculateAnalytics(ledger, results, prevLedger, prevResults);
  const { warnings, report, generateReport } = useAI(results, currentPeriod);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

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

      {/* --- 前期比較セクション (第2期以降のみ表示) --- */}
      {analytics.comparison && (
        <div className="report-section" style={{ background: 'rgba(33, 150, 243, 0.05)', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
          <h3 className="report-title" style={{ color: '#64B5F6' }}>📊 前期との比較レポート (YoY)</h3>
          
          <div style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🏢 会社の成長（自己資本と利益）</div>
            <p style={{ margin: '0 0 6px 0' }}>
              自己資本: ¥{analytics.simulation.currentNetAssets}万 (前期比 <span style={{ color: analytics.comparison.diffNetAssets > 0 ? '#4caf50' : analytics.comparison.diffNetAssets < 0 ? '#ff5252' : 'inherit' }}>{analytics.comparison.diffNetAssets > 0 ? '+' : ''}{analytics.comparison.diffNetAssets}万</span>)<br/>
              経常利益: ¥{analytics.financials.G}万 (前期比 <span style={{ color: analytics.comparison.diffG > 0 ? '#4caf50' : analytics.comparison.diffG < 0 ? '#ff5252' : 'inherit' }}>{analytics.comparison.diffG > 0 ? '+' : ''}{analytics.comparison.diffG}万</span>)
            </p>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#90CAF9' }}>
              {analytics.comparison.growthAdvice}
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>📈 利益構造（P・V・M・Q）の変化</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>単価(P)の変化</div>
                <div style={{ fontWeight: 'bold', color: analytics.comparison.diffP > 0 ? '#4caf50' : analytics.comparison.diffP < 0 ? '#ff5252' : 'inherit' }}>{analytics.comparison.diffP > 0 ? '+' : ''}{analytics.comparison.diffP.toFixed(1)}万</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>数量(Q)の変化</div>
                <div style={{ fontWeight: 'bold', color: analytics.comparison.diffQ > 0 ? '#4caf50' : analytics.comparison.diffQ < 0 ? '#ff5252' : 'inherit' }}>{analytics.comparison.diffQ > 0 ? '+' : ''}{analytics.comparison.diffQ}個</div>
              </div>
            </div>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#90CAF9' }}>
              {analytics.comparison.pvmqAdvice}
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚙️ 固定費と資金繰り</div>
            <p style={{ margin: '0 0 6px 0' }}>
              固定費(F): ¥{analytics.financials.F}万 (前期比 <span style={{ color: analytics.comparison.diffF > 0 ? '#ffb74d' : analytics.comparison.diffF < 0 ? '#4caf50' : 'inherit' }}>{analytics.comparison.diffF > 0 ? '+' : ''}{analytics.comparison.diffF}万</span>)<br/>
              現預金残高: ¥{analytics.simulation.currentCash}万 (前期比 <span style={{ color: analytics.comparison.diffCash > 0 ? '#4caf50' : analytics.comparison.diffCash < 0 ? '#ff5252' : 'inherit' }}>{analytics.comparison.diffCash > 0 ? '+' : ''}{analytics.comparison.diffCash}万</span>)
            </p>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#90CAF9' }}>
              {analytics.comparison.investmentAdvice}
            </div>
          </div>
        </div>
      )}

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
        {/* 1. 利益目標と安全余裕度 */}
        {analytics.financials.G <= 0 ? (
          <div style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ marginBottom: '8px', color: '#ff5252', fontWeight: 'bold' }}>⚠️ {analytics.financials.G === 0 ? '利益ゼロのトントン決算でした' : '赤字決算でした'}（営業利益: {analytics.financials.G}万）</div>
            {analytics.M > 0 && analytics.simulation.bepQty !== null ? (
              <>
                <p style={{ margin: '0 0 8px 0' }}>
                  今の1個あたりの粗利(M: {analytics.M.toFixed(1)}万)で、固定費(F: {analytics.financials.F}万)を回収するためには、<strong>最低 {analytics.simulation.bepQty} 個</strong>売る必要がありました。（損益分岐点）
                </p>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#ffcc80' }}>
                  👉 あと <strong>{analytics.simulation.remainingForBEP > 0 ? analytics.simulation.remainingForBEP : 1} 個</strong> 多く売れていれば確実な黒字でした！次期は販売数量を増やすか、販売単価を上げてMを改善しましょう。
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: '#ffcc80' }}>
                👉 1個あたりの粗利(M)がマイナスまたはゼロです。「安売りしすぎ」か「仕入が高すぎ」ます。まずは単価(P)を上げるか、安く材料(V)を仕入れることに集中してください。
              </p>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ marginBottom: '8px', color: '#4caf50', fontWeight: 'bold' }}>🎉 黒字達成おめでとうございます！（営業利益: +{analytics.financials.G}万）</div>
            <p style={{ margin: '0 0 8px 0' }}>
              損益分岐点（最低販売数）は <strong>{analytics.simulation.bepQty} 個</strong> でした。それを超えてしっかりと売上を作れています。
            </p>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', color: '#81c784' }}>
              👉 あなたの安全余裕額は <strong>{analytics.simulation.safetyMargin} 万</strong> です。<br/>
              つまり、今期あとこれだけ追加で投資していても赤字にはなりませんでした。次期はさらに強気でチップを買いに行っても大丈夫です！
            </div>
          </div>
        )}

        {/* 2. キャッシュフロー・資金繰り診断 */}
        <div style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>💰 資金繰り（キャッシュフロー）診断</div>
          <p style={{ margin: '0 0 8px 0' }}>
            現在の現金残高: ¥{analytics.simulation.currentCash}万 / 次期首の必須支払額: ¥{analytics.simulation.nextPeriodInitialCosts}万
          </p>
          {analytics.simulation.nextPeriodCashShortfall > 0 ? (
            <div style={{ padding: '8px', background: 'rgba(255, 82, 82, 0.15)', borderLeft: '4px solid #ff5252', borderRadius: '4px', color: '#ff5252' }}>
              <strong>⚠️ 黒字倒産の危機（資金ショート）</strong><br/>
              次期首の支払い（買掛金や税金）に対して、手元の現金が <strong>¥{analytics.simulation.nextPeriodCashShortfall}万 不足</strong> しています。次期開始直後に借入（オ）か売掛割引をしないと倒産します！
            </div>
          ) : (
            <div style={{ padding: '8px', background: 'rgba(76, 175, 80, 0.15)', borderLeft: '4px solid #4caf50', borderRadius: '4px', color: '#81c784' }}>
              ✅ 手元現金は潤沢です。次期の支払いは余裕でクリアできます！
            </div>
          )}
        </div>

        {/* 3. 在庫の「死に金」警告 */}
        <div style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>📦 在庫の滞留（死に金）チェック</div>
          {analytics.simulation.deadStockValue > 0 ? (
            <div style={{ padding: '8px', background: 'rgba(255, 152, 0, 0.15)', borderLeft: '4px solid #ff9800', borderRadius: '4px', color: '#ffcc80' }}>
              現在、<strong>¥{analytics.simulation.deadStockValue}万</strong> 分の資金が、売れ残った「材料・仕掛品・製品」として眠っています。キャッシュの回転が悪化しています。次期は『売れる分だけ仕入れて作る』ジャストインタイムを意識しましょう！
            </div>
          ) : (
            <div style={{ padding: '8px', background: 'rgba(76, 175, 80, 0.15)', borderLeft: '4px solid #4caf50', borderRadius: '4px', color: '#81c784' }}>
              ✅ 在庫ゼロで期末を迎えました！素晴らしいキャッシュの回転率です。
            </div>
          )}
        </div>

        {/* 4. 値決め診断 (m率) */}
        <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            💎 値決め診断（m率 = {analytics.mRatio}%）
            {analytics.mRatio >= 50 && <span className="god-tier-badge">🏅 God Tier</span>}
          </div>
          {analytics.mRatio >= 50 ? (
            <div style={{ padding: '8px', background: 'rgba(76, 175, 80, 0.15)', borderLeft: '4px solid #4caf50', borderRadius: '4px', color: '#81c784' }}>
              ✅ m率50%以上！高付加価値な素晴らしい商売ができています。この価格設定を維持しましょう。
            </div>
          ) : analytics.mRatio >= 40 ? (
            <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', borderLeft: '4px solid #9e9e9e', borderRadius: '4px', color: 'var(--text-secondary)' }}>
              標準的なm率（40%台）です。さらに利益を伸ばすために単価アップを狙えるか検討しましょう。
            </div>
          ) : (
            <div style={{ padding: '8px', background: 'rgba(255, 82, 82, 0.15)', borderLeft: '4px solid #ff5252', borderRadius: '4px', color: '#ff5252' }}>
              ⚠️ 薄利多売の体質になっています（m率40%未満）。少しでも販売単価(P)を上げるか、安く仕入れる工夫をしないと、数を売っても利益が出ない苦しい展開になります。
            </div>
          )}
        </div>
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
      
      {/* 🤖 AI経営コンサルタントの診断セクション */}
      <div className="report-section" style={{ background: 'linear-gradient(135deg, rgba(0, 198, 255, 0.05), rgba(0, 114, 255, 0.05))', border: '1px solid rgba(0, 198, 255, 0.3)' }}>
        <h3 className="report-title" style={{ color: '#00c6ff' }}>🤖 AI経営コンサルタントの総評</h3>
        
        {/* アラート */}
        {warnings && warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {warnings.map((w, index) => {
              let bg = 'rgba(255,255,255,0.05)';
              let border = 'rgba(255,255,255,0.1)';
              let icon = 'ℹ️';
              
              if (w.type === 'danger') {
                bg = 'rgba(255, 82, 82, 0.1)';
                border = '#ff5252';
                icon = '🚨';
              } else if (w.type === 'warning') {
                bg = 'rgba(255, 193, 7, 0.1)';
                border = '#ffc107';
                icon = '⚠️';
              } else if (w.type === 'success') {
                bg = 'rgba(76, 175, 80, 0.1)';
                border = '#4caf50';
                icon = '✅';
              }

              return (
                <div key={index} style={{
                  padding: '12px', borderRadius: '8px', background: bg, borderLeft: `4px solid ${border}`,
                  fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)', display: 'flex', gap: '8px'
                }}>
                  <span style={{ fontSize: '1rem' }}>{icon}</span>
                  <div>{w.message}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* AIレポート出力 */}
        {report ? (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', fontSize: '0.88rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>
            {report}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
            AI分析を生成中...
          </div>
        )}
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
