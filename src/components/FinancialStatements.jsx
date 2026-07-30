import React, { useState } from 'react';
import VisualCharts from './VisualCharts';
import TrendCharts from './TrendCharts';

function FinancialStatements({ results, carryover, currentPeriod, ledger, onShowPerformance, periods }) {
  // Defensive defaults for possible undefined props
  const safeCarry = carryover || {
    materialsValue: 0,
    wipValue: 0,
    productValue: 0,
    cash: 0,
    receivables: 0,
    payables: 0,
    loans: 0,
    unpaidTax: 0
  };

  // Debug log to trace rendering
  React.useEffect(() => {
    console.log('FinancialStatements rendered, statementTab:', statementTab);
  });
  const cf = results.cf || {
    operatingCF: 0,
    investingCF: 0,
    financingCF: 0,
    freeCF: 0,
    totalCF: 0,
  };
  const [statementTab, setStatementTab] = useState('pl'); // 'pl', 'bs', 'cf'

  const pl = results.pl || {
    margin: 0,
    marginRatio: 0,
    operatingProfit: 0,
    rank: 0,
    variableCost: 0,
    salesRevenue: 0,
    fixedCost: 0,
    fmRatio: 0,
    laborCost: 0,
    manufacturingFixed: 0,
    rdCost: 0,
    nonOperatingCost: 0,
    extraordinaryProfit: 0,
    profitBeforeTax: 0,
    netProfit: 0
  };
  const bs = results.bs || {
    cash: 0,
    receivables: 0,
    materialsValue: 0,
    wipValue: 0,
    productValue: 0,
    totalCurrentAssets: 0,
    fixedAssets: 0,
    totalAssets: 0,
    difference: 0,
    payables: 0,
    loans: 0,
    unpaidTax: 0,
    totalLiabilities: 0,
    capital: 0,
    retainedEarnings: 0,
    totalNetAssets: 0,
    totalLiabilitiesAndNetAssets: 0
  };
  // pl is now defined with defaults above

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      
      {/* 決算書タブ切り替え */}
      {/* KPIダッシュボードボタン (プレミアムなバナー風デザイン) */}
      {onShowPerformance && (
        <button
          onClick={onShowPerformance}
          className="btn-premium"
          style={{
            width: '100%',
            marginBottom: '16px',
            background: '#f5f5f5 !important',
            border: '1px solid #cbd5e1',
            color: '#000000 !important',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '14px 16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)'
          }}
        >
          <span style={{ fontSize: '1.2rem', color: 'var(--mg-blue)' }}>📊</span>
          <span style={{ fontWeight: '700', fontSize: '1rem', letterSpacing: '0', color: '#000000' }}>今期の経営成績を見る</span>
          <span style={{ marginLeft: 'auto', color: 'var(--mg-blue)', fontWeight: '700' }}>→</span>
        </button>
      )}

      {/* 決算書タブ切り替え (スタイリッシュなセグメントコントロール) */}
      <div className="segmented-control" style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setStatementTab('pl')}
          className={`segment-item ${statementTab === 'pl' ? 'active' : ''}`}
        >
          P/L (損益)
        </button>
        <button
          onClick={() => setStatementTab('bs')}
          className={`segment-item ${statementTab === 'bs' ? 'active' : ''}`}
        >
          B/S (貸借)
        </button>
        <button
          onClick={() => setStatementTab('cf')}
          className={`segment-item ${statementTab === 'cf' ? 'active' : ''}`}
        >
          C/F (資金)
        </button>
        <button
          onClick={() => setStatementTab('visual')}
          className={`segment-item ${statementTab === 'visual' ? 'active' : ''}`}
        >
          図解 (Visual)
        </button>
        {periods && (
          <button
            onClick={() => setStatementTab('trend')}
            className={`segment-item ${statementTab === 'trend' ? 'active' : ''}`}
          >
            推移 (Trend)
          </button>
        )}
      </div>

      {/* ==================== 1. 変動損益計算書 (P/L) ==================== */}
      {statementTab === 'pl' && (
        <div className="tab-panel">
          
          {/* MQ / G ハイライトカード */}
          <div className="glass-card saas-kpi-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span className="saas-section-title">Financial Overview</span>
              <span className="saas-pill">第{currentPeriod}期</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MQ 付加価値額</span>
                <div className="electric-number" style={{ fontSize: '2.2rem', color: 'var(--mg-pink)', margin: '4px 0' }}>
                  ¥{pl.margin.toLocaleString()}<span style={{ fontSize: '1rem' }}>万</span>
                </div>
                <span className="badge badge-pink" style={{ fontSize: '0.65rem' }}>m率 {pl.marginRatio.toFixed(1)}%</span>
              </div>
              
              <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '20px', textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>G 経常利益</span>
                <div className="electric-number" style={{ fontSize: '2.2rem', color: pl.operatingProfit >= 0 ? 'var(--mg-green)' : '#ef4444', margin: '4px 0' }}>
                  ¥{pl.operatingProfit >= 0 ? '+' : ''}{pl.operatingProfit.toLocaleString()}<span style={{ fontSize: '1rem' }}>万</span>
                </div>
                <span className={`badge badge-${pl.operatingProfit >= 0 ? 'green' : 'pink'}`} style={{ fontSize: '0.65rem' }}>
                  評価: {results.rank} ランク
                </span>
              </div>
            </div>

            {/* 簡易財務比率メーター (SVGインラインゲージ) */}
            <div style={{ marginTop: '18px', padding: '14px', background: 'var(--surface-subtle)', border: '1px solid var(--border-glass)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>変動費 vPQ ({((pl.variableCost / (pl.salesRevenue || 1)) * 100).toFixed(0)}%)</span>
                <span>固定費 F ({((pl.fixedCost / (pl.salesRevenue || 1)) * 100).toFixed(0)}%)</span>
                <span>経常利益 G</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#f3f4f6', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(pl.variableCost / (pl.salesRevenue || 1)) * 100}%`, backgroundColor: 'var(--mg-green)' }} />
                <div style={{ width: `${(pl.fixedCost / (pl.salesRevenue || 1)) * 100}%`, backgroundColor: 'var(--mg-blue)' }} />
                <div style={{ width: `${Math.max(0, pl.operatingProfit) / (pl.salesRevenue || 1) * 100}%`, backgroundColor: 'var(--mg-pink)' }} />
              </div>
            </div>
          </div>

          {/* P/L明細書テーブル */}
          <div className="glass-card" style={{ padding: '14px 16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: '700', marginBottom: '8px', color: 'var(--text-secondary)' }}>㉖ 戦略会計変動損益計算書 (P/L)</h4>
            
            <table className="premium-table">
              <tbody>
                <tr>
                  <td style={{ fontWeight: '700' }}>売上高 (PQ)</td>
                  <td style={{ textAlign: 'right', fontWeight: '800' }}>¥{pl.salesRevenue.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-secondary)', paddingLeft: '20px' }}>┗ 売上原価 / 変動費 (vPQ)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>-¥{pl.variableCost.toLocaleString()}万</td>
                </tr>
                <tr style={{ borderBottom: '1px double var(--border-glass-focused)' }}>
                  <td style={{ fontWeight: '700', color: 'var(--mg-pink)' }}>付加価値 (mPQ)</td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--mg-pink)' }}>¥{pl.margin.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: '700' }}>固定費 (F) <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(f/m比: {pl.fmRatio.toFixed(0)}%)</span></td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--mg-blue)' }}>-¥{pl.fixedCost.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>労務費 (シ)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-¥{pl.laborCost.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>製造固定費 (ス + 減価償却)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-¥{pl.manufacturingFixed.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>販売費 (セ)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-¥{pl.salesCost.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>一般管理費 (ソ)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-¥{pl.adminCost.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>研究開発費 (チ)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-¥{pl.rdCost.toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>営業外費用 (タ)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>-¥{pl.nonOperatingCost.toLocaleString()}万</td>
                </tr>
                <tr style={{ borderBottom: '1px double var(--border-glass-focused)' }}>
                  <td style={{ fontWeight: '700' }}>経常利益 (G)</td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: pl.operatingProfit >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                    ¥{pl.operatingProfit >= 0 ? '+' : ''}{pl.operatingProfit.toLocaleString()}万
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-secondary)' }}>特別損益 (イ + エ - 災害損失)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {pl.extraordinaryProfit >= 0 ? '+' : ''}¥{pl.extraordinaryProfit.toLocaleString()}万
                  </td>
                </tr>
                <tr style={{ fontWeight: '700' }}>
                  <td>税引前当期純利益</td>
                  <td style={{ textAlign: 'right', fontWeight: '800' }}>¥{pl.profitBeforeTax.toLocaleString()}万</td>
                </tr>
                <tr>
                  {/* 税額が7万のときは均等割（最低税額）が適用されている。
                      赤字でも7万を払うのがMGのルールなので、
                      「(30%)」と出すと計算違いに見えてしまう。適用中の根拠を出す。 */}
                  <td style={{ color: 'var(--text-secondary)' }}>
                    未払法人税等 {pl.corporateTax <= 7 ? '(均等割 7万)' : '(利益の30%)'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>-¥{pl.corporateTax.toLocaleString()}万</td>
                </tr>
                <tr style={{ borderTop: '2px double var(--border-glass-focused)', fontWeight: '800', fontSize: '1rem' }}>
                  <td>当期純利益</td>
                  <td style={{ textAlign: 'right', color: pl.netProfit >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                    ¥{pl.netProfit >= 0 ? '+' : ''}{pl.netProfit.toLocaleString()}万
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== 2. 貸借対照表 (B/S) ==================== */}
      {statementTab === 'bs' && (
        <div className="tab-panel">
          
          {/* B/S不一致（バランス）エラー表示 */}
          {bs.difference > 0 && (
            <div className="glass-card" style={{ padding: '12px 16px', background: '#ffffff', borderColor: '#fecaca', margin: '8px 16px', textAlign: 'center' }}>
              <span style={{ fontWeight: '800', color: '#ef4444', fontSize: '0.88rem' }}>
                🚨 貸借対照表が不一致です！ズレ金額: ¥{bs.difference.toLocaleString()}万
              </span>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                期首繰越のバランス、出納帳の計算間違い、または期末の棚卸数が正しく合っているかチェックしてください。
              </p>
            </div>
          )}

          <div className="glass-card" style={{ padding: '14px 16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-secondary)' }}>㉓ 貸借対照表 (B/S)</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 資産の部 (Assets) */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--mg-pink)', borderBottom: '2px solid var(--mg-pink)', paddingBottom: '2px', textTransform: 'uppercase' }}>資産の部</span>
                <table className="premium-table" style={{ marginTop: '6px' }}>
                  <tbody>
                    <tr>
                      <td>現金 (⑬)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.cash.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>売掛金 (⑱)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.receivables.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>材料在庫 (ツ - コ - 火災)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.materialsValue.toLocaleString()}万 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({results.mat.endingCount}個)</span></td>
                    </tr>
                    <tr>
                      <td>仕掛品在庫 (コ + サ - ミス)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.wipValue.toLocaleString()}万 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({results.wip.endingCount}個)</span></td>
                    </tr>
                    <tr>
                      <td>製品在庫 (完成 - 売上 - 盗難)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.productValue.toLocaleString()}万 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({results.prod.endingCount}個)</span></td>
                    </tr>
                    <tr style={{ fontWeight: '700', backgroundColor: '#f9fafb' }}>
                      <td>流動資産合計</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.totalCurrentAssets.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>固定資産 (⑭機械)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.fixedAssets.toLocaleString()}万</td>
                    </tr>
                    <tr style={{ fontWeight: '800', fontSize: '0.95rem', borderTop: '2px double var(--border-glass-focused)', color: 'var(--mg-pink)' }}>
                      <td>資産合計 (総資産)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.totalAssets.toLocaleString()}万</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 負債・純資産の部 (Liabilities & Net Assets) */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-primary)', borderBottom: '2px solid var(--mg-blue)', paddingBottom: '2px', textTransform: 'uppercase' }}>負債・純資産の部</span>
                <table className="premium-table" style={{ marginTop: '6px' }}>
                  <tbody>
                    <tr>
                      <td>買掛金 (⑲)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.payables.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>借入金 (⑰)</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.loans.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>未払法人税等</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.unpaidTax.toLocaleString()}万</td>
                    </tr>
                    {bs.accruedLaborCost > 0 && (
                      <tr style={{ color: 'var(--mg-pink)' }}>
                        <td>未払費用 (給与・保険料)</td>
                        <td style={{ textAlign: 'right' }}>¥{bs.accruedLaborCost.toLocaleString()}万</td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: '700', backgroundColor: '#f9fafb' }}>
                      <td>負債合計</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.totalLiabilities.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>資本金</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.capital.toLocaleString()}万</td>
                    </tr>
                    <tr>
                      <td>次期繰越利益剰余金 (㉒)</td>
                      <td style={{ textAlign: 'right', color: bs.retainedEarnings >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                        ¥{bs.retainedEarnings.toLocaleString()}万
                      </td>
                    </tr>
                    <tr style={{ fontWeight: '700', backgroundColor: '#f9fafb' }}>
                      <td>純資産合計</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.totalNetAssets.toLocaleString()}万</td>
                    </tr>
                    <tr style={{ fontWeight: '800', fontSize: '0.95rem', borderTop: '2px double var(--border-glass-focused)', color: 'var(--text-primary)' }}>
                      <td>負債・純資産合計</td>
                      <td style={{ textAlign: 'right' }}>¥{bs.totalLiabilitiesAndNetAssets.toLocaleString()}万</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. 資金計算書 (C/F) ==================== */}
      {statementTab === 'cf' && (
        <div className="tab-panel">
          <div className="glass-card" style={{ padding: '14px 16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-secondary)' }}>㉔ キャッシュ・フロー計算書 (C/F)</h4>
            
            <table className="premium-table">
              <tbody>
                <tr>
                  <td style={{ fontWeight: '700' }}>営業活動によるC/F</td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: cf.operatingCF >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                    ¥{cf.operatingCF >= 0 ? '+' : ''}{cf.operatingCF.toLocaleString()}万
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>┗ 税引前当期純利益</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>¥{pl.profitBeforeTax.toLocaleString()}万</td>
                </tr>
                <tr>
                  {/* 減価償却費は results.machines.depreciation をそのまま使う。
                      以前は「製造固定費 − ス（製造経費）」で逆算していたため、
                      PAC分や製造経費が償却額として混ざり、図解・固定資産台帳・予実ギャップと
                      食い違う数字が出ていた（同じ状態で3画面が矛盾していた）。
                      なお償却額は製造固定費に含まれており（manufacturingFixed = ス + 償却 + PAC）、
                      固定費合計 F にも入っている。ここは非資金項目としての足し戻し額の内訳表示。 */}
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>┗ 減価償却費 (非資金)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>+¥{(results.machines?.depreciation || 0).toLocaleString()}万</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>┗ 在庫増減 (材料・仕掛・製品)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    -¥{((bs.materialsValue + bs.wipValue + bs.productValue) - (safeCarry.materialsValue + safeCarry.wipValue + safeCarry.productValue)).toLocaleString()}万
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '20px' }}>┗ 売掛・買掛増減</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    ¥{((bs.payables - safeCarry.payables) - (bs.receivables - safeCarry.receivables)).toLocaleString()}万
                  </td>
                </tr>
                
                <tr>
                  <td style={{ fontWeight: '700' }}>投資活動によるC/F (機械等)</td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: cf.investingCF >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                    ¥{cf.investingCF >= 0 ? '+' : ''}{cf.investingCF.toLocaleString()}万
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', fontWeight: '700', backgroundColor: '#f9fafb' }}>
                  <td>フリーキャッシュフロー</td>
                  <td style={{ textAlign: 'right', color: cf.freeCF >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                    ¥{cf.freeCF >= 0 ? '+' : ''}{cf.freeCF.toLocaleString()}万
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td style={{ fontWeight: '700' }}>財務活動によるC/F (借入・資本)</td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: cf.financingCF >= 0 ? 'var(--mg-green)' : '#ef4444' }}>
                    ¥{cf.financingCF >= 0 ? '+' : ''}{cf.financingCF.toLocaleString()}万
                  </td>
                </tr>
                
                <tr style={{ borderTop: '2px double var(--border-glass-focused)', fontWeight: '800', fontSize: '1rem', color: 'var(--mg-pink)' }}>
                  <td>当期キャッシュ増減</td>
                  <td style={{ textAlign: 'right' }}>
                    {cf.totalCF >= 0 ? '+' : ''}{cf.totalCF.toLocaleString()}万
                  </td>
                </tr>
                <tr style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>
                  <td>期末現金残高 (⑭)</td>
                  <td style={{ textAlign: 'right', fontWeight: '800' }}>¥{bs.cash.toLocaleString()}万</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== 4. 図解 (Visual) ==================== */}
      {statementTab === 'visual' && (
        <div className="tab-panel">
          <VisualCharts results={results} carryover={safeCarry} ledger={ledger} />
        </div>
      )}

      {/* ==================== 5. 期別推移 (Trend) ==================== */}
      {statementTab === 'trend' && periods && (
        <div className="tab-panel">
          <TrendCharts periods={periods} currentPeriod={currentPeriod} />
        </div>
      )}

    </div>
  );
}

export default FinancialStatements;
