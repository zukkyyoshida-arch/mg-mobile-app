import React, { useMemo, useState } from 'react';
import { calculateBudget } from '../utils/calculations';

const SCENARIOS = ['A', 'B', 'C'];

const fixedCostGroups = [
  {
    key: 'laborBudget',
    label: '労務費',
    rows: [
      { key: 'laborWorkers', label: 'ワーカー人数', unitField: 'laborUnitPrice', unitLabel: '期末処理単価', suffix: '人', unitSuffix: '万' }
    ]
  },
  {
    key: 'manufacturingBudget',
    label: '製造経費',
    rows: [
      { key: 'mfgMachines', label: '機械台数', unitField: 'mfgUnitPrice', unitLabel: '期末処理単価', suffix: '台', unitSuffix: '万' },
      { key: 'mfgPacCount', label: 'PAC生産性', multiplier: 10, suffix: '枚' },
      { key: 'mfgRepairCount', label: '修理改修費', multiplier: 5, suffix: '回' }
    ]
  },
  {
    key: 'depreciationBudget',
    label: '減価償却費',
    rows: [
      { key: 'depLarge', label: '大型40', multiplier: 20, suffix: '台' },
      { key: 'depAttach', label: 'アタッチメント4', multiplier: 2, suffix: '台' },
      { key: 'depSmall', label: '小型20', multiplier: 10, suffix: '台' }
    ]
  },
  {
    key: 'salesBudget',
    label: '販売費',
    rows: [
      { key: 'salesSalesmen', label: 'セールスマン人数', unitField: 'salesUnitPrice', unitLabel: '期末処理単価', suffix: '人', unitSuffix: '万' },
      { key: 'salesResearchCount', label: 'マーケットリサーチ', multiplier: 10, suffix: '枚' },
      { key: 'salesAdCount', label: '広告', multiplier: 10, suffix: '枚' },
      { key: 'salesClaimCount', label: 'クレーム処理', multiplier: 5, suffix: '回' }
    ]
  },
  {
    key: 'adminBudget',
    label: '一般管理費',
    rows: [
      { key: 'adminStaffTotal', label: 'ワーカー+セールスマン', unitField: 'adminUnitPrice', unitLabel: '期末処理単価', suffix: '人', unitSuffix: '万' },
      { key: 'adminMdCount', label: 'マーチャンダイザー', multiplier: 10, suffix: '枚' },
      { key: 'adminInsuranceCount', label: '保険', multiplier: 5, suffix: '枚' },
      { key: 'adminTransferCount', label: '配置転換及び退職', multiplier: 5, suffix: '回' },
      { key: 'adminHireCount', label: '研究所リース料', multiplier: 20, suffix: '回' }
    ]
  },
  {
    key: 'nonOperatingBudget',
    label: '営業外費用',
    rows: [
      { key: 'nonOpStartBalance', label: '期首残高', rateField: 'nonOpStartRate', suffix: '万', rateSuffix: '%' },
      { key: 'nonOpMidBalance', label: '期中借入', rateField: 'nonOpMidRate', suffix: '万', rateSuffix: '%' }
    ]
  },
  {
    key: 'rdBudget',
    label: '研究開発費',
    rows: [
      { key: 'rdSpecialCount', label: '特急', multiplier: 40, suffix: '枚' },
      { key: 'rdNormalCount', label: '通常', multiplier: 20, suffix: '枚' }
    ]
  }
];

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '14px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
};

