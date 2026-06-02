import React, { useMemo, useState } from 'react';
import { calculateBudget } from '../utils/calculations';

const SCENARIOS = ['A', 'B', 'C'];

const fixedCostGroups = [
  {
    key: 'laborBudget',
    label: '労務費',
    rows: [
      { key: 'laborWorkers', label: 'ワーカー', suffix: '人', unitField: 'laborUnitPrice', unitLabel: '期末処理単価', unitSuffix: '万' }
    ]
  },
  {
    key: 'manufacturingBudget',
    label: '製造経費',
    rows: [
      { key: 'mfgMachines', label: '機械', suffix: '台', unitField: 'mfgUnitPrice', unitLabel: '期末処理単価', unitSuffix: '万' },
      { key: 'mfgPacCount', label: 'PAC生産性', suffix: '枚', multiplier: 10 },
      { key: 'mfgRepairCount', label: '修理改修費', suffix: '回', multiplier: 5 }
    ]
  },
  {
    key: 'depreciationBudget',
    label: '減価償却費',
    rows: [
      { key: 'depLarge', label: '大型40', suffix: '台', multiplier: 20 },
      { key: 'depAttach', label: 'アタッチメント4', suffix: '台', multiplier: 2 },
      { key: 'depSmall', label: '小型20', suffix: '台', multiplier: 10 }
    ]
  },
  {
    key: 'salesBudget',
    label: '販売費',
    rows: [
      { key: 'salesSalesmen', label: 'セールスマン', suffix: '人', unitField: 'salesUnitPrice', unitLabel: '期末処理単価', unitSuffix: '万' },
      { key: 'salesResearchCount', label: 'マーケットリサーチ', suffix: '枚', multiplier: 10 },
      { key: 'salesAdCount', label: '広告', suffix: '枚', multiplier: 10 },
      { key: 'salesClaimCount', label: 'クレーム処理', suffix: '回', multiplier: 5 }
    ]
  },
  {
    key: 'adminBudget',
    label: '一般管理費',
    rows: [
      { key: 'adminStaffTotal', label: 'ワーカー+セールスマン', suffix: '人', unitField: 'adminUnitPrice', unitLabel: '期末処理単価', unitSuffix: '万' },
      { key: 'adminMdCount', label: 'マーチャンダイザー', suffix: '枚', multiplier: 10 },
      { key: 'adminInsuranceCount', label: '保険', suffix: '枚', multiplier: 5 },
      { key: 'adminTransferCount', label: '配置転換及び退職', suffix: '回', multiplier: 5 },
      { key: 'adminHireCount', label: '研究所リース料', suffix: '回', multiplier: 20 }
    ]
  },
  {
    key: 'nonOperatingBudget',
    label: '営業外費用',
    rows: [
      { key: 'nonOpStartBalance', label: '期首残高', suffix: '万', rateField: 'nonOpStartRate' },
      { key: 'nonOpMidBalance', label: '期中借入', suffix: '万', rateField: 'nonOpMidRate' }
    ]
  },
  {
    key: 'rdBudget',
    label: '研究開発費',
    rows: [
      { key: 'rdSpecialCount', label: '特急', suffix: '枚', multiplier: 40 },
      { key: 'rdNormalCount', label: '通常', suffix: '枚', multiplier: 20 }
    ]
  }
];

const summaryCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
};

const metricCellStyle = {
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  minHeight: '54px',
  padding: '8px'
};

