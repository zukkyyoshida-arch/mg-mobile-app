import React from 'react';

function VisualCharts({ results, carryover }) {
  if (!results || !carryover) return null;

  const { pl, mat, wip, prod, ledger } = results;

  // --- STRAC図の計算 ---
  const PQ = pl.salesRevenue || 0;
  const vPQ = pl.variableCost || 0;
  const mPQ = pl.margin || 0; // PQ - vPQ
  const F = pl.fixedCost || 0;
  const G = pl.operatingProfit || 0; // mPQ - F

  // STRACボックスの高さ割合（全体を300pxとして計算）
  // PQが0の場合は100%固定などフェールセーフ
  const totalHeight = 240;
  const vPQPct = PQ > 0 ? Math.min(100, Math.max(0, (vPQ / PQ) * 100)) : 0;
  const mPQPct = PQ > 0 ? 100 - vPQPct : 100;
  
  const mPQHeight = (mPQPct / 100) * totalHeight;
  const FPctOfMPQ = mPQ > 0 ? Math.min(100, Math.max(0, (F / mPQ) * 100)) : (F > 0 ? 100 : 0);
  // Gがマイナスの場合はmPQをはみ出すため、高さを超える表現が必要
  
  // --- 在庫合わせ図の計算 ---
  const matBegVal = mat.beginningValue || 0;
  const matBegCnt = mat.beginningCount || 0;
  const matInVal = (ledger?.filter(e => e.category === 'ツ' || e.category === 'ノ').reduce((a, c) => a + (Number(c.amount)||0), 0)) || 0;
  const matInCnt = mat.purchaseCount || 0;
  const matOutVal = mat.inputValue || 0; 
  const matOutCnt = mat.inputCount || 0;
  const matEndVal = mat.endingValue || 0;
  const matEndCnt = mat.endingCount || 0;
  const matDisasterVal = mat.fireValue || 0; 
  const matDisasterCnt = mat.fireCount || 0;
  const matUnit = mat.unitCost || 0;

  const wipBegVal = wip.beginningValue || 0;
  const wipBegCnt = wip.beginningCount || 0;
  const wipInVal = matOutVal + (ledger?.filter(e => e.category === 'コ' || e.category === 'サ').reduce((a, c) => a + (Number(c.amount)||0), 0)) || 0;
  const wipInCnt = wip.inputCount || 0;
  const wipOutVal = wip.completedValue || 0;
  const wipOutCnt = wip.completedCount || 0;
  const wipEndVal = wip.endingValue || 0;
  const wipEndCnt = wip.endingCount || 0;
  const wipDisasterVal = wip.missValue || 0;
  const wipDisasterCnt = wip.missCount || 0;
  const wipUnit = wip.unitCost || 0;

  const prodBegVal = prod.beginningValue || 0;
  const prodBegCnt = prod.beginningCount || 0;
  const prodInVal = wipOutVal;
  const prodInCnt = prod.completedCount || 0;
  const prodOutVal = prod.cogsValue || 0; 
  const prodOutCnt = prod.salesCount || 0;
  const prodEndVal = prod.endingValue || 0;
  const prodEndCnt = prod.endingCount || 0;
  const prodDisasterVal = prod.theftValue || 0;
  const prodDisasterCnt = prod.theftCount || 0;
  const prodUnit = prod.unitCost || 0;

  // --- 追加の計算 (資産・間接費・人員・借入・キャッシュ) ---
  const bs = results.bs || {};
  const cf = results.cf || {};

  // 借入金
  const loanBeg = carryover.loans || 0;
  const loanIn = ledger?.filter(e => e.category === 'ナ').reduce((sum, e) => sum + (Number(e.amount)||0), 0) || 0;
  const loanOut = ledger?.filter(e => e.category === '二').reduce((sum, e) => sum + (Number(e.amount)||0), 0) || 0;
  const loanChange = loanIn - loanOut;
  const loanEnd = bs.loans || (loanBeg + loanChange);

  // キャッシュ
  const cashBeg = carryover.cash || 0;
  const cashIn = results.cashInflow || 0;
  const cashOut = results.cashOutflow || 0;
  const cashEnd = results.bookEndingCash || 0;

  // 人員
  const workerBeg = carryover.workers || 0;
  const workerIn = ledger?.filter(e => e.category === 'メ').reduce((sum, e) => sum + (e.workers||0), 0) || 0;
  const workerOut = ledger?.filter(e => e.category === '辞').reduce((sum, e) => sum + (e.workers||0), 0) || 0;
  const workerEnd = workerBeg + workerIn - workerOut;

  const salesmanBeg = carryover.salesmen || 0;
  const salesmanIn = ledger?.filter(e => e.category === 'メ').reduce((sum, e) => sum + (e.salesmen||0), 0) || 0;
  const salesmanOut = ledger?.filter(e => e.category === '辞').reduce((sum, e) => sum + (e.salesmen||0), 0) || 0;
  const salesmanEnd = salesmanBeg + salesmanIn - salesmanOut;

  // 製造間接費
  const laborCost = pl.workerSalary || 0;
  const laborSeverance = pl.workerSeverance || 0;
  const manufacturingFixed = pl.manufacturingFixed || 0;
  const depreciation = pl.depreciation || 0;
  const totalManufacturingOverhead = laborCost + laborSeverance + manufacturingFixed + depreciation;

  // 固定資産
  const macBegVal = carryover.fixedAssets || 0;
  const macInVal = ledger?.filter(e => e.category === 'ケ').reduce((sum, e) => sum + (Number(e.amount)||0), 0) || 0;
  const macEndVal = bs.fixedAssets || (macBegVal + macInVal - depreciation);

  const renderTAccount = (title, begV, begC, inV, inC, inLabel, outV, outC, outLabel, endV, endC, disV, disC, unit, lossLabel) => {
    const totalV = begV + inV;
    const totalC = begC + inC;
    
    return (
      <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '8px 16px', fontSize: '0.9rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#bbdefb' }}>
          {title}
        </div>
        <div style={{ display: 'flex' }}>
          {/* 左側 (借方・入) */}
          <div style={{ flex: 1, padding: '12px', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>期首繰越</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>¥{begV.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right', alignSelf: 'flex-end', color: 'var(--text-secondary)' }}>
                {begC} 個
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inLabel}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#64b5f6' }}>¥{inV.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right', alignSelf: 'flex-end', color: '#90caf9' }}>
                {inC} 個
              </div>
            </div>
          </div>

          {/* 右側 (貸方・出) */}
          <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{outLabel}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffb74d' }}>¥{outV.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right', alignSelf: 'flex-end', color: '#ffcc80' }}>
                {outC} 個
              </div>
            </div>

            {disC > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#ef5350' }}>{lossLabel}</div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: '#ef5350' }}>¥{disV.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right', alignSelf: 'flex-end', color: '#ef5350' }}>
                  {disC} 個
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>次期繰越</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>¥{endV.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right', alignSelf: 'flex-end', color: 'var(--text-secondary)' }}>
                {endC} 個
              </div>
            </div>
          </div>
        </div>
        
        {/* フッター (合計・平均単価) */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>合計: </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>¥{totalV.toLocaleString()} ({totalC}個)</span>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>平均単価: </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>¥{unit.toLocaleString()} / 個</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '24px' }}>
      
      {/* 1. STRAC図 */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>📊 STRAC図（ストラック表）</h3>
        
        <div style={{ display: 'flex', height: `${totalHeight + (G < 0 ? Math.min(80, (Math.abs(G)/F)*mPQHeight) : 0)}px`, width: '100%', gap: '8px', color: 'white', fontWeight: '800', fontSize: '0.85rem' }}>
          
          {/* 左列: PQ (100%) */}
          <div style={{ flex: 1.2, height: `${totalHeight}px`, backgroundColor: 'rgba(236, 64, 122, 0.2)', border: '2px solid #ec407a', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <span style={{ position: 'absolute', top: '8px', left: '8px', color: '#ec407a' }}>PQ (売上高)</span>
            <div style={{ fontSize: '1.3rem', color: '#f8bbd0' }}>¥{PQ.toLocaleString()}</div>
          </div>

          {/* 中央列: vPQ と mPQ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* vPQ */}
            <div style={{ height: `${Math.max(0, (vPQPct / 100) * totalHeight - (vPQPct < 100 ? 4 : 0))}px`, minHeight: '40px', backgroundColor: 'rgba(156, 39, 176, 0.2)', border: '2px solid #ab47bc', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', top: '4px', left: '6px', color: '#ce93d8', fontSize: '0.7rem' }}>vPQ(変動費)</span>
              <div style={{ color: '#e1bee7', fontSize: '1.1rem' }}>¥{vPQ.toLocaleString()}</div>
            </div>
            
            {/* mPQ */}
            <div style={{ height: `${Math.max(0, (mPQPct / 100) * totalHeight - (mPQPct < 100 ? 4 : 0))}px`, minHeight: '40px', backgroundColor: 'rgba(33, 150, 243, 0.2)', border: '2px solid #42a5f5', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', top: '4px', left: '6px', color: '#90caf9', fontSize: '0.7rem' }}>mPQ(限界利益)</span>
              <div style={{ color: '#bbdefb', fontSize: '1.1rem' }}>¥{mPQ.toLocaleString()}</div>
            </div>
          </div>

          {/* 右列: F と G */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            {/* 上部のスペーサー（vPQと同じ高さ） */}
            <div style={{ height: `${Math.max(0, (vPQPct / 100) * totalHeight - (vPQPct < 100 ? 4 : 0))}px`, minHeight: '40px' }}></div>
            
            {/* mPQと同じ高さの領域にFとGを配置 */}
            <div style={{ height: `${Math.max(0, (mPQPct / 100) * totalHeight - (mPQPct < 100 ? 4 : 0))}px`, minHeight: '40px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
              {/* F */}
              <div style={{ height: G >= 0 ? `${Math.max(0, (FPctOfMPQ / 100) * mPQHeight - 4)}px` : '100%', minHeight: '40px', backgroundColor: 'rgba(255, 152, 0, 0.2)', border: '2px solid #ff9800', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                <span style={{ position: 'absolute', top: '4px', left: '6px', color: '#ffb74d', fontSize: '0.7rem' }}>F (固定費)</span>
                <div style={{ color: '#ffe0b2', fontSize: '1.1rem' }}>¥{F.toLocaleString()}</div>
              </div>
              
              {/* G (黒字) */}
              {G >= 0 && (
                <div style={{ flex: 1, minHeight: '40px', backgroundColor: 'rgba(76, 175, 80, 0.2)', border: '2px solid #66bb6a', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '4px', left: '6px', color: '#81c784', fontSize: '0.7rem' }}>G (利益)</span>
                  <div style={{ color: '#c8e6c9', fontSize: '1.1rem' }}>¥{G.toLocaleString()}</div>
                </div>
              )}

              {/* G (赤字 - 枠外にぶら下がる) */}
              {G < 0 && (
                <div style={{ position: 'absolute', bottom: `-${Math.min(80, (Math.abs(G)/F)*mPQHeight)}px`, left: 0, right: 0, height: `${Math.min(80, (Math.abs(G)/F)*mPQHeight)}px`, minHeight: '40px', backgroundColor: 'rgba(244, 67, 54, 0.2)', border: '2px dashed #ef5350', borderTop: 'none', borderRadius: '0 0 8px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
                  <span style={{ position: 'absolute', bottom: '4px', left: '6px', color: '#e57373', fontSize: '0.7rem' }}>G (赤字)</span>
                  <div style={{ color: '#ffcdd2', fontSize: '1.1rem' }}>-¥{Math.abs(G).toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>

        </div>
        
        {/* 指標 */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '36px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.85rem' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>m率:</span> <strong style={{ color: 'var(--mg-pink)' }}>{pl.marginRatio.toFixed(1)}%</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>f/m比率:</span> <strong style={{ color: pl.fmRatio > 100 ? '#ef5350' : '#81c784' }}>{pl.fmRatio.toFixed(1)}%</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>損益分岐点売上:</span> <strong>¥{mPQ > 0 ? Math.round(F / (pl.marginRatio / 100)).toLocaleString() : '-'}</strong></div>
        </div>
      </div>

      {/* 2. 在庫合わせ図 */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>📦 原価計算フロー（在庫合わせ）</h3>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '16px' }}>※左辺（期首＋当期増加）＝ 右辺（期末＋当期減少）のバランス</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {renderTAccount('① 材料 (倉庫)', matBegVal, matBegCnt, matInVal, matInCnt, '当期仕入 (ツ・ノ)', matOutVal, matOutCnt, '当期投入 (コ)', matEndVal, matEndCnt, matDisasterVal, matDisasterCnt, matUnit, '事故・災害 (火災)')}
          
          <div style={{ textAlign: 'center', color: '#ffb74d', fontSize: '1.2rem', marginTop: '-10px', marginBottom: '-10px' }}>⬇</div>
          
          {renderTAccount('② 仕掛品 (工場)', wipBegVal, wipBegCnt, wipInVal, wipInCnt, '材料投入＋加工費', wipOutVal, wipOutCnt, '当期完成 (サ)', wipEndVal, wipEndCnt, wipDisasterVal, wipDisasterCnt, wipUnit, '製造ミス')}

          <div style={{ textAlign: 'center', color: '#ffb74d', fontSize: '1.2rem', marginTop: '-10px', marginBottom: '-10px' }}>⬇</div>

          {renderTAccount('③ 製品 (営業所)', prodBegVal, prodBegCnt, prodInVal, prodInCnt, '当期完成 (サ)', prodOutVal, prodOutCnt, '売上原価 (vPQ)', prodEndVal, prodEndCnt, prodDisasterVal, prodDisasterCnt, prodUnit, '事故・災害 (盗難)')}
        </div>
      </div>

      {/* 3. 現金・借入金フロー */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>🏦 現金・借入金フロー</h3>
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* 現金 */}
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>💵 現金残高</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>期首残高</span><span style={{ fontWeight: '800' }}>¥{cashBeg.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64b5f6', fontSize: '0.8rem' }}>入金合計</span><span style={{ fontWeight: '800', color: '#64b5f6' }}>+¥{cashIn.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#ef5350', fontSize: '0.8rem' }}>出金合計</span><span style={{ fontWeight: '800', color: '#ef5350' }}>-¥{cashOut.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>期末残高</span><span style={{ fontWeight: '800', fontSize: '1.2rem' }}>¥{cashEnd.toLocaleString()}</span></div>
          </div>
          {/* 借入金 */}
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>💳 借入金</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>期首残高</span><span style={{ fontWeight: '800' }}>¥{loanBeg.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#ffb74d', fontSize: '0.8rem' }}>当期借入/返済</span><span style={{ fontWeight: '800', color: '#ffb74d' }}>{loanChange > 0 ? '+' : ''}¥{loanChange.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: 'auto' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>期末残高</span><span style={{ fontWeight: '800', fontSize: '1.2rem' }}>¥{loanEnd.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* 4. 経営リソース (資産・間接費・人員) */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)' }}>🏢 経営リソース概況</h3>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>⚙️ 固定資産台帳</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>期首額</span><span style={{ fontWeight: '800' }}>¥{macBegVal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64b5f6', fontSize: '0.8rem' }}>当期購入</span><span style={{ fontWeight: '800', color: '#64b5f6' }}>+¥{macInVal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#ef5350', fontSize: '0.8rem' }}>減価償却</span><span style={{ fontWeight: '800', color: '#ef5350' }}>-¥{depreciation.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>期末額</span><span style={{ fontWeight: '800' }}>¥{macEndVal.toLocaleString()}</span></div>
          </div>
          
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>🏭 製造間接費</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>労務費 (チ)</span><span style={{ fontWeight: '800' }}>¥{laborCost.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>退職金 (辞)</span><span style={{ fontWeight: '800' }}>¥{laborSeverance.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>製造固定費</span><span style={{ fontWeight: '800' }}>¥{manufacturingFixed.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>減価償却費</span><span style={{ fontWeight: '800' }}>¥{depreciation.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>合計</span><span style={{ fontWeight: '800' }}>¥{totalManufacturingOverhead.toLocaleString()}</span></div>
          </div>

          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>👥 人員状況</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px dotted rgba(255,255,255,0.1)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>工場(W)</span>
              <span style={{ fontWeight: '800' }}>{workerBeg} + {workerIn} - {workerOut} = <span style={{color: '#64b5f6'}}>{workerEnd}</span> 人</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>営業(S)</span>
              <span style={{ fontWeight: '800' }}>{salesmanBeg} + {salesmanIn} - {salesmanOut} = <span style={{color: '#ffb74d'}}>{salesmanEnd}</span> 人</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default VisualCharts;
