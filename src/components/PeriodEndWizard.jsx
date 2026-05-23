import React, { useState, useEffect } from 'react';
import { SALARY_TABLE } from '../utils/calculations';

function PeriodEndWizard({ carryover, ledger, actuals = {}, onUpdateActuals, onUpdateLedger, currentPeriod, results }) {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Inventory state
  const [actualMaterials, setActualMaterials] = useState(actuals?.actualMaterials ?? 0);
  const [actualWip, setActualWip] = useState(actuals?.actualWip ?? 0);
  const [actualProduct, setActualProduct] = useState(actuals?.actualProduct ?? 0);
  const [actualCash, setActualCash] = useState(actuals?.actualCash ?? 0);

  // Step 2: Salary state
  const [periodEndWorkers, setPeriodEndWorkers] = useState('');
  const [periodEndSalesmen, setPeriodEndSalesmen] = useState('');

  // Initialize salary state when moving to step 2
  useEffect(() => {
    if (currentStep === 2) {
      if (periodEndWorkers === '') setPeriodEndWorkers((results?.workers || 0).toString());
      if (periodEndSalesmen === '') setPeriodEndSalesmen((results?.salesmen || 0).toString());
    }
  }, [currentStep, results, periodEndWorkers, periodEndSalesmen]);

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

  const confirmPeriodEnd = () => {
    const newTransactions = [];
    
    const wCount = Number(periodEndWorkers) || 0;
    const sCount = Number(periodEndSalesmen) || 0;
    const totalStaff = wCount + sCount;
    
    const periodKey = Math.min(5, Math.max(1, currentPeriod));
    const salaryUnit = SALARY_TABLE.normal[periodKey] || 0;
    const insuranceUnit = SALARY_TABLE.insurance[periodKey] || 0;
    
    const workerSal = wCount * salaryUnit;
    const salesmanSal = sCount * salaryUnit;
    const insurance = totalStaff * insuranceUnit;

    if (workerSal > 0) {
      newTransactions.push({ id: Date.now().toString() + "-w-sal", category: "シ", quantity: 1, amount: workerSal, price: workerSal, timestamp: new Date(Date.now() + 1).toISOString(), customName: "ワーカー給与の支払", customShortName: "労務" });
    }
    if (salesmanSal > 0) {
      newTransactions.push({ id: Date.now().toString() + "-s-sal", category: "セ", quantity: 1, amount: salesmanSal, price: salesmanSal, timestamp: new Date(Date.now() + 2).toISOString(), customName: "セールス給与の支払", customShortName: "給与" });
    }
    if (insurance > 0) {
      newTransactions.push({ id: Date.now().toString() + "-ins", category: "ソ", quantity: 1, amount: insurance, price: insurance, timestamp: new Date(Date.now() + 3).toISOString(), customName: "社会保険料の支払", customShortName: "保険" });
    }

    const tax = results?.carryover?.taxes || 0;
    if (tax > 0) {
      newTransactions.push({ id: Date.now().toString() + "-ni", category: "ニ", quantity: 1, amount: tax, price: tax, timestamp: new Date(Date.now() + 4).toISOString() });
    }
    const loan = results?.carryover?.loan || 0;
    if (loan > 0) {
      newTransactions.push({ id: Date.now().toString() + "-na", category: "ナ", quantity: 1, amount: loan, price: loan, timestamp: new Date(Date.now() + 5).toISOString() });
    }

    if (newTransactions.length === 0) {
      alert("期末に処理する給与・支払いがありません。");
      setCurrentStep(1); // Go back or show completed
      return;
    }
    
    onUpdateLedger([...ledger, ...newTransactions]);
    alert("給与などの期末データを出納帳に登録しました！");
    setCurrentStep(1); // Reset for next time or stay at step 2
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
        
        {currentStep === 1 && (
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                📋 ステップ 1: 在庫の棚卸し
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
                <div style={{ paddingBottom: '16px' }}>
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
                
                <button 
                  onClick={() => setCurrentStep(2)} 
                  className="btn-premium" 
                  style={{ 
                    width: '100%', 
                    marginTop: '16px',
                    background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.2) 0%, rgba(0, 119, 255, 0.2) 100%)',
                    border: '1px solid rgba(0, 176, 255, 0.4)',
                    color: '#40c4ff',
                    boxShadow: '0 4px 16px rgba(0, 176, 255, 0.15)'
                  }}
                >
                  次へ：人数の確定と給与支払 →
                </button>

            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                👥 ステップ 2: 人数の確定と給与支払
              </h3>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              期末に残っているワーカー数とセールスマン数を確認・修正してください。人数に基づいて給与が計算され、出納帳に反映されます。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* ワーカー数の確認 */}
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>1. ワーカー数</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    帳簿上の理論値: <span className="electric-number" style={{ color: 'var(--text-primary)' }}>{results?.workers || 0} 人</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={periodEndWorkers}
                      onChange={(e) => setPeriodEndWorkers(e.target.value)}
                      placeholder="実際の人数"
                      min="0"
                      step="1"
                      className="form-input"
                      style={{ padding: '10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {periodEndWorkers !== '' && Number(periodEndWorkers) === (results?.workers || 0) ? (
                      <span className="badge badge-green" style={{ width: '100%', padding: '8px 0' }}>✅ 一致 (OK)</span>
                    ) : (
                      <span className="badge badge-pink" style={{ width: '100%', padding: '8px 0' }}>⚠️ ズレあり</span>
                    )}
                  </div>
                </div>
              </div>

              {/* セールスマン数の確認 */}
              <div style={{ paddingBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>2. セールスマン数</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    帳簿上の理論値: <span className="electric-number" style={{ color: 'var(--text-primary)' }}>{results?.salesmen || 0} 人</span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={periodEndSalesmen}
                      onChange={(e) => setPeriodEndSalesmen(e.target.value)}
                      placeholder="実際の人数"
                      min="0"
                      step="1"
                      className="form-input"
                      style={{ padding: '10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {periodEndSalesmen !== '' && Number(periodEndSalesmen) === (results?.salesmen || 0) ? (
                      <span className="badge badge-green" style={{ width: '100%', padding: '8px 0' }}>✅ 一致 (OK)</span>
                    ) : (
                      <span className="badge badge-pink" style={{ width: '100%', padding: '8px 0' }}>⚠️ ズレあり</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {(() => {
              const wCount = Number(periodEndWorkers) || 0;
              const sCount = Number(periodEndSalesmen) || 0;
              const totalStaff = wCount + sCount;
              const periodKey = Math.min(5, Math.max(1, currentPeriod));
              const salaryUnit = SALARY_TABLE.normal[periodKey] || 0;
              const insuranceUnit = SALARY_TABLE.insurance[periodKey] || 0;
              const workerSal = wCount * salaryUnit;
              const salesmanSal = sCount * salaryUnit;
              const insurance = totalStaff * insuranceUnit;
              const totalAmount = workerSal + salesmanSal + insurance;
              
              return (
                <div style={{ background: 'rgba(0, 176, 255, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    第{currentPeriod}期の給与単価: {salaryUnit}万 / 保険単価: {insuranceUnit}万
                  </p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>労務費(シ): ¥{workerSal}万</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>販売費(セ): ¥{salesmanSal}万</p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>社会保険料(ソ): ¥{insurance}万</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    合計引落額: ¥{totalAmount}万
                  </p>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setCurrentStep(1)} 
                className="btn-premium" 
                style={{ 
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)'
                }}
              >
                ← 戻る
              </button>
              <button 
                onClick={confirmPeriodEnd} 
                className="btn-premium" 
                style={{ 
                  flex: 2,
                  background: 'linear-gradient(135deg, var(--mg-pink) 0%, #ff80b0 100%)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(255, 46, 147, 0.3)'
                }}
              >
                🏁 給与を確定して登録
              </button>
            </div>
            
          </div>
        )}
        
      </div>
    </div>
  );
}

export default PeriodEndWizard;