function ManagementPlan({ budget, carryover, onUpdateBudget, results }) {
  const period = Number(results?.currentPeriod || results?.period || 1);

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

  const deriveTotals = (scenario) => {
    const normalized = {
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
    };

    return normalized;
  };

  const calculatedScenarios = useMemo(() => {
    return SCENARIOS.reduce((acc, scenarioKey) => {
      const withTotals = deriveTotals(scenarios[scenarioKey]);
      const budgetResult = calculateBudget(withTotals, carryover);
      const plannedMP = Math.max(0, (withTotals.plannedP || 0) - (withTotals.plannedVP || 0));
      const requiredQ = plannedMP > 0 ? Math.ceil(budgetResult.requiredMQ / plannedMP) : 0;
      const plannedSales = requiredQ * (withTotals.plannedP || 0);
      const plannedVariableCost = requiredQ * (withTotals.plannedVP || 0);
      const fmRatio = budgetResult.requiredMQ > 0 ? Math.round((budgetResult.fixedCostTotal / budgetResult.requiredMQ) * 100) : 0;

      acc[scenarioKey] = {
        ...withTotals,
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

  const handleScenarioChange = (scenarioKey, field, value) => {
    const parsed = value === '' ? 0 : Number(value);
    const next = {
      ...scenarios[scenarioKey],
      [field]: parsed
    };

    setScenarios((prev) => ({
      ...prev,
      [scenarioKey]: next
    }));

    if (scenarioKey === 'A') {
      onUpdateBudget(deriveTotals(next));
    }
  };

  const renderScenarioInput = (scenarioKey, field, opts = {}) => (
    <input
      type="number"
      value={scenarios[scenarioKey][field] ?? ''}
      onChange={(e) => handleScenarioChange(scenarioKey, field, e.target.value)}
      className="form-input"
      style={{
        minWidth: 0,
        textAlign: 'right',
        padding: '8px 10px',
        fontSize: opts.emphasis ? '0.95rem' : '0.85rem',
        fontWeight: opts.emphasis ? '700' : '600'
      }}
    />
  );

  return (
    <div style={{ padding: '0 0 100px 0' }}>
      <div className="glass-card" style={{ padding: '18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '6px', color: 'var(--mg-blue)' }}>第{period}期 MG経営計画</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>シニアルールに合わせて A/B/C 予算を一枚で比較できる計画表</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 180px', border: '1px solid #cbd5e1', background: '#ffffff' }}>
            <div style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: 'var(--text-secondary)' }}>社名</div>
            <input value={meta.companyName} onChange={(e) => setMeta((prev) => ({ ...prev, companyName: e.target.value }))} className="form-input" style={{ border: 'none', borderRadius: 0 }} />
            <div style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', fontWeight: '700', color: 'var(--text-secondary)' }}>社長名</div>
            <input value={meta.presidentName} onChange={(e) => setMeta((prev) => ({ ...prev, presidentName: e.target.value }))} className="form-input" style={{ border: 'none', borderRadius: 0 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.2fr) repeat(3, minmax(92px, 1fr))', gap: '0', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1' }}>
          <div style={{ padding: '10px 12px', background: '#f8fafc', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '800', color: 'var(--text-primary)' }}>項目</div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`head-${scenarioKey}`} style={{ padding: '10px 12px', background: '#eff6ff', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '800', textAlign: 'center', color: 'var(--mg-blue)' }}>
              {scenarioKey}予算
            </div>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
            <div style={{ fontWeight: '700', marginBottom: '4px' }}>1. 必要Gを決める</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>必要目標利益</div>
          </div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`g-${scenarioKey}`} style={{ padding: '8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
              {renderScenarioInput(scenarioKey, 'targetG', { emphasis: true })}
            </div>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
            <div style={{ fontWeight: '700', marginBottom: '2px' }}>2. 固定費Fを決める</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>各項目を入力して固定費合計を算出</div>
          </div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`blank-f-${scenarioKey}`} style={{ borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }} />
          ))}

          {fixedCostGroups.map((group) => (
            <React.Fragment key={group.key}>
              <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                <div style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>{group.label}</div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {group.rows.map((row) => (
                    <div key={row.key} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {row.label}
                      {row.multiplier ? ` (${row.multiplier}万)` : ''}
                      {row.unitField ? ` / ${row.unitLabel}` : ''}
                      {row.rateField ? ' / 金利' : ''}
                    </div>
                  ))}
                </div>
              </div>
              {SCENARIOS.map((scenarioKey) => (
                <div key={`${group.key}-${scenarioKey}`} style={{ padding: '8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {group.rows.map((row) => (
                      <div key={`${scenarioKey}-${row.key}`} style={{ display: 'grid', gap: '6px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: row.unitField || row.rateField ? '1fr 1fr' : '1fr', gap: '6px' }}>
                          {renderScenarioInput(scenarioKey, row.key)}
                          {row.unitField && renderScenarioInput(scenarioKey, row.unitField)}
                          {row.rateField && renderScenarioInput(scenarioKey, row.rateField)}
                        </div>
                      </div>
                    ))}
                    <div style={{ ...summaryCardStyle, padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>小計</div>
                      <div style={{ fontWeight: '800', textAlign: 'right' }}>¥{calculatedScenarios[scenarioKey][group.key].toLocaleString()}万</div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '800' }}>固定費合計 F</div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`total-f-${scenarioKey}`} style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '900', textAlign: 'right', color: 'var(--mg-blue)' }}>
              ¥{calculatedScenarios[scenarioKey].fixedCostTotal.toLocaleString()}万
            </div>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
            <div style={{ fontWeight: '700' }}>3. 必要mPQを計算する</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>必要G + 計算F = 必要mPQ</div>
          </div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`mq-${scenarioKey}`} style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '900', textAlign: 'right' }}>
              ¥{calculatedScenarios[scenarioKey].requiredMQ.toLocaleString()}万
            </div>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
            <div style={{ fontWeight: '700', marginBottom: '4px' }}>4. 予定P、予定vPを決める</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>予定P / 予定vP(材料単価+投入費+完成費)</div>
          </div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`pv-${scenarioKey}`} style={{ padding: '8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', display: 'grid', gap: '6px' }}>
              {renderScenarioInput(scenarioKey, 'plannedP')}
              {renderScenarioInput(scenarioKey, 'plannedVP')}
            </div>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
            <div style={{ fontWeight: '700' }}>5. 予定mPを計算する</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>予定mP = 予定P - 予定vP</div>
          </div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`mp-${scenarioKey}`} style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '900', textAlign: 'right' }}>
              ¥{calculatedScenarios[scenarioKey].plannedMP.toLocaleString()}万
            </div>
          ))}

          <div style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
            <div style={{ fontWeight: '700' }}>6. 売上に必要Qを出す</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>必要mPQ / 予定mP = 必要Q</div>
          </div>
          {SCENARIOS.map((scenarioKey) => (
            <div key={`q-${scenarioKey}`} style={{ padding: '12px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '900', textAlign: 'right' }}>
              {calculatedScenarios[scenarioKey].requiredQ.toLocaleString()}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', margin: '0 16px' }}>
        {SCENARIOS.map((scenarioKey) => {
          const scenario = calculatedScenarios[scenarioKey];
          return (
            <div key={`summary-${scenarioKey}`} className="glass-card" style={{ margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: '800', color: 'var(--mg-blue)' }}>{scenarioKey}予算</span>
                <span className="saas-pill">Q {scenario.requiredQ}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '10px', alignItems: 'start' }}>
                <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, minmax(52px, auto))', gap: '8px' }}>
                  <div style={metricCellStyle}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>P</div>
                    <div style={{ fontWeight: '800', marginTop: '6px' }}>¥{scenario.plannedP}</div>
                  </div>
                  <div style={metricCellStyle}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>vP</div>
                    <div style={{ fontWeight: '800', marginTop: '6px' }}>¥{scenario.plannedVP}</div>
                  </div>
                  <div style={metricCellStyle}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>mP</div>
                    <div style={{ fontWeight: '800', marginTop: '6px', color: 'var(--mg-blue)' }}>¥{scenario.plannedMP}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px', gridTemplateRows: '52px 52px 52px', gap: '8px' }}>
                  <div style={metricCellStyle}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Q</div>
                    <div style={{ fontWeight: '800', marginTop: '6px' }}>{scenario.requiredQ}</div>
                  </div>
                  <div style={{ ...metricCellStyle, gridRow: '1 / span 3' }}>
                    <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1fr', height: '100%', gap: '8px' }}>
                      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>vPQ</div>
                        <div style={{ fontWeight: '800', marginTop: '6px' }}>¥{scenario.plannedVariableCost.toLocaleString()}</div>
                      </div>
                      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>mPQ</div>
                        <div style={{ fontWeight: '800', marginTop: '6px', color: 'var(--mg-blue)' }}>¥{scenario.requiredMQ.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>PQ</div>
                        <div style={{ fontWeight: '800', marginTop: '6px' }}>¥{scenario.plannedSales.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                  <div style={metricCellStyle}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>F</div>
                    <div style={{ fontWeight: '800', marginTop: '6px' }}>¥{scenario.fixedCostTotal.toLocaleString()}</div>
                  </div>
                  <div style={{ ...metricCellStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>f/m</div>
                    <div style={{ fontWeight: '800', marginTop: '4px' }}>{scenario.fmRatio}%</div>
                  </div>
                  <div style={metricCellStyle}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>G</div>
                    <div style={{ fontWeight: '800', marginTop: '6px' }}>¥{scenario.targetG.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ManagementPlan;
