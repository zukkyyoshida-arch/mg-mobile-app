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
  const matBeg = carryover.materialsValue || 0;
  const matIn = (ledger?.filter(e => e.category === 'ツ' || e.category === 'ノ').reduce((a, c) => a + (Number(c.amount)||0), 0)) || 0;
  const matOut = mat.inputValue || 0; // コ投入
  const matEnd = mat.endingValue || 0;
  const matDisaster = mat.fireValue || 0; // 火災など

  const wipBeg = carryover.wipValue || 0;
  const wipIn = matOut + (ledger?.filter(e => e.category === 'コ' || e.category === 'サ').reduce((a, c) => a + (Number(c.amount)||0), 0)) || 0; // 投入(コ)＋完成(サ)の加工費
  const wipOut = wip.completedValue || 0; // 当期完成
  const wipEnd = wip.endingValue || 0;
  const wipDisaster = wip.missValue || 0;

  const prodBeg = carryover.productValue || 0;
  const prodIn = wipOut;
  const prodOut = prod.soldValue || 0; // vPQ
  const prodEnd = prod.endingValue || 0;
  const prodDisaster = prod.theftValue || 0;

  const renderBox = (title, beg, inVal, inLabel, end, outVal, outLabel, disaster) => (
    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '800', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {title} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(計: ¥{(beg + inVal).toLocaleString()})</span>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: '12px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>期首</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '8px' }}>¥{beg.toLocaleString()}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inLabel}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#64b5f6' }}>+¥{inVal.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, padding: '12px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{outLabel}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffb74d', marginBottom: '8px' }}>-¥{outVal.toLocaleString()}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>期末</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>¥{end.toLocaleString()}</div>
          {disaster > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#ef5350' }}>ロス: -¥{disaster.toLocaleString()}</div>
          )}
        </div>
      </div>
    </div>
  );

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

          {renderBox('① 材料 (Materials)', matBeg, matIn, '当期仕入 (ツ・ノ)', matEnd, matOut, '当期投入 (コ)', matDisaster)}
          
          <div style={{ textAlign: 'center', color: '#ffb74d', fontSize: '1.2rem', marginTop: '-10px', marginBottom: '-10px' }}>⬇</div>
          
          {renderBox('② 仕掛品 (WIP)', wipBeg, wipIn, '材料投入＋加工費(コ/サ)', wipEnd, wipOut, '当期完成 (サ)', wipDisaster)}

          <div style={{ textAlign: 'center', color: '#ffb74d', fontSize: '1.2rem', marginTop: '-10px', marginBottom: '-10px' }}>⬇</div>

          {renderBox('③ 商品 (Products)', prodBeg, prodIn, '当期完成 (サ)', prodEnd, prodOut, '売上原価 (vPQ)', prodDisaster)}
        </div>
      </div>

    </div>
  );
}

export default VisualCharts;
