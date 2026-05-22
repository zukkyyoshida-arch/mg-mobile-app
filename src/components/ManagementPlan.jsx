import React, { useState } from 'react';
import { calculateBudget } from '../utils/calculations';

function ManagementPlan({ budget, carryover, onUpdateBudget, results }) {
  const [currentScenario, setCurrentScenario] = useState('A'); // 'A', 'B', 'C'
  
  const [scenarios, setScenarios] = useState(() => {
    const period = results?.rank || 1;
    const rates = {
      1: { worker: 10, machine: 20, sales: 10, admin: 10 },
      2: { worker: 12, machine: 24, sales: 12, admin: 11 },
      3: { worker: 14, machine: 26, sales: 14, admin: 12 },
      4: { worker: 17, machine: 29, sales: 17, admin: 13 },
      5: { worker: 19, machine: 31, sales: 19, admin: 14 },
    };
    const currentRates = rates[period] || rates[5];

    const defaultData = {
      targetG: 100,
      
      // 労務費
      laborWorkers: carryover?.workers || 0,
      laborUnitPrice: currentRates.worker,
      
      // 製造経費
      mfgMachines: (carryover?.largeMachines || 0) + (carryover?.smallMachines || 0),
      mfgUnitPrice: currentRates.machine,
      mfgPacCount: 0,
      mfgRepairCount: 0,
      
      // 減価償却費
      depLarge: carryover?.largeMachines || 0,
      depSmall: carryover?.smallMachines || 0,
      depAttach: carryover?.attachments || 0,
      
      // 販売費
      salesSalesmen: carryover?.salesmen || 0,
      salesUnitPrice: currentRates.sales,
      salesResearchCount: 0,
      salesAdCount: 0,
      salesClaimCount: 0,
      
      // 一般管理費
      adminStaffTotal: (carryover?.workers || 0) + (carryover?.salesmen || 0),
      adminUnitPrice: currentRates.admin,
      adminMdCount: 0,
      adminInsuranceCount: 0,
      adminTransferCount: 0,
      adminHireCount: 0,
      
      // 営業外費用
      nonOpStartBalance: carryover?.loan || 0,
      nonOpStartRate: period >= 4 ? 5 : (period >= 2 ? 10 : 0),
      nonOpMidBalance: 0,
      nonOpMidRate: period >= 4 ? 5 : (period >= 2 ? 10 : 0),
      
      // 研究開発費
      rdCount: 0
    };
    return {
      A: { ...defaultData, targetG: 150 },
      B: { ...defaultData, targetG: 80 },
      C: { ...defaultData, targetG: 50 }
    };
  });

  const deriveTotals = (b) => {
    return {
      ...b,
      laborBudget: b.laborWorkers * b.laborUnitPrice,
      manufacturingBudget: (b.mfgMachines * b.mfgUnitPrice) + (b.mfgPacCount * 10) + (b.mfgRepairCount * 5),
      depreciationBudget: (b.depLarge * 20) + (b.depSmall * 10) + (b.depAttach * 2),
      salesBudget: (b.salesSalesmen * b.salesUnitPrice) + (b.salesResearchCount * 10) + (b.salesAdCount * 10) + (b.salesClaimCount * 5),
      adminBudget: (b.adminStaffTotal * b.adminUnitPrice) + (b.adminMdCount * 10) + (b.adminInsuranceCount * 5) + (b.adminTransferCount * 5) + (b.adminHireCount * 5),
      nonOperatingBudget: Math.round((b.nonOpStartBalance * b.nonOpStartRate / 100)) + Math.round((b.nonOpMidBalance * b.nonOpMidRate / 100)),
      rdBudget: b.rdCount * 20
    };
  };

  const activeBudget = scenarios[currentScenario];

  const handleInputChange = (field, val) => {
    const num = val === '' ? 0 : Number(val);
    const updatedScenario = {
      ...activeBudget,
      [field]: num
    };

    setScenarios(prev => ({
      ...prev,
      [currentScenario]: updatedScenario
    }));

    if (currentScenario === 'A') {
      onUpdateBudget(deriveTotals(updatedScenario));
    }
  };

  const calcResults = {
    A: calculateBudget(deriveTotals(scenarios.A)),
    B: calculateBudget(deriveTotals(scenarios.B)),
    C: calculateBudget(deriveTotals(scenarios.C))
  };

  const activeResult = calcResults[currentScenario];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      
      <div className="glass-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['A', 'B', 'C'].map((scenario) => (
            <button
              key={scenario}
              onClick={() => setCurrentScenario(scenario)}
              className={`nav-item ${currentScenario === scenario ? 'active' : ''}`}
              style={{ flex: 1, padding: '10px 0', fontSize: '1rem', fontWeight: '800' }}
            >
              {scenario} 予算
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '16px' }}>
        <div className="glass-card-header" style={{ marginBottom: '12px' }}>
          <h3 className="glass-card-title">① 必要目標利益 (G) を決める</h3>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <div className="input-with-icon">
              <span className="input-icon">¥</span>
              <input
                type="number"
                value={activeBudget.targetG || ''}
                onChange={(e) => handleInputChange('targetG', e.target.value)}
                placeholder="0"
                className="form-input"
                style={{ fontSize: '1.2rem', fontWeight: '800' }}
              />
              <span className="input-suffix">万</span>
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: 'rgba(236, 72, 153, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--mg-pink)', fontWeight: 'bold' }}>必要MQ (G+F)</div>
            <div className="electric-number" style={{ fontSize: '1.2rem', color: 'var(--mg-pink)' }}>
              ¥{activeResult.requiredMQ.toLocaleString()}<span style={{ fontSize: '0.9rem' }}>万</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="glass-card-header">
          <h3 className="glass-card-title">② 固定費予算 (F) の計画</h3>
        </div>

        {/* 1. 労務費 */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>1. 労務費</h4>
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ワーカー (人)</label>
              <input type="number" value={activeBudget.laborWorkers} onChange={(e) => handleInputChange('laborWorkers', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">期末処理単価</label>
              <input type="number" value={activeBudget.laborUnitPrice} onChange={(e) => handleInputChange('laborUnitPrice', e.target.value)} className="form-input" />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).laborBudget.toLocaleString()}万</div>
        </div>

        {/* 2. 製造経費 */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>2. 製造経費</h4>
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">機械 (台)</label>
              <input type="number" value={activeBudget.mfgMachines} onChange={(e) => handleInputChange('mfgMachines', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">期末処理単価</label>
              <input type="number" value={activeBudget.mfgUnitPrice} onChange={(e) => handleInputChange('mfgUnitPrice', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">PAC (枚) × 10</label>
              <input type="number" value={activeBudget.mfgPacCount} onChange={(e) => handleInputChange('mfgPacCount', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">修理改修費 (回) × 5</label>
              <input type="number" value={activeBudget.mfgRepairCount} onChange={(e) => handleInputChange('mfgRepairCount', e.target.value)} className="form-input" />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).manufacturingBudget.toLocaleString()}万</div>
        </div>

        {/* 3. 減価償却費 */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>3. 減価償却費</h4>
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">大型機械 (台) × 20</label>
              <input type="number" value={activeBudget.depLarge} onChange={(e) => handleInputChange('depLarge', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">小型機械 (台) × 10</label>
              <input type="number" value={activeBudget.depSmall} onChange={(e) => handleInputChange('depSmall', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '8px', marginBottom: 0 }}>
            <label className="form-label">アタッチメント (台) × 2</label>
            <input type="number" value={activeBudget.depAttach} onChange={(e) => handleInputChange('depAttach', e.target.value)} className="form-input" />
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).depreciationBudget.toLocaleString()}万</div>
        </div>

        {/* 4. 販売費 */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>4. 販売費</h4>
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ｾｰﾙｽﾏﾝ (人)</label>
              <input type="number" value={activeBudget.salesSalesmen} onChange={(e) => handleInputChange('salesSalesmen', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">期末処理単価</label>
              <input type="number" value={activeBudget.salesUnitPrice} onChange={(e) => handleInputChange('salesUnitPrice', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ﾘｻｰﾁ (枚) × 10</label>
              <input type="number" value={activeBudget.salesResearchCount} onChange={(e) => handleInputChange('salesResearchCount', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">広告 (枚) × 10</label>
              <input type="number" value={activeBudget.salesAdCount} onChange={(e) => handleInputChange('salesAdCount', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '8px', marginBottom: 0 }}>
            <label className="form-label">クレーム処理 (回) × 5</label>
            <input type="number" value={activeBudget.salesClaimCount} onChange={(e) => handleInputChange('salesClaimCount', e.target.value)} className="form-input" />
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).salesBudget.toLocaleString()}万</div>
        </div>

        {/* 5. 一般管理費 */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>5. 一般管理費</h4>
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ﾜｰｶｰ+ｾｰﾙｽﾏﾝ (人)</label>
              <input type="number" value={activeBudget.adminStaffTotal} onChange={(e) => handleInputChange('adminStaffTotal', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">期末処理単価</label>
              <input type="number" value={activeBudget.adminUnitPrice} onChange={(e) => handleInputChange('adminUnitPrice', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">MD (枚) × 10</label>
              <input type="number" value={activeBudget.adminMdCount} onChange={(e) => handleInputChange('adminMdCount', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">保険 (枚) × 5</label>
              <input type="number" value={activeBudget.adminInsuranceCount} onChange={(e) => handleInputChange('adminInsuranceCount', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">配置転換 (回) × 5</label>
              <input type="number" value={activeBudget.adminTransferCount} onChange={(e) => handleInputChange('adminTransferCount', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">採用・退職 (人) × 5</label>
              <input type="number" value={activeBudget.adminHireCount} onChange={(e) => handleInputChange('adminHireCount', e.target.value)} className="form-input" />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).adminBudget.toLocaleString()}万</div>
        </div>

        {/* 6. 営業外費用 */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>6. 営業外費用 (金利)</h4>
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">期首残高 (万)</label>
              <input type="number" value={activeBudget.nonOpStartBalance} onChange={(e) => handleInputChange('nonOpStartBalance', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">金利 (%)</label>
              <input type="number" value={activeBudget.nonOpStartRate} onChange={(e) => handleInputChange('nonOpStartRate', e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">期中借入 (万)</label>
              <input type="number" value={activeBudget.nonOpMidBalance} onChange={(e) => handleInputChange('nonOpMidBalance', e.target.value)} className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">金利 (%)</label>
              <input type="number" value={activeBudget.nonOpMidRate} onChange={(e) => handleInputChange('nonOpMidRate', e.target.value)} className="form-input" />
            </div>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).nonOperatingBudget.toLocaleString()}万</div>
        </div>

        {/* 7. 研究開発費 */}
        <div>
          <h4 style={{ color: 'var(--mg-blue)', marginBottom: '8px' }}>7. 研究開発費</h4>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">当期償却分 (枚) × 20</label>
            <input type="number" value={activeBudget.rdCount} onChange={(e) => handleInputChange('rdCount', e.target.value)} className="form-input" />
          </div>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '4px' }}>小計: ¥{deriveTotals(activeBudget).rdBudget.toLocaleString()}万</div>
        </div>

        {/* 固定費予算合計 */}
        <div className="glass-card" style={{ margin: '16px 0 0 0', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>固定費合計 (F):</span>
          <span className="electric-number" style={{ fontSize: '1.25rem', color: 'var(--mg-blue)' }}>
            ¥{activeResult.fixedCostTotal.toLocaleString()}万
          </span>
        </div>
      </div>

    </div>
  );
}

export default ManagementPlan;
