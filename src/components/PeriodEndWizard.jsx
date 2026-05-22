import React, { useState } from 'react';

function PeriodEndWizard({ carryover, ledger, actuals = {}, onUpdateActuals, results }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [actualMaterials, setActualMaterials] = useState(actuals?.actualMaterials ?? 0);
  const [actualWip, setActualWip] = useState(actuals?.actualWip ?? 0);
  const [actualProduct, setActualProduct] = useState(actuals?.actualProduct ?? 0);
  const [actualCash, setActualCash] = useState(actuals?.actualCash ?? 0);

  const handleStepChange = (step) => {
    setCurrentStep(step);
  };

  const handleActualChange = (field, val) => {
    const num = val === '' ? 0 : Number(val);
    if (field === 'mat') {
      setActualMaterials(num);
      onUpdateActuals({ ...actuals, actualMaterials: num });
    } else if (field === 'wip') {
      setActualWip(num);
      onUpdateActuals({ ...actuals, actualWip: num });
    } else if (field === 'prod') {
      setActualProduct(num);
      onUpdateActuals({ ...actuals, actualProduct: num });
    } else if (field === 'cash') {
      setActualCash(num);
      onUpdateActuals({ ...actuals, actualCash: num });
    }
  };

  // 材料/仕掛品/製品の帳簿残高 (理論値)
  const matTheoretical = results.mat.endingCount;
  const wipTheoretical = results.wip.endingCount;
  const prodTheoretical = results.prod.endingCount;
  const cashTheoretical = results.bookEndingCash;

  // 在庫不一致チェック
  const matMatches = matTheoretical === actualMaterials;
  const wipMatches = wipTheoretical === actualWip;
  const prodMatches = prodTheoretical === actualProduct;

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <div className="tab-panel">
        <div className="glass-card">
          <div className="glass-card-header">
            <h3 className="glass-card-title">
              📋 在庫の棚卸し
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            会社盤のトレイにある「実際の数」を数えて入力してください。出納帳から計算された「帳簿残高」と一致しているか照合します。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 材料の棚卸 */}
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>1. 材料 (原料)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    帳簿上の理論値: <span className="electric-number" style={{ color: 'var(--text-primary)' }}>{matTheoretical} 個</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      type="number"
                      value={actualMaterials ?? ''}
                      onChange={(e) => handleActualChange('mat', e.target.value)}
                      placeholder="盤の上の材料数"
                      min="0"
                      step="1"
                      className="form-input"
                      style={{ padding: '10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {matMatches ? (
                      <span className="badge badge-green" style={{ width: '100%', padding: '8px 0' }}>✅ 一致 (OK)</span>
                    ) : (
                      <span className="badge badge-pink" style={{ width: '100%', padding: '8px 0' }}>⚠️ ズレあり</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 仕掛品の棚卸 */}
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>2. 仕掛品 (仕掛中)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    帳簿上の理論値: <span className="electric-number" style={{ color: 'var(--text-primary)' }}>{wipTheoretical} 個</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      type="number"
                      value={actualWip ?? ''}
                      onChange={(e) => handleActualChange('wip', e.target.value)}
                      placeholder="盤の上の仕掛品数"
                      min="0"
                      step="1"
                      className="form-input"
                      style={{ padding: '10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {wipMatches ? (
                      <span className="badge badge-green" style={{ width: '100%', padding: '8px 0' }}>✅ 一致 (OK)</span>
                    ) : (
                      <span className="badge badge-pink" style={{ width: '100%', padding: '8px 0' }}>⚠️ ズレあり</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 製品の棚卸 */}
              <div style={{ paddingBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>3. 製品 (完成品)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    帳簿上の理論値: <span className="electric-number" style={{ color: 'var(--text-primary)' }}>{prodTheoretical} 個</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      type="number"
                      value={actualProduct ?? ''}
                      onChange={(e) => handleActualChange('prod', e.target.value)}
                      placeholder="盤の上の製品数"
                      min="0"
                      step="1"
                      className="form-input"
                      style={{ padding: '10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {prodMatches ? (
                      <span className="badge badge-green" style={{ width: '100%', padding: '8px 0' }}>✅ 一致 (OK)</span>
                    ) : (
                      <span className="badge badge-pink" style={{ width: '100%', padding: '8px 0' }}>⚠️ ズレあり</span>
                    )}
                  </div>
                </div>
              </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default PeriodEndWizard;