function ManagementPlan({ carryover, onUpdateBudget, results }) {
  const period = Number(results?.currentPeriod || results?.period || 1);
  const [currentScenario, setCurrentScenario] = useState('A');
  const [meta, setMeta] = useState({ companyName: '', presidentName: '' });

  const [scenarios, setScenarios] = useState(() => {
    const rates = {
      1: { worker: 10, machine: 20, sales: 10, admin: 10 },
      2: { worker: 12, machine: 24, sales: 12, admin: 11 },
      3: { worker: 14, machine: 26, sales: 14, admin: 12 },
      4: { worker: 17, machine: 29, sales: 17, admin: 13 },
      5: { worker: 19, machine: 31, sales: 19, admin: 14 }
    };
    const currentRates = rates[period] || rates[5];

    const defaultData = {
      targetG: 100,
      laborWorkers: carryover?.workers || 0,
      laborUnitPrice: currentRates.worker,
      mfgMachines: (carryover?.largeMachines || 0) + (carryover?.smallMachines || 0),
      mfgUnitPrice: currentRates.machine,
      mfgPacCount: 0,
      mfgRepairCount: 0,
      depLarge: carryover?.largeMachines || 0,
      depSmall: carryover?.smallMachines || 0,
      depAttach: carryover?.attachments || 0,
      salesSalesmen: carryover?.salesmen || 0,
      salesUnitPrice: currentRates.sales,
      salesResearchCount: 0,
      salesAdCount: 0,
      salesClaimCount: 0,
      adminStaffTotal: (carryover?.workers || 0) + (carryover?.salesmen || 0),
      adminUnitPrice: currentRates.admin,
      adminMdCount: 0,
      adminInsuranceCount: 0,
      adminTransferCount: 0,
      adminHireCount: 0,
      nonOpStartBalance: carryover?.loan || 0,
      nonOpStartRate: period >= 4 ? 5 : period >= 2 ? 10 : 0,
      nonOpMidBalance: 0,
      nonOpMidRate: period >= 4 ? 5 : period >= 2 ? 10 : 0,
      rdSpecialCount: 0,
      rdNormalCount: 0,
      plannedP: 0,
      plannedVP: 0
    };

    return {
      A: { ...defaultData, targetG: 150 },
      B: { ...defaultData, targetG: 80 },
      C: { ...defaultData, targetG: 50 }
    };
  });

  const deriveTotals = (scenario) => ({
    ...scenario,
    laborBudget: (scenario.laborWorkers || 0) * (scenario.laborUnitPrice || 0),
    manufacturingBudget:
      (scenario.mfgMachines || 0) * (scenario.mfgUnitPrice || 0) +
      (scenario.mfgPacCount || 0) * 10 +
      (scenario.mfgRepairCount || 0) * 5,
    depreciationBudget:
      (scenario.depLarge || 0) * 20 +
      (scenario.depSmall || 0) * 10 +
      (scenario.depAttach || 0) * 2,
    salesBudget:
      (scenario.salesSalesmen || 0) * (scenario.salesUnitPrice || 0) +
      (scenario.salesResearchCount || 0) * 10 +
      (scenario.salesAdCount || 0) * 10 +
      (scenario.salesClaimCount || 0) * 5,
    adminBudget:
      (scenario.adminStaffTotal || 0) * (scenario.adminUnitPrice || 0) +
      (scenario.adminMdCount || 0) * 10 +
      (scenario.adminInsuranceCount || 0) * 5 +
      (scenario.adminTransferCount || 0) * 5 +
      (scenario.adminHireCount || 0) * 20,
    nonOperatingBudget:
      Math.round((scenario.nonOpStartBalance || 0) * (scenario.nonOpStartRate || 0) / 100) +
      Math.round((scenario.nonOpMidBalance || 0) * (scenario.nonOpMidRate || 0) / 100),
    rdBudget:
      (scenario.rdSpecialCount || 0) * 40 +
      (scenario.rdNormalCount || 0) * 20
  });

  const calculated = useMemo(() => {
    return SCENARIOS.reduce((acc, key) => {
      const full = deriveTotals(scenarios[key]);
      const budgetResult = calculateBudget(full, carryover);
      const plannedMP = Math.max(0, (full.plannedP || 0) - (full.plannedVP || 0));
      const requiredQ = plannedMP > 0 ? Math.ceil(budgetResult.requiredMQ / plannedMP) : 0;
      const plannedSales = requiredQ * (full.plannedP || 0);
      const plannedVariableCost = requiredQ * (full.plannedVP || 0);
      const fmRatio = budgetResult.requiredMQ > 0 ? Math.round((budgetResult.fixedCostTotal / budgetResult.requiredMQ) * 100) : 0;

      acc[key] = {
        ...full,
        ...budgetResult,
        plannedMP,
        requiredQ,
        plannedSales,
        plannedVariableCost,
        fmRatio
      };
      return acc;
    }, {});
  }, [carryover, scenarios]);

  const activeScenario = scenarios[currentScenario];
  const activeResult = calculated[currentScenario];

  const handleChange = (field, value) => {
    const parsed = value === '' ? 0 : Number(value);
    const next = { ...activeScenario, [field]: parsed };
    setScenarios((prev) => ({ ...prev, [currentScenario]: next }));
    if (currentScenario === 'A') onUpdateBudget(deriveTotals(next));
  };

  const renderInput = (field, opts = {}) => (
    <div style={{ display: 'grid', gap: '6px' }}>
      <label style={{ fontSize: '0.74rem', lineHeight: 1.35, color: 'var(--text-secondary)', fontWeight: '600' }}>{opts.label}</label>
      <input
        type="number"
        value={activeScenario[field] ?? ''}
        onChange={(e) => handleChange(field, e.target.value)}
        className="form-input"
        style={{ textAlign: 'right', fontWeight: '700', fontSize: '0.95rem', padding: '10px 12px' }}
      />
    </div>
  );

  const renderCostGroup = (group) => (
    <div key={group.key} style={{ ...cardStyle, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '0.86rem', fontWeight: '800', color: 'var(--text-primary)' }}>{group.label}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>必要な項目だけ順番に入力</div>
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--mg-blue)' }}>¥{activeResult[group.key].toLocaleString()}万</div>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {group.rows.map((row) => (
          <div key={row.key} style={{ padding: '10px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.78rem', lineHeight: 1.35, fontWeight: '700', marginBottom: '8px' }}>{row.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {renderInput(row.key, { label: row.suffix ? `数量 (${row.suffix})` : '数量' })}
              {row.unitField && renderInput(row.unitField, { label: `${row.unitLabel} (${row.unitSuffix || ''})` })}
              {row.rateField && renderInput(row.rateField, { label: `金利 (${row.rateSuffix || '%'})` })}
            </div>
            {row.multiplier && (
              <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                1件あたり {row.multiplier}万で計算
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '0 0 100px 0', display: 'grid', gap: '14px' }}>
      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--mg-blue)', marginBottom: '4px' }}>第{period}期 MG経営計画</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>スマホで上から順番に埋めていける縦長レイアウト</p>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          <input
            value={meta.companyName}
            onChange={(e) => setMeta((prev) => ({ ...prev, companyName: e.target.value }))}
            className="form-input"
            placeholder="社名"
          />
          <input
            value={meta.presidentName}
            onChange={(e) => setMeta((prev) => ({ ...prev, presidentName: e.target.value }))}
            className="form-input"
            placeholder="社長名"
          />
        </div>
      </div>

      <div className="glass-card" style={{ padding: '12px 16px', position: 'sticky', top: '8px', zIndex: 5 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {SCENARIOS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCurrentScenario(key)}
              className={currentScenario === key ? 'btn-primary' : 'btn-secondary'}
              style={{ width: '100%', padding: '9px 0', fontWeight: '800', fontSize: '0.9rem' }}
            >
              {key}予算
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, margin: '0 16px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', marginBottom: '12px' }}>1. 必要Gを決める</div>
        {renderInput('targetG', { label: '必要目標利益 G (万)' })}
      </div>

      <div style={{ ...cardStyle, margin: '0 16px', padding: '14px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', marginBottom: '12px' }}>2. 固定費 F を積み上げる</div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {fixedCostGroups.map(renderCostGroup)}
        </div>
        <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800' }}>固定費合計 F</span>
          <span style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--mg-blue)' }}>¥{activeResult.fixedCostTotal.toLocaleString()}万</span>
        </div>
      </div>

      <div style={{ ...cardStyle, margin: '0 16px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', marginBottom: '12px' }}>3. 必要mPQを計算する</div>
        <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>必要G + 計算F</div>
          <div style={{ marginTop: '6px', fontSize: '1.1rem', fontWeight: '900' }}>¥{activeResult.requiredMQ.toLocaleString()}万</div>
        </div>
      </div>

      <div style={{ ...cardStyle, margin: '0 16px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', marginBottom: '12px' }}>4. 予定P / 予定vP を決める</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {renderInput('plannedP', { label: '予定P (販売単価)' })}
          {renderInput('plannedVP', { label: '予定vP (材料+投入+完成)' })}
        </div>
      </div>

      <div style={{ ...cardStyle, margin: '0 16px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', marginBottom: '12px' }}>5. 予定mP / 必要Q を確認する</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>予定mP</span>
            <strong style={{ color: 'var(--mg-blue)' }}>¥{activeResult.plannedMP.toLocaleString()}万</strong>
          </div>
          <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>必要Q</span>
            <strong>{activeResult.requiredQ.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ margin: '0 16px', padding: '14px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', marginBottom: '12px' }}>6. 予算サマリー</div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>P</div><div style={{ fontWeight: '800', marginTop: '6px' }}>¥{activeResult.plannedP}</div></div>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>vP</div><div style={{ fontWeight: '800', marginTop: '6px' }}>¥{activeResult.plannedVP}</div></div>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>mP / Q</div><div style={{ fontWeight: '800', marginTop: '6px' }}>¥{activeResult.plannedMP.toLocaleString()} / {activeResult.requiredQ}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>PQ</div><div style={{ fontWeight: '800', marginTop: '6px' }}>¥{activeResult.plannedSales.toLocaleString()}</div></div>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>vPQ</div><div style={{ fontWeight: '800', marginTop: '6px' }}>¥{activeResult.plannedVariableCost.toLocaleString()}</div></div>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>mPQ</div><div style={{ fontWeight: '800', marginTop: '6px', color: 'var(--mg-blue)' }}>¥{activeResult.requiredMQ.toLocaleString()}</div></div>
            <div style={cardStyle}><div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>F / G</div><div style={{ fontWeight: '800', marginTop: '6px' }}>¥{activeResult.fixedCostTotal.toLocaleString()} / ¥{activeResult.targetG.toLocaleString()}</div></div>
          </div>
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>f/m</span>
            <strong>{activeResult.fmRatio}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagementPlan;
