import React from 'react';

function MgWorksheet({ results, carryover, currentPeriod, ledger }) {
  if (!results || !carryover) return null;

  const { pl, mat, wip, prod, bs, cf, machines } = results;

  // Basic info
  const companyName = "MGカンパニー";
  const presidentName = "社長";
  
  // 16. Borrowings (借入金)
  const loanBeg = carryover.loans || 0;
  const loanIn = ledger?.filter(e => e.category === 'ナ').reduce((sum, e) => sum + (Number(e.amount)||0), 0) || 0;
  const loanOut = ledger?.filter(e => e.category === '二').reduce((sum, e) => sum + (Number(e.amount)||0), 0) || 0;
  const loanChange = loanIn - loanOut;
  const loanEnd = bs?.loans || (loanBeg + loanChange);

  // 14. Fixed Assets (固定資産台帳)
  const lMacBeg = carryover.largeMachines || 0;
  const lMacIn = ledger?.filter(e => e.category === 'ケ').reduce((sum, e) => sum + (e.largeMachines||0), 0) || 0;
  const lMacTotal = lMacBeg + lMacIn;
  
  const sMacBeg = carryover.smallMachines || 0;
  const sMacIn = ledger?.filter(e => e.category === 'ケ').reduce((sum, e) => sum + (e.smallMachines||0), 0) || 0;
  const sMacTotal = sMacBeg + sMacIn;
  
  const attBeg = carryover.attachments || 0;
  const attIn = ledger?.filter(e => e.category === 'ケ').reduce((sum, e) => sum + (e.attachments||0), 0) || 0;
  const attTotal = attBeg + attIn;

  const macBegVal = carryover.fixedAssets || 0;
  const macInVal = ledger?.filter(e => e.category === 'ケ').reduce((sum, e) => sum + (Number(e.amount)||0), 0) || 0;
  const depreciation = pl?.depreciation || 0;
  const macEndVal = bs?.fixedAssets || (macBegVal + macInVal - depreciation);

  // 15. 製造間接費
  const laborCost = pl?.workerSalary || 0;
  const laborSeverance = pl?.workerSeverance || 0;
  const manufacturingFixed = pl?.manufacturingFixed || 0;
  const totalManufacturingOverhead = laborCost + laborSeverance + manufacturingFixed + depreciation;

  // 5. 職工人員計算
  const workerBeg = carryover.workers || 0;
  const workerIn = ledger?.filter(e => e.category === 'メ').reduce((sum, e) => sum + (e.workers||0), 0) || 0;
  const workerOut = ledger?.filter(e => e.category === '辞').reduce((sum, e) => sum + (e.workers||0), 0) || 0;
  const workerEnd = workerBeg + workerIn - workerOut;

  const salesmanBeg = carryover.salesmen || 0;
  const salesmanIn = ledger?.filter(e => e.category === 'メ').reduce((sum, e) => sum + (e.salesmen||0), 0) || 0;
  const salesmanOut = ledger?.filter(e => e.category === '辞').reduce((sum, e) => sum + (e.salesmen||0), 0) || 0;
  const salesmanEnd = salesmanBeg + salesmanIn - salesmanOut;

  // 17. 原価計算 (Cost Accounting)
  const matBegVal = mat?.beginningValue || 0;
  const matBegCnt = mat?.beginningCount || 0;
  const matInVal = (ledger?.filter(e => e.category === 'ツ' || e.category === 'ノ').reduce((sum, e) => sum + (Number(e.amount)||0), 0)) || 0;
  const matInCnt = mat?.purchaseCount || 0;
  const matOutVal = mat?.inputValue || 0; 
  const matOutCnt = mat?.inputCount || 0;
  const matEndVal = mat?.endingValue || 0;
  const matEndCnt = mat?.endingCount || 0;
  const matDisasterVal = mat?.fireValue || 0; 
  const matDisasterCnt = mat?.fireCount || 0;
  const matUnit = mat?.unitCost || 0;

  const wipBegVal = wip?.beginningValue || 0;
  const wipBegCnt = wip?.beginningCount || 0;
  const wipInVal = matOutVal + (ledger?.filter(e => e.category === 'コ' || e.category === 'サ').reduce((sum, e) => sum + (Number(e.amount)||0), 0)) || 0;
  const wipInCnt = wip?.inputCount || 0;
  const wipOutVal = wip?.completedValue || 0;
  const wipOutCnt = wip?.completedCount || 0;
  const wipEndVal = wip?.endingValue || 0;
  const wipEndCnt = wip?.endingCount || 0;
  const wipDisasterVal = wip?.missValue || 0;
  const wipDisasterCnt = wip?.missCount || 0;
  const wipUnit = wip?.unitCost || 0;

  const prodBegVal = prod?.beginningValue || 0;
  const prodBegCnt = prod?.beginningCount || 0;
  const prodInVal = wipOutVal;
  const prodInCnt = prod?.completedCount || 0;
  const prodOutVal = prod?.cogsValue || 0; 
  const prodOutCnt = prod?.salesCount || 0;
  const prodEndVal = prod?.endingValue || 0;
  const prodEndCnt = prod?.endingCount || 0;
  const prodDisasterVal = prod?.theftValue || 0;
  const prodDisasterCnt = prod?.theftCount || 0;
  const prodUnit = prod?.unitCost || 0;

  // Cash flow summary
  const cashBeg = carryover.cash || 0;
  const cashIn = results.cashInflow || 0;
  const cashOut = results.cashOutflow || 0;
  const cashEnd = results.bookEndingCash || 0;

  // STRAC
  const PQ = pl?.salesRevenue || 0;
  const vPQ = pl?.variableCost || 0;
  const mPQ = pl?.margin || 0;
  const F = pl?.fixedCost || 0;
  const G = pl?.operatingProfit || 0;

  const pqUnit = prodOutCnt > 0 ? Math.round(PQ / prodOutCnt) : 0;
  const vpqUnit = prodOutCnt > 0 ? Math.round(vPQ / prodOutCnt) : 0;
  const mpqUnit = pqUnit - vpqUnit;
  const mRatio = pl?.marginRatio || 0;

  // Title Helper
  const Title = ({ num, text }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', color: '#1a237e' }}>
      <span style={{ 
        display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
        width: '18px', height: '18px', borderRadius: '50%', 
        backgroundColor: '#3f51b5', color: 'white', fontSize: '10px', fontWeight: 'bold', marginRight: '4px'
      }}>{num}</span>
      <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0px' }}>{text}</span>
    </div>
  );

  // T-Account Helper
  const TAccount = ({ bg, titleNum, titleText, begV, begC, inV, inC, inLabel, outV, outC, outLabel, endV, endC, disV, disC, unit, lossLabel }) => {
    const totalV = begV + inV;
    const totalC = begC + inC;
    return (
      <div style={{ backgroundColor: bg, border: '1px solid #999', padding: '4px', marginBottom: '8px' }}>
        <Title num={titleNum} text={titleText} />
        <div style={{ display: 'flex', border: '1px solid #666', backgroundColor: 'white' }}>
          {/* 左側 */}
          <div style={{ flex: 1, borderRight: '1px solid #666', padding: '4px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc', marginBottom: '4px' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#666' }}>①期首繰越</span><br/>
                <span style={{ fontWeight: 'bold' }}>{begV}</span>
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '10px' }}>{begC}個</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#666' }}>{inLabel}</span><br/>
                <span style={{ fontWeight: 'bold' }}>{inV}</span>
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '10px' }}>{inC}個</div>
            </div>
          </div>
          {/* 右側 */}
          <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc', marginBottom: '4px' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#666' }}>{outLabel}</span><br/>
                <span style={{ fontWeight: 'bold' }}>{outV}</span>
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '10px' }}>{outC}個</div>
            </div>
            {disC > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #ccc', marginBottom: '4px' }}>
                <div>
                  <span style={{ fontSize: '9px', color: 'red' }}>{lossLabel}</span><br/>
                  <span style={{ fontWeight: 'bold', color: 'red' }}>{disV}</span>
                </div>
                <div style={{ alignSelf: 'flex-end', fontSize: '10px', color: 'red' }}>{disC}個</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#666' }}>⑤次期繰越</span><br/>
                <span style={{ fontWeight: 'bold' }}>{endV}</span>
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '10px' }}>{endC}個</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>
          <div>合計: {totalV} ({totalC}個)</div>
          <div>平均単価: {unit}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="mg-worksheet-container" style={{ padding: '8px', fontSize: '11px', color: '#333', backgroundColor: '#fafafa', fontFamily: '"MS PGothic", "Noto Sans JP", sans-serif', overflowX: 'auto' }}>
      
      <div style={{ display: 'flex', gap: '8px', minWidth: '800px' }}>
        
        {/* ===================== 左半面 ===================== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* トップ行 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
              <Title num="1" text={`第 ${currentPeriod} 期 社名・社長名`} />
              <div style={{ borderBottom: '1px solid #999', marginBottom: '4px' }}>{companyName}</div>
              <div style={{ borderBottom: '1px solid #999' }}>{presidentName}</div>
            </div>
            <div style={{ flex: 1.5, border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
              <Title num="16" text="借入金" />
              <div style={{ display: 'flex', border: '1px solid #999', textAlign: 'center' }}>
                <div style={{ flex: 1, borderRight: '1px solid #999' }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>期首残高</div><div>{loanBeg}</div></div>
                <div style={{ flex: 1, borderRight: '1px solid #999' }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>当期借入/返済</div><div>{loanChange > 0 ? `+${loanChange}` : loanChange}</div></div>
                <div style={{ flex: 1 }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>次期残高</div><div style={{ fontWeight:'bold' }}>{loanEnd}</div></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* 左の中央カラム (14, 15, 5, 現金) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              <div style={{ border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
                <Title num="14" text="固定資産台帳" />
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee' }}>
                      <th style={{ border: '1px solid #999' }}>種別</th>
                      <th style={{ border: '1px solid #999' }}>前期繰越</th>
                      <th style={{ border: '1px solid #999' }}>当期購入</th>
                      <th style={{ border: '1px solid #999' }}>次期繰越</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={{ border: '1px solid #999' }}>大型</td><td style={{ border: '1px solid #999' }}>{lMacBeg}</td><td style={{ border: '1px solid #999' }}>{lMacIn}</td><td style={{ border: '1px solid #999' }}>{lMacTotal}</td></tr>
                    <tr><td style={{ border: '1px solid #999' }}>小型</td><td style={{ border: '1px solid #999' }}>{sMacBeg}</td><td style={{ border: '1px solid #999' }}>{sMacIn}</td><td style={{ border: '1px solid #999' }}>{sMacTotal}</td></tr>
                    <tr><td style={{ border: '1px solid #999' }}>ｱﾀｯﾁ</td><td style={{ border: '1px solid #999' }}>{attBeg}</td><td style={{ border: '1px solid #999' }}>{attIn}</td><td style={{ border: '1px solid #999' }}>{attTotal}</td></tr>
                  </tbody>
                </table>
                <div style={{ display: 'flex', border: '1px solid #999', marginTop: '4px' }}>
                  <div style={{ flex: 1, borderRight: '1px solid #999', textAlign: 'center' }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>期首額</div><div>{macBegVal}</div></div>
                  <div style={{ flex: 1, borderRight: '1px solid #999', textAlign: 'center' }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>当期購入</div><div>{macInVal}</div></div>
                  <div style={{ flex: 1, borderRight: '1px solid #999', textAlign: 'center', backgroundColor: '#ffebee' }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>減価償却</div><div>{depreciation}</div></div>
                  <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize:'9px', borderBottom:'1px solid #999' }}>期末額</div><div style={{ fontWeight:'bold' }}>{macEndVal}</div></div>
                </div>
              </div>

              <div style={{ border: '1px solid #333', padding: '4px', backgroundColor: '#e8eaf6' }}>
                <Title num="15" text="製造間接費" />
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>労務費 (チ)</span><span>{laborCost}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>退職金 (辞)</span><span>{laborSeverance}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>製造固定費</span><span>{manufacturingFixed}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>減価償却費</span><span>{depreciation}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}><span>合計 (マ)</span><span>{totalManufacturingOverhead}</span></div>
              </div>

              <div style={{ border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
                <Title num="5" text="職工人員計算" />
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee' }}>
                      <th style={{ border: '1px solid #999' }}>区分</th><th style={{ border: '1px solid #999' }}>期首</th><th style={{ border: '1px solid #999' }}>採用</th><th style={{ border: '1px solid #999' }}>退職</th><th style={{ border: '1px solid #999' }}>次期</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={{ border: '1px solid #999' }}>工場(W)</td><td style={{ border: '1px solid #999' }}>{workerBeg}</td><td style={{ border: '1px solid #999' }}>{workerIn}</td><td style={{ border: '1px solid #999' }}>{workerOut}</td><td style={{ border: '1px solid #999' }}>{workerEnd}</td></tr>
                    <tr><td style={{ border: '1px solid #999' }}>営業(S)</td><td style={{ border: '1px solid #999' }}>{salesmanBeg}</td><td style={{ border: '1px solid #999' }}>{salesmanIn}</td><td style={{ border: '1px solid #999' }}>{salesmanOut}</td><td style={{ border: '1px solid #999' }}>{salesmanEnd}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* 10, 11, 12, 13 現金残高計算 */}
              <div style={{ border: '1px solid #333', padding: '4px', backgroundColor: 'white', marginTop: 'auto' }}>
                <Title num="12" text="現金残高" />
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #999' }}><span>⑫ 前期繰越</span><span>{cashBeg}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #999', color: '#1976d2' }}><span>⑩ 入金合計</span><span>{cashIn}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #999', color: '#d32f2f' }}><span>⑪ 出金合計</span><span>{cashOut}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '4px' }}><span>⑬ 次期残高</span><span>{cashEnd}</span></div>
              </div>

            </div>

            {/* 原価計算ブロック */}
            <div style={{ flex: 1.2 }}>
              <Title num="17" text="原価計算 (在庫管理・棚卸)" />
              {TAccount({ bg: '#fce4ec', titleNum: '1', titleText: '材料 (倉庫)', begV: matBegVal, begC: matBegCnt, inV: matInVal, inC: matInCnt, inLabel: '②仕入(ツ/ノ)', outV: matOutVal, outC: matOutCnt, outLabel: '③投入(コ)', endV: matEndVal, endC: matEndCnt, disV: matDisasterVal, disC: matDisasterCnt, unit: matUnit, lossLabel: '④ロス(火災)' })}
              
              {TAccount({ bg: '#e8f5e9', titleNum: '2', titleText: '仕掛品 (工場)', begV: wipBegVal, begC: wipBegCnt, inV: wipInVal, inC: wipInCnt, inLabel: '②材料(コ)+加工(サ)', outV: wipOutVal, outC: wipOutCnt, outLabel: '③完成(サ)', endV: wipEndVal, endC: wipEndCnt, disV: wipDisasterVal, disC: wipDisasterCnt, unit: wipUnit, lossLabel: '④ロス(ミス)' })}
              
              {TAccount({ bg: '#e3f2fd', titleNum: '3', titleText: '製品 (営業所)', begV: prodBegVal, begC: prodBegCnt, inV: prodInVal, inC: prodInCnt, inLabel: '②完成(サ)', outV: prodOutVal, outC: prodOutCnt, outLabel: '③売上原価(vPQ)', endV: prodEndVal, endC: prodEndCnt, disV: prodDisasterVal, disC: prodDisasterCnt, unit: prodUnit, lossLabel: '④ロス(盗難)' })}
            </div>
          </div>
        </div>

        {/* ===================== 右半面 ===================== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          <div style={{ border: '2px solid #333', padding: '6px', backgroundColor: '#fff3e0' }}>
            <Title num="20" text="戦略会計 STRAC (変動損益計算書)" />
            
            <div style={{ display: 'flex', gap: '8px', height: '140px', marginTop: '8px' }}>
              <div style={{ flex: 1, border: '1px solid #333', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: '10px' }}>① 売上高 PQ</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{PQ}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ flex: 1, border: '1px solid #333', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px' }}>② 変動費 vPQ</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{vPQ}</span>
                </div>
                <div style={{ flex: 1, border: '1px solid #333', backgroundColor: '#e1f5fe', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px' }}>③ 限界利益 mPQ</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0277bd' }}>{mPQ}</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ flex: 1 }} /> {/* spacer */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ flex: 1, border: '1px solid #333', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px' }}>④ 固定費 F</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{F}</span>
                  </div>
                  <div style={{ flex: 1, border: '1px solid #333', backgroundColor: G >= 0 ? '#e8f5e9' : '#ffebee', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px' }}>⑤ 経常利益 G</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: G >= 0 ? '#2e7d32' : '#c62828' }}>{G}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px', fontSize: '10px' }}>
              <div>m率: <strong>{mRatio.toFixed(1)}%</strong></div>
              <div>f/m比: <strong>{pl?.fmRatio?.toFixed(1) || 0}%</strong></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
              <Title num="21" text="製品1個あたり" />
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>売上単価 P</span><span>{pqUnit}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>変動単価 v</span><span>{vpqUnit}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>付加価値単価 m</span><span color="#0277bd">{mpqUnit}</span></div>
            </div>
            
            <div style={{ flex: 1, border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
              <Title num="22" text="利益剰余金の計算" />
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>① 経常利益</span><span>{G}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999', color: 'red' }}><span>② 法人税 (50%)</span><span>{bs?.unpaidTax || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>③ 当期純利益</span><span>{G - (bs?.unpaidTax || 0)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #999' }}><span>④ 前期利益剰余金</span><span>{carryover.retainedEarnings || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>⑤ 次期利益剰余金</span><span>{bs?.retainedEarnings || 0}</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* B/S */}
            <div style={{ flex: 1.5, border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
              <Title num="23" text="貸借対照表 (B/S)" />
              <div style={{ display: 'flex', gap: '4px', fontSize: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ textAlign: 'center', borderBottom: '1px solid #333', backgroundColor: '#eee' }}>資産</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>現金</span><span>{bs?.cash || 0}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>売掛金</span><span>{bs?.receivables || 0}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>材料</span><span>{matEndVal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>仕掛品</span><span>{wipEndVal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>製品</span><span>{prodEndVal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '8px' }}><span>流動資産</span><span>{bs?.totalCurrentAssets || 0}</span></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>固定資産</span><span>{macEndVal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '8px', borderTop: '2px solid #333' }}><span>総資産</span><span>{bs?.totalAssets || 0}</span></div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid #999', paddingLeft: '4px' }}>
                  <div style={{ textAlign: 'center', borderBottom: '1px solid #333', backgroundColor: '#eee' }}>負債・資本</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>買掛金</span><span>{bs?.payables || 0}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>借入金</span><span>{loanEnd}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>未払法人税</span><span>{bs?.unpaidTax || 0}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '8px' }}><span>負債</span><span>{bs?.totalLiabilities || 0}</span></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>資本金</span><span>{bs?.capital || 0}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>利益剰余金</span><span>{bs?.retainedEarnings || 0}</span></div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: 'auto', borderTop: '2px solid #333' }}><span>総資本</span><span>{bs?.totalLiabilitiesAndNetAssets || 0}</span></div>
                </div>
              </div>
            </div>

            {/* C/F */}
            <div style={{ flex: 1, border: '1px solid #333', padding: '4px', backgroundColor: 'white' }}>
              <Title num="24" text="キャッシュフロー" />
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>営業CF</span><span>{cf?.operatingCF || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>投資CF</span><span>{cf?.investingCF || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#1976d2', borderBottom: '1px solid #999' }}><span>フリーCF</span><span>{cf?.freeCF || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #999' }}><span>財務CF</span><span>{cf?.financingCF || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '2px solid #333', marginTop: '8px' }}><span>現金の増減</span><span>{cf?.totalCF || 0}</span></div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}

export default MgWorksheet;
