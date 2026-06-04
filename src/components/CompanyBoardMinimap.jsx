import React from 'react';

function CompanyBoardMinimap({ results }) {
  const { 
    mat, wip, prod, machines, bookEndingCash, workers, salesmen, 
    activeAdChips, activeGreenChips,
    activeInsuranceChips, activeRdChips, activeMdChips, activePacChips, activeResearchChips, activeGenericGreenChips
  } = results;

  const totalWorkers = workers || 0;
  const totalSalesmen = salesmen || 0;
  let remainingWorkers = totalWorkers;

  const totalInventory = mat.endingCount + wip.endingCount + prod.endingCount;
  const isInventoryOverLimit = totalInventory > 20;

  // 各種在庫の数に応じた配列を作成（レンダリング用）
  const matChips = Array.from({ length: Math.max(0, Math.min(15, mat.endingCount)) }, (_, i) => i);
  const wipChips = Array.from({ length: Math.max(0, Math.min(15, wip.endingCount)) }, (_, i) => i);
  const prodChips = Array.from({ length: Math.max(0, Math.min(15, prod.endingCount)) }, (_, i) => i);

  // 機械の数に応じた配列
  const largeMachList = Array.from({ length: Math.max(0, machines.large) }, (_, i) => i);
  const smallMachList = Array.from({ length: Math.max(0, machines.small) }, (_, i) => i);
  const attachList = Array.from({ length: Math.max(0, machines.attachments) }, (_, i) => i);

  // 機械ごとの人員アサインの計算
  const largeMachWorkers = [];
  for (let i = 0; i < machines.large; i++) {
    if (remainingWorkers >= 1) {
      largeMachWorkers.push(1);
      remainingWorkers -= 1;
    } else {
      largeMachWorkers.push(0);
    }
  }

  const smallMachWorkers = [];
  for (let i = 0; i < machines.small; i++) {
    if (remainingWorkers >= 1) {
      smallMachWorkers.push(1);
      remainingWorkers -= 1;
    } else {
      smallMachWorkers.push(0);
    }
  }

  const requiredWorkers = machines.large + machines.small;
  const isShortOfWorkers = totalWorkers < requiredWorkers;

  return (
    <div className="glass-card" style={{ padding: '8px', background: '#ffffff', border: '1px solid rgba(0, 176, 255, 0.25)', boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, color: 'var(--mg-blue)' }}>
          <span className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00e676', display: 'inline-block' }}></span>
          🔮 リアルタイム会社盤ミニマップ
        </h4>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>※盤面上のコマ配置を自動シミュレート</span>
      </div>

      {isInventoryOverLimit && (
        <div style={{ 
          marginBottom: '12px', 
          padding: '8px 12px', 
          backgroundColor: 'rgba(239, 68, 68, 0.15)', 
          border: '1px solid rgba(239, 68, 68, 0.4)', 
          borderRadius: '8px', 
          color: '#ff8a80', 
          fontSize: '0.75rem', 
          fontWeight: '700'
        }}>
          ⚠️ 警告: 在庫合計が20個を超えています (現在 {totalInventory}個)。<br/>期末処理までに商品・仕掛・材料の順に廃棄・投げ売りが必要です。
        </div>
      )}

      {/* 会社盤のグリッドレイアウト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* 上段: 材料倉庫 (左) | 工場ライン (中) | 製品倉庫 (右) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: '6px' }}>
          
          {/* 1. 材料倉庫 (オレンジ) */}
          <div style={{ 
            backgroundColor: 'rgba(255, 152, 0, 0.05)', 
            border: '1px solid rgba(255, 152, 0, 0.25)', 
            borderRadius: '8px', 
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#ff9800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>材料倉庫</div>
              
              {activeMdChips > 0 && (
                <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {Array.from({ length: activeMdChips }).map((_, i) => (
                    <span key={i} style={{ fontSize: '0.7rem' }} title="マーチャンダイザー">🟢</span>
                  ))}
                  <span style={{ fontSize: '0.5rem', color: '#2e7d32', fontWeight: 'bold' }}>MD</span>
                </div>
              )}

              <div style={{ fontSize: '0.55rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '2px' }}>材料:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {matChips.map((i) => (
                  <div 
                    key={i} 
                    className="animate-pulse"
                    style={{ 
                      width: '14px', 
                      height: '14px', 
                      borderRadius: '50%', 
                      background: 'radial-gradient(circle, #ffb74d 0%, #f57c00 100%)', 
                      border: '1.5px solid #ffe0b2',
                      boxShadow: '0 2px 4px rgba(245, 124, 0, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  />
                ))}
                {mat.endingCount === 0 && (
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255, 152, 0, 0.5)', fontStyle: 'italic' }}>倉庫空っぽ</div>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.7rem', fontWeight: '800', color: '#ff9800', marginTop: '8px', paddingTop: '4px', borderTop: '1px dashed rgba(255, 152, 0, 0.2)' }}>
              材料: {mat.endingCount} 個
            </div>
          </div>

          {/* 2. 生産工場 (パープル & ブルー仕掛 & 人員配置) */}
          <div style={{ 
            backgroundColor: 'rgba(156, 39, 176, 0.05)', 
            border: '1px solid rgba(156, 39, 176, 0.25)', 
            borderRadius: '8px', 
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#e040fb', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>工場ライン</div>
              
              {activePacChips > 0 && (
                <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {Array.from({ length: activePacChips }).map((_, i) => (
                    <span key={i} style={{ fontSize: '0.7rem' }} title="PAC生産性">🟢</span>
                  ))}
                  <span style={{ fontSize: '0.5rem', color: '#2e7d32', fontWeight: 'bold' }}>PAC</span>
                </div>
              )}

              <div style={{ fontSize: '0.55rem', color: '#ea80fc', fontWeight: '700', marginBottom: '2px' }}>
                ワーカー:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '4px', minHeight: '14px', alignItems: 'center' }}>
                {totalWorkers > 0 ? Array.from({ length: totalWorkers }).map((_, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', lineHeight: '1' }}>🧑‍🔧</span>
                )) : (
                  <span style={{ fontSize: '0.55rem', color: 'rgba(156, 39, 176, 0.5)', fontStyle: 'italic' }}>不在</span>
                )}
              </div>
              
              {/* 設備された機械のアイコン ＆ 人員配置 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {largeMachList.map((i) => {
                  const assigned = largeMachWorkers[i] !== undefined ? largeMachWorkers[i] : 0;
                  const workerIcons = assigned === 1 ? "🧑‍🔧" : "💨";
                  const isOperating = assigned === 1;
                  return (
                    <div 
                      key={`l-${i}`} 
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px', 
                        fontSize: '0.55rem', 
                        fontWeight: '800', 
                        color: 'var(--text-primary)', 
                        backgroundColor: isOperating ? '#8e24aa' : 'rgba(142, 36, 170, 0.4)', 
                        borderRadius: '4px',
                        border: isOperating ? '1.5px solid #d1c4e9' : '1px dashed rgba(209, 196, 233, 0.4)',
                        boxShadow: isOperating ? '0 2px 4px rgba(142, 36, 170, 0.3)' : 'none'
                      }}
                    >
                      <span>大型 ({assigned}/1)</span>
                      <span>{workerIcons}</span>
                    </div>
                  );
                })}
                {smallMachList.map((i) => {
                  const assigned = smallMachWorkers[i] !== undefined ? smallMachWorkers[i] : 0;
                  const workerIcons = assigned === 1 ? "🧑‍🔧" : "💨";
                  const isOperating = assigned === 1;
                  return (
                    <div 
                      key={`s-${i}`} 
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px', 
                        fontSize: '0.55rem', 
                        fontWeight: '800', 
                        color: 'var(--text-primary)', 
                        backgroundColor: isOperating ? '#ab47bc' : 'rgba(186, 104, 200, 0.4)', 
                        borderRadius: '4px',
                        border: isOperating ? '1.5px solid #e1bee7' : '1px dashed rgba(225, 190, 231, 0.4)',
                        boxShadow: isOperating ? '0 2px 4px rgba(186, 104, 200, 0.3)' : 'none'
                      }}
                    >
                      <span>小型 ({assigned}/1)</span>
                      <span>{workerIcons}</span>
                    </div>
                  );
                })}
                {attachList.map((i) => (
                  <div 
                    key={`a-${i}`} 
                    style={{ 
                      padding: '1px 3px', 
                      fontSize: '0.5rem', 
                      fontWeight: '800', 
                      color: '#4a148c', 
                      backgroundColor: '#ea80fc', 
                      borderRadius: '3px',
                      border: '1px solid #f3e5f5',
                      alignSelf: 'flex-start',
                      marginTop: '2px'
                    }}
                  >
                    ｱﾀｯﾁﾒﾝﾄ⚙️
                  </div>
                ))}
              </div>

              {/* 仕掛品の丸チップ */}
              <div style={{ fontSize: '0.55rem', color: '#ea80fc', fontWeight: '700', marginTop: '6px', marginBottom: '2px' }}>仕掛品:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {wipChips.map((i) => (
                  <div 
                    key={i} 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: 'radial-gradient(circle, #4fc3f7 0%, #0288d1 100%)', 
                      border: '1.5px solid #e0f7fa',
                      boxShadow: '0 2px 4px rgba(2, 136, 209, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  />
                ))}
                {wip.endingCount === 0 && (
                  <div style={{ fontSize: '0.62rem', color: 'rgba(156, 39, 176, 0.5)', fontStyle: 'italic' }}>稼働ラインなし</div>
                )}
              </div>

              {/* 要員警告のみ工場に配置 */}
              {isShortOfWorkers && (
                <div style={{ 
                  marginTop: '6px', 
                  padding: '3px 4px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                  border: '1px solid rgba(239, 68, 68, 0.4)', 
                  borderRadius: '4px', 
                  color: '#ff8a80', 
                  fontSize: '0.5rem', 
                  fontWeight: '700',
                  lineHeight: '1.2'
                }}>
                  ⚠️ 人員不足！
                </div>
              )}

            </div>
            
            <div style={{ textAlign: 'right', fontSize: '0.7rem', fontWeight: '800', color: '#e040fb', marginTop: '8px', paddingTop: '4px', borderTop: '1px dashed rgba(224, 64, 251, 0.2)' }}>
              仕掛: {wip.endingCount} 個
            </div>
          </div>

          {/* 3. 販売所 (グリーン ＆ セールスマン枠) */}
          <div style={{ 
            backgroundColor: 'rgba(76, 175, 80, 0.05)', 
            border: '1px solid rgba(76, 175, 80, 0.25)', 
            borderRadius: '8px', 
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>販売所</div>

              {activeResearchChips > 0 && (
                <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {Array.from({ length: activeResearchChips }).map((_, i) => (
                    <span key={i} style={{ fontSize: '0.7rem' }} title="マーケットリサーチ">🟢</span>
                  ))}
                  <span style={{ fontSize: '0.5rem', color: '#2e7d32', fontWeight: 'bold' }}>ﾘｻｰﾁ</span>
                </div>
              )}

              <div style={{ fontSize: '0.55rem', color: '#81c784', fontWeight: '700', marginBottom: '2px' }}>
                ｾｰﾙｽﾏﾝ:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', minHeight: '14px', alignItems: 'center' }}>
                {totalSalesmen > 0 ? Array.from({ length: totalSalesmen }).map((_, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', lineHeight: '1' }}>🧑‍💼</span>
                )) : (
                  <span style={{ fontSize: '0.55rem', color: 'rgba(76, 175, 80, 0.5)', fontStyle: 'italic' }}>不在</span>
                )}
              </div>
              
              <div style={{ fontSize: '0.55rem', color: '#81c784', fontWeight: '700', marginTop: '6px', marginBottom: '2px' }}>商品:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {prodChips.map((i) => (
                  <div 
                    key={i} 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: 'radial-gradient(circle, #81c784 0%, #388e3c 100%)', 
                      border: '1.5px solid #e8f5e9',
                      boxShadow: '0 2px 4px rgba(56, 142, 60, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  />
                ))}
                {prod.endingCount === 0 && (
                  <div style={{ fontSize: '0.65rem', color: 'rgba(76, 175, 80, 0.5)', fontStyle: 'italic' }}>製品なし</div>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.7rem', fontWeight: '800', color: '#4caf50', marginTop: '8px', paddingTop: '4px', borderTop: '1px dashed rgba(76, 175, 80, 0.2)' }}>
              製品: {prod.endingCount} 個
            </div>
          </div>

        </div>

        {/* 下段: チップ類 (本部機能) */}
        {(activeAdChips > 0 || activeInsuranceChips > 0 || activeRdChips > 0 || activeGenericGreenChips > 0) && (
          <div style={{ 
            backgroundColor: 'rgba(33, 150, 243, 0.05)', 
            border: '1px solid rgba(33, 150, 243, 0.25)', 
            borderRadius: '8px', 
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#2196f3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>本部</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {activeAdChips > 0 && (
                <div style={{ padding: '2px 6px', fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', border: '1px solid #ef5350' }}>
                  赤チップ (広告) 📣 × {activeAdChips}
                </div>
              )}
              {activeInsuranceChips > 0 && (
                <div style={{ padding: '2px 6px', fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#fff59d', color: '#f57f17', borderRadius: '4px', border: '1px solid #fbc02d' }}>
                  黄色チップ (保険) 🛡️ × {activeInsuranceChips}
                </div>
              )}
              {activeRdChips > 0 && (
                <div style={{ padding: '2px 6px', fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#e3f2fd', color: '#1565c0', borderRadius: '4px', border: '1px solid #42a5f5' }}>
                  青チップ (研究開発) 🔬 × {activeRdChips}
                </div>
              )}
              {activeGenericGreenChips > 0 && (
                <div style={{ padding: '2px 6px', fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', border: '1px solid #66bb6a' }}>
                  緑チップ (その他) 🟢 × {activeGenericGreenChips}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default CompanyBoardMinimap;
