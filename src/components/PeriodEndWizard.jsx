import React, { useState, useEffect } from 'react';
import { SALARY_TABLE } from '../utils/calculations';

function PeriodEndWizard({ carryover, ledger, actuals, onUpdateActuals, onUpdateLedger, currentPeriod, results, onShowPerformance }) {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Inventory state
  const [actualMaterials, setActualMaterials] = useState(actuals?.actualMaterials ?? '');
  const [actualWip, setActualWip] = useState(actuals?.actualWip ?? '');
  const [actualProduct, setActualProduct] = useState(actuals?.actualProduct ?? '');
  const [actualCash, setActualCash] = useState(actuals?.actualCash ?? '');

  // Step 2: Salary state
  const [periodEndWorkers, setPeriodEndWorkers] = useState('');
  const [periodEndSalesmen, setPeriodEndSalesmen] = useState('');

  // Step 3: AR Collection state
  const [arCollection, setArCollection] = useState('');

  // Step 1.5: Disposal state
  const [fireSaleCount, setFireSaleCount] = useState(0);
  const [fireSaleType, setFireSaleType] = useState('cash'); // 'cash' or 'credit'
  const [disposedState, setDisposedState] = useState({ prod: 0, wip: 0, mat: 0, required: false });

  // Initialize salary state when moving to step 2
  useEffect(() => {
    if (currentStep === 2) {
      if (periodEndWorkers === '') setPeriodEndWorkers((results?.workers || 0).toString());
      if (periodEndSalesmen === '') setPeriodEndSalesmen((results?.salesmen || 0).toString());
    }
  }, [currentStep, results, periodEndWorkers, periodEndSalesmen]);

  const handleActualChange = (field, val) => {
    const rawVal = val === '' ? '' : Number(val);
    const updateVal = val === '' ? 0 : Number(val);
    
    if (field === 'mat') {
      setActualMaterials(rawVal);
      onUpdateActuals({ ...actuals, actualMaterials: updateVal });
    } else if (field === 'wip') {
      setActualWip(rawVal);
      onUpdateActuals({ ...actuals, actualWip: updateVal });
    } else if (field === 'prod') {
      setActualProduct(rawVal);
      onUpdateActuals({ ...actuals, actualProduct: updateVal });
    } else if (field === 'cash') {
      setActualCash(rawVal);
      onUpdateActuals({ ...actuals, actualCash: updateVal });
    }
  };

  // 材料/仕掛品/製品の帳簿残高 (理論値)
  const matTheoretical = results.mat.endingCount;
  const wipTheoretical = results.wip.endingCount;
  const prodTheoretical = results.prod.endingCount;
  const cashTheoretical = results.bookEndingCash;

  // 在庫不一致チェック
  const safeMat = actualMaterials === '' ? 0 : actualMaterials;
  const safeWip = actualWip === '' ? 0 : actualWip;
  const safeProd = actualProduct === '' ? 0 : actualProduct;

  const matMatches = matTheoretical === safeMat;
  const wipMatches = wipTheoretical === safeWip;
  const prodMatches = prodTheoretical === safeProd;

  const handleNextStep = () => {
    const safeMat = actualMaterials === '' ? 0 : actualMaterials;
    const safeWip = actualWip === '' ? 0 : actualWip;
    const safeProd = actualProduct === '' ? 0 : actualProduct;
    
    const matDiff = matTheoretical - safeMat;
    const wipDiff = wipTheoretical - safeWip;
    const prodDiff = prodTheoretical - safeProd;

    if (matDiff < 0 || wipDiff < 0 || prodDiff < 0) {
      alert(`⚠️ 盤上の個数が理論値よりも多くなっています。\n余分な個数（材料:${matDiff<0 ? -matDiff : 0}, 仕掛品:${wipDiff<0 ? -wipDiff : 0}, 製品:${prodDiff<0 ? -prodDiff : 0}）はストッカーに戻し、理論値に合わせてから次へ進んでください。`);
      return;
    }

    if (matDiff > 0 || wipDiff > 0 || prodDiff > 0) {
      const confirm = window.confirm(`⚠️ 盤上の個数が不足しています（材料:-${matDiff}, 仕掛品:-${wipDiff}, 製品:-${prodDiff}）。\nこのまま進むと、不足分は「特別損失（紛失ロス）」として計上されますがよろしいですか？`);
      if (!confirm) {
        return;
      }
    }

    const totalActual = safeMat + safeWip + safeProd;
    if (totalActual > 20) {
      const excess = totalActual - 20;
      let remaining = excess;
      const reduceProd = Math.min(safeProd, remaining);
      remaining -= reduceProd;
      const reduceWip = Math.min(safeWip, remaining);
      remaining -= reduceWip;
      const reduceMat = Math.min(safeMat, remaining);
      
      setDisposedState({ prod: reduceProd, wip: reduceWip, mat: reduceMat, required: true });
      setFireSaleCount(reduceProd); // Default to fire sale all possible products
      setCurrentStep(1.5);
      return;
    }

    setCurrentStep(2);
  };

  const currentLedgerLoan = ledger.reduce((sum, item) => item.category === 'オ' ? sum + Number(item.amount || 0) : sum, 0);
  const currentLedgerRepay = ledger.reduce((sum, item) => item.category === 'ナ' ? sum + Number(item.amount || 0) : sum, 0);
  const totalLoan = (carryover?.loan || 0) + currentLedgerLoan;
  const requiredRepayment = Math.ceil(totalLoan * 0.2);
  const remainingRepayment = Math.max(0, requiredRepayment - currentLedgerRepay);

  // 計算のヘルパー
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
  const currentCash = results.bookEndingCash || 0;
  const arToCollect = Number(arCollection) || 0;
  
  const fireSaleRevenue = (disposedState.required && fireSaleType === 'cash') ? (fireSaleCount * 18) : 0;
  const finalCash = currentCash - totalAmount - remainingRepayment + arToCollect + fireSaleRevenue;

  const confirmPeriodEnd = () => {
    const newTransactions = [];
    if (workerSal > 0) {
      newTransactions.push({ id: Date.now().toString() + "-w-sal", category: "シ", quantity: 1, amount: workerSal, price: workerSal, timestamp: new Date(Date.now() + 1).toISOString(), customName: "ワーカー給与の支払", customShortName: "労務" });
    }
    if (salesmanSal > 0) {
      newTransactions.push({ id: Date.now().toString() + "-s-sal", category: "セ", quantity: 1, amount: salesmanSal, price: salesmanSal, timestamp: new Date(Date.now() + 2).toISOString(), customName: "セールス給与の支払", customShortName: "給与" });
    }
    if (insurance > 0) {
      newTransactions.push({ id: Date.now().toString() + "-ins", category: "ソ", quantity: 1, amount: insurance, price: insurance, timestamp: new Date(Date.now() + 3).toISOString(), customName: "社会保険料の支払", customShortName: "保険" });
    }

    const safeMat = actualMaterials === '' ? 0 : actualMaterials;
    const safeWip = actualWip === '' ? 0 : actualWip;
    const safeProd = actualProduct === '' ? 0 : actualProduct;

    const matDiff = matTheoretical - safeMat;
    const wipDiff = wipTheoretical - safeWip;
    const prodDiff = prodTheoretical - safeProd;

    if (matDiff > 0) {
      newTransactions.push({ id: Date.now().toString() + "-loss-mat", category: "棚卸ロス(材料)", quantity: matDiff, amount: 0, price: 0, timestamp: new Date(Date.now() + 4).toISOString(), customName: "期末棚卸による材料紛失", customShortName: "ロス" });
    }
    if (wipDiff > 0) {
      newTransactions.push({ id: Date.now().toString() + "-loss-wip", category: "棚卸ロス(仕掛品)", quantity: wipDiff, amount: 0, price: 0, timestamp: new Date(Date.now() + 5).toISOString(), customName: "期末棚卸による仕掛品紛失", customShortName: "ロス" });
    }
    
    const actualLossProd = prodDiff - (disposedState.required ? fireSaleCount : 0);
    if (actualLossProd > 0) {
      newTransactions.push({ id: Date.now().toString() + "-loss-prod", category: "棚卸ロス(製品)", quantity: actualLossProd, amount: 0, price: 0, timestamp: new Date(Date.now() + 6).toISOString(), customName: "期末棚卸による製品紛失", customShortName: "ロス" });
    }

    if (disposedState.required && fireSaleCount > 0) {
      const isCash = fireSaleType === 'cash';
      newTransactions.push({ 
        id: Date.now().toString() + "-fire-sale", 
        category: isCash ? "キ" : "ネ", 
        quantity: fireSaleCount, 
        amount: fireSaleCount * 18, 
        price: 18, 
        timestamp: new Date(Date.now() + 6.5).toISOString(), 
        customName: `期末製品投げ売り(${isCash ? '現金' : '掛売'})`, 
        customShortName: "投売" 
      });
    }

    if (remainingRepayment > 0) {
      newTransactions.push({ id: Date.now().toString() + "-loan-repay", category: "ナ", quantity: 1, amount: remainingRepayment, price: remainingRepayment, timestamp: new Date(Date.now() + 7).toISOString(), customName: "期末の自動借入返済 (20%)", customShortName: "返済" });
    }

    if (arToCollect > 0) {
      newTransactions.push({ id: Date.now().toString() + "-ar-col", category: "ア", quantity: 1, amount: arToCollect, price: arToCollect, timestamp: new Date(Date.now() + 8).toISOString(), customName: "期末の売掛金回収", customShortName: "回収" });
    }

    if (newTransactions.length === 0) {
      alert("期末に処理する給与・支払いがありません。\n成績発表画面を開きます。");
      setCurrentStep(1); 
      if (onShowPerformance) onShowPerformance();
      return;
    }
    
    onUpdateLedger([...ledger, ...newTransactions]);
    alert("給与などの期末データを出納帳に登録しました！\n成績発表画面を開きます。");
    setCurrentStep(1);
    if (onShowPerformance) onShowPerformance();
  };



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
                  onClick={handleNextStep} 
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

        {currentStep === 1.5 && (
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title" style={{ color: 'var(--mg-pink)' }}>
                ⚠️ ステップ 1.5: 在庫超過の強制処分
              </h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '16px', fontWeight: 'bold' }}>
              在庫合計が20個を超えています (現在: {(actualMaterials === '' ? 0 : actualMaterials) + (actualWip === '' ? 0 : actualWip) + (actualProduct === '' ? 0 : actualProduct)}個)。ルールにより、製品→仕掛品→材料の順で20個以下になるまで処分する必要があります。
            </p>

            <div style={{ background: 'rgba(255, 46, 147, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>処分対象 (合計: {disposedState.prod + disposedState.wip + disposedState.mat}個):</p>
              {disposedState.prod > 0 && <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem' }}>・製品: {disposedState.prod}個</p>}
              {disposedState.wip > 0 && <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem' }}>・仕掛品: {disposedState.wip}個 (自動的に廃棄ロス)</p>}
              {disposedState.mat > 0 && <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem' }}>・材料: {disposedState.mat}個 (自動的に廃棄ロス)</p>}
            </div>

            {disposedState.prod > 0 && (
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>📦 製品の処分方法</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>投げ売りする数 (1個18万)</label>
                    <input
                      type="number"
                      value={fireSaleCount}
                      onChange={(e) => setFireSaleCount(Math.min(disposedState.prod, Math.max(0, Number(e.target.value) || 0)))}
                      min="0"
                      max={disposedState.prod}
                      className="form-input"
                      style={{ padding: '8px', width: '100%' }}
                    />
                  </div>
                  
                  {fireSaleCount > 0 && (
                    <div>
                      <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>投げ売りの売上方法</label>
                      <select 
                        value={fireSaleType} 
                        onChange={(e) => setFireSaleType(e.target.value)}
                        className="form-input"
                        style={{ padding: '8px', width: '100%' }}
                      >
                        <option value="cash">現金売上 (すぐに入金)</option>
                        <option value="credit">掛売 (次期回収)</option>
                      </select>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--mg-blue)' }}>
                        売上見込: ¥{fireSaleCount * 18}万
                      </p>
                    </div>
                  )}

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      廃棄処理 (ロス): <strong style={{ color: 'var(--mg-pink)' }}>{disposedState.prod - fireSaleCount}個</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                const safeMat = actualMaterials === '' ? 0 : actualMaterials;
                const safeWip = actualWip === '' ? 0 : actualWip;
                const safeProd = actualProduct === '' ? 0 : actualProduct;
                const newProd = safeProd - disposedState.prod;
                const newWip = safeWip - disposedState.wip;
                const newMat = safeMat - disposedState.mat;
                
                setActualProduct(newProd);
                setActualWip(newWip);
                setActualMaterials(newMat);
                
                onUpdateActuals({
                  ...actuals,
                  actualProduct: newProd,
                  actualWip: newWip,
                  actualMaterials: newMat
                });
                
                setCurrentStep(2);
              }} 
              className="btn-premium" 
              style={{ 
                width: '100%',
                background: 'linear-gradient(135deg, rgba(255, 46, 147, 0.2) 0%, rgba(255, 128, 176, 0.2) 100%)',
                border: '1px solid rgba(255, 46, 147, 0.4)',
                color: 'var(--mg-pink)',
                boxShadow: '0 4px 16px rgba(255, 46, 147, 0.15)'
              }}
            >
              処分を確定して次へ →
            </button>
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
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>社会保険料(ソ): ¥{insurance}万</p>
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
                onClick={() => setCurrentStep(3)} 
                className="btn-premium" 
                style={{ 
                  flex: 2,
                  background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.2) 0%, rgba(0, 119, 255, 0.2) 100%)',
                  border: '1px solid rgba(0, 176, 255, 0.4)',
                  color: '#40c4ff',
                  boxShadow: '0 4px 16px rgba(0, 176, 255, 0.15)'
                }}
              >
                次へ：最終資金確認 →
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                💰 ステップ 3: 最終現金確認
              </h3>
            </div>
            
            <div style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                💡 <strong>AIクラウド会計の事前予測</strong><br/>
                キャッシュアウト（資金ショート）する前に、期末の現金残高をシミュレーションします。<br/>
                マイナスになる場合は、ここで売掛金を回収して補填するか、一度画面を閉じて借入（オ）を行ってください。
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>現在の現金:</span>
                <span style={{ fontWeight: 'bold' }}>¥{currentCash}万</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--mg-pink)' }}>
                <span>➖ 給与・保険料合計:</span>
                <span>-¥{totalAmount}万</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: 'var(--mg-pink)' }}>
                <span>➖ 借入金返済(自動20%):</span>
                <span>-¥{remainingRepayment}万</span>
              </div>
              
              {fireSaleRevenue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: 'var(--mg-blue)' }}>
                  <span>➕ 製品投げ売り(現金):</span>
                  <span>+¥{fireSaleRevenue}万</span>
                </div>
              )}
              
              {results.endingReceivables > 0 && (
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '12px', marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    ➕ 売掛金入金（ア） <span style={{color:'var(--text-muted)'}}>(最大 {results.endingReceivables}万)</span>
                  </label>
                  <input
                    type="number"
                    value={arCollection}
                    onChange={(e) => setArCollection(Math.min(results.endingReceivables, Math.max(0, Number(e.target.value) || 0)))}
                    placeholder="回収する金額を入力"
                    className="form-input"
                    style={{ width: '100%', padding: '10px' }}
                  />
                  {arToCollect > 0 && (
                    <div style={{ textAlign: 'right', marginTop: '4px', color: 'var(--mg-blue)', fontSize: '0.9rem' }}>
                      回収額: +¥{arToCollect}万
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>最終現金残高:</span>
                <span style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: 'bold', 
                  color: finalCash < 0 ? 'var(--mg-pink)' : 'var(--text-primary)' 
                }}>
                  ¥{finalCash}万
                </span>
              </div>
            </div>

            {finalCash < 0 && (
              <div style={{ background: 'rgba(255, 46, 147, 0.1)', border: '1px solid var(--mg-pink)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--mg-pink)' }}>
                  ⚠️ <strong>現金が不足しています！</strong><br/>
                  このままでは資金ショートしてしまいます。上の入力欄から売掛金を回収するか、一度「戻る」で閉じてからメイン画面で借入を行ってください。
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setCurrentStep(2)} 
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
                disabled={finalCash < 0}
                className="btn-premium" 
                style={{ 
                  flex: 2,
                  background: finalCash < 0 ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--mg-pink) 0%, #ff80b0 100%)',
                  color: finalCash < 0 ? 'var(--text-muted)' : '#fff',
                  border: finalCash < 0 ? '1px solid var(--text-muted)' : 'none',
                  boxShadow: finalCash < 0 ? 'none' : '0 4px 16px rgba(255, 46, 147, 0.3)',
                  cursor: finalCash < 0 ? 'not-allowed' : 'pointer'
                }}
              >
                🏁 {finalCash < 0 ? '確定不可（残高不足）' : '出納帳に確定登録'}
              </button>
            </div>
            
          </div>
        )}
        
        
      </div>
    </div>
  );
}

export default PeriodEndWizard;
