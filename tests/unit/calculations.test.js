import { describe, it, expect } from 'vitest';
import { calculateFinancials, calculateBudget, DEFAULT_PERIOD_DATA } from '../../src/utils/calculations.js';

// テストで繰り返し使う「まっさらな期首繰越」を都度複製して返すヘルパー。
// DEFAULT_PERIOD_DATA.carryover を直接使い回すとテスト間で参照汚染が起きるため必ずコピーする。
function freshCarryover(overrides = {}) {
  return { ...JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA.carryover)), ...overrides };
}

describe('calculateFinancials - 基本ケース', () => {
  it('空のledger・初期carryoverで期末現金と資本金が維持され、B/Sが貸借一致する', () => {
    const res = calculateFinancials(freshCarryover(), [], {}, 1);

    // 初期値: 現金300, 資本金300, 取引ゼロ
    // ただし赤字扱いのため法人税は一律7万が課税される（実装仕様）
    expect(res.bookEndingCash).toBe(300);
    expect(res.bs.cash).toBe(300);
    expect(res.pl.corporateTax).toBe(7);
    expect(res.pl.netProfit).toBe(-7);
    expect(res.bs.retainedEarnings).toBe(-7);
    expect(res.bs.totalNetAssets).toBe(293); // 資本金300 + 繰越利益剰余金-7

    // B/S貸借一致
    expect(res.bs.totalAssets).toBe(res.bs.totalLiabilitiesAndNetAssets);
    expect(res.bs.difference).toBe(0);
  });

  it('取引が一切ない場合、未払法人税7万が負債として計上される', () => {
    const res = calculateFinancials(freshCarryover(), [], {}, 1);
    expect(res.bs.unpaidTax).toBe(7);
    expect(res.bs.totalLiabilities).toBe(7);
  });
});

describe('calculateFinancials - 一連の取引によるP/Lと在庫評価', () => {
  // 機械購入→材料仕入→採用→投入/完成→販売→固定費、という一連の流れ
  const ledger = [
    { category: 'ケ', amount: 200, quantity: 1, smallMachines: 1 },
    { category: 'ツ', amount: 30, quantity: 3 },
    { category: '採用', amount: 10, workersHired: 1, salesmenHired: 1 },
    { category: 'コ', amount: 6, quantity: 3 },
    { category: 'サ', amount: 3, quantity: 3 },
    { category: 'キ', amount: 120, quantity: 3 },
    { category: 'PAC', amount: 10 },
    { category: 'MD', amount: 10 },
    { category: 'ツ', amount: 120, quantity: 13 },
    { category: 'コ', amount: 10, quantity: 5 },
    { category: 'サ', amount: 5, quantity: 5 },
    { category: 'コ', amount: 10, quantity: 5 },
    { category: 'キ', amount: 192, quantity: 5 },
    { category: 'シ', amount: 18 },
    { category: 'セ', amount: 18 },
    { category: 'ソ', amount: 24 },
  ];
  const res = calculateFinancials(freshCarryover(), ledger, {}, 1);

  it('売上高PQ・変動費vPQ・付加価値mPQ・m率が正しく計算される', () => {
    // 売上高 = 120 + 192 = 312
    expect(res.pl.salesRevenue).toBe(312);
    // 売上原価(cogsValue) = 販売個数8個分の按分値
    expect(res.pl.variableCost).toBe(res.prod.cogsValue);
    expect(res.pl.margin).toBe(res.pl.salesRevenue - res.pl.variableCost);
    expect(res.pl.marginRatio).toBeCloseTo((res.pl.margin / res.pl.salesRevenue) * 100, 6);
  });

  it('経常利益G = 付加価値 - 固定費F', () => {
    expect(res.pl.operatingProfit).toBe(res.pl.margin - res.pl.fixedCost);
  });

  it('材料・仕掛品・製品の在庫評価が一貫する（総投入=期首+当期増加）', () => {
    // 材料: 期首0 + 仕入(ツ 3+13=16個, 30+120=150万) = 総数16, 総額150
    expect(res.mat.purchaseCount).toBe(16);
    expect(res.mat.purchaseValue).toBe(150);
    expect(res.mat.totalCount).toBe(16);
    expect(res.mat.totalValue).toBe(150);
    // 投入(コ) = 3+5+5 = 13個
    expect(res.mat.inputCount).toBe(13);
    // 期末材料 = 16 - 13 = 3個
    expect(res.mat.endingCount).toBe(3);

    // 仕掛品: 投入13個、完成(サ) = 3+5 = 8個
    expect(res.wip.completedCount).toBe(8);
    expect(res.wip.endingCount).toBe(13 - 8);

    // 製品: 完成8個、販売(キ) = 3+5 = 8個 → 期末0
    expect(res.prod.completedCount).toBe(8);
    expect(res.prod.salesCount).toBe(8);
    expect(res.prod.endingCount).toBe(0);
  });

  it('B/Sが貸借一致する', () => {
    expect(res.bs.totalAssets).toBe(res.bs.totalLiabilitiesAndNetAssets);
    expect(res.bs.difference).toBe(0);
  });
});

describe('calculateFinancials - 借入・利息・返済', () => {
  it('借入(オ)・利息(タ)・返済(ナ)を経て期末借入残高が正しく算出される', () => {
    const ledger = [
      { category: 'オ', amount: 100 },
      { category: 'タ', amount: 10 },
      { category: 'ナ', amount: 30 },
    ];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    // 借入金 = 期首0 + 借入100 - 返済30 = 70
    expect(res.bs.loans).toBe(70);
    expect(res.endingLoans).toBe(70);
    // 利息(タ)は営業外費用としてPLに計上される
    expect(res.pl.nonOperatingCost).toBe(10);
    expect(res.bs.difference).toBe(0);
  });

  it('期首に借入残高がある状態から追加返済すると残高が減る', () => {
    const carryover = freshCarryover({ loan: 50 });
    const ledger = [{ category: 'ナ', amount: 20 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    expect(res.bs.loans).toBe(30);
  });

  it('借入金残高がマイナスにならないよう0でガードされる', () => {
    const carryover = freshCarryover({ loan: 10 });
    const ledger = [{ category: 'ナ', amount: 999 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    expect(res.bs.loans).toBe(0);
  });
});

describe('calculateFinancials - 減価償却', () => {
  it('第1期は減価償却費がゼロになる（練習期のため）', () => {
    const ledger = [{ category: 'ケ', amount: 200, quantity: 1, largeMachines: 1 }];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.machines.depreciation).toBe(0);
    expect(res.machines.endingValue).toBe(200);
  });

  it('第2期以降は期首簿価+当期購入額の20%が減価償却される', () => {
    const carryover = freshCarryover({ machinesValue: 200, largeMachines: 1, machinesCount: 1 });
    const res = calculateFinancials(carryover, [], {}, 2);
    // (200 + 0) * 0.2 = 40
    expect(res.machines.depreciation).toBe(40);
    expect(res.machines.endingValue).toBe(160);
  });

  it('第2期に新規購入がある場合、期首簿価+新規購入額の合計に20%がかかる', () => {
    const carryover = freshCarryover({ machinesValue: 200, largeMachines: 1, machinesCount: 1 });
    const ledger = [{ category: 'ケ', amount: 100, quantity: 1, smallMachines: 1 }];
    const res = calculateFinancials(carryover, ledger, {}, 2);
    // (200 + 100) * 0.2 = 60
    expect(res.machines.depreciation).toBe(60);
    expect(res.machines.endingValue).toBe(240); // 200+100-60
  });

  it('第3〜5期でも同様に20%償却が継続する', () => {
    const carryover = freshCarryover({ machinesValue: 160, largeMachines: 1, machinesCount: 1 });
    const res = calculateFinancials(carryover, [], {}, 3);
    expect(res.machines.depreciation).toBe(32); // 160*0.2
  });
});

describe('calculateFinancials - 機械台数トラッキング', () => {
  it('期首台数 + 購入(ケ) - 売却(イ) で最終台数が算出される', () => {
    const carryover = freshCarryover({ largeMachines: 2, smallMachines: 1, attachments: 1, machinesValue: 500 });
    const ledger = [
      { category: 'ケ', amount: 100, quantity: 1, largeMachines: 1 },
      { category: 'イ', amount: 50, soldSmallMachines: 1 },
    ];
    const res = calculateFinancials(carryover, ledger, {}, 2);
    expect(res.machines.large).toBe(3);
    expect(res.machines.small).toBe(0);
    expect(res.machines.attachments).toBe(1);
    // トップレベルにも同じ値が公開される
    expect(res.largeMachines).toBe(3);
    expect(res.smallMachines).toBe(0);
    expect(res.attachments).toBe(1);
  });

  it('売却台数が保有台数を超える場合はMath.max(0,)でガードされマイナスにならない', () => {
    const carryover = freshCarryover({ largeMachines: 1 });
    const ledger = [{ category: 'イ', amount: 50, soldLargeMachines: 5 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    expect(res.machines.large).toBe(0);
  });

  it('sold*フィールドの無い旧形式の売却エントリは台数へ影響しない（後方互換）', () => {
    const carryover = freshCarryover({ largeMachines: 2 });
    const ledger = [{ category: 'イ', amount: 50 }]; // soldLargeMachinesなど無し
    const res = calculateFinancials(carryover, ledger, {}, 1);
    expect(res.machines.large).toBe(2);
    // ただし売却収入自体はPLの特別利益に反映される
    expect(res.pl.extraordinaryGain).toBe(50);
  });
});

describe('calculateFinancials - PAC生産能力計算', () => {
  it('大型機械は基本生産能力4、小型機械は1として計算される', () => {
    const carryover = freshCarryover({ largeMachines: 2, workers: 2 });
    const res = calculateFinancials(carryover, [], {}, 1);
    expect(res.productionCapacity).toBe(8); // 2台 * 4
  });

  it('アタッチメントは稼働中の小型機械1台につき+1（稼働小型機械数が上限）', () => {
    // 小型2台稼働、アタッチメント3個保有 → 有効アタッチメントは稼働小型数(2)まで
    const carryover = freshCarryover({ smallMachines: 2, attachments: 3, workers: 2 });
    const res = calculateFinancials(carryover, [], {}, 1);
    // 小型2*1=2 + effectiveAttachments min(3,2)=2 => 4
    expect(res.productionCapacity).toBe(4);
  });

  it('PACチップ購入で稼働中の各機械につき+1される', () => {
    const carryover = freshCarryover({ largeMachines: 2, smallMachines: 1, attachments: 1, workers: 3 });
    const ledger = [{ category: 'PAC', amount: 10, quantity: 1 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    // 大型2*4=8, 小型1*1=1, アタッチ min(1, operatingSmall=1)=1 => +1
    // PACチップ: operatingLarge(2)*1 + operatingSmall(1)*1 = 3
    // 合計 = 8+1+1+3 = 13
    expect(res.productionCapacity).toBe(13);
  });

  it('ワーカー割当は大型機械優先で、ワーカー不足時は稼働台数が制限される', () => {
    // 大型2台・小型2台保有だがワーカーは1人のみ
    const carryover = freshCarryover({ largeMachines: 2, smallMachines: 2, workers: 1 });
    const res = calculateFinancials(carryover, [], {}, 1);
    // 大型優先で1台のみ稼働(ワーカー1人使用) → 4、小型は稼働ワーカーが残っていないので0
    expect(res.productionCapacity).toBe(4);
  });

  it('ワーカーが0人の場合、機械を保有していても生産能力は0になる', () => {
    const carryover = freshCarryover({ largeMachines: 2, smallMachines: 2, workers: 0 });
    const res = calculateFinancials(carryover, [], {}, 1);
    expect(res.productionCapacity).toBe(0);
  });
});

describe('calculateFinancials - 事故災害（火災・製造ミス・盗難）', () => {
  it('火災は保有材料を全損させ、保険チップがあれば個数×8万が自動保険金として計上される', () => {
    const ledger = [
      { category: 'ツ', amount: 100, quantity: 10 },
      { category: '保険', amount: 20, quantity: 1 },
      { category: '火災', amount: 0, quantity: 0 },
    ];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.mat.fireCount).toBe(10);
    expect(res.mat.fireValue).toBe(100);
    // 保険金 10個 * 8万 = 80万 が特別利益に加算される
    expect(res.pl.extraordinaryGain).toBe(80);
    expect(res.pl.extraordinaryLoss).toBe(100);
  });

  it('製造ミスは数量未指定の場合デフォルト1個が仕掛品から失われる', () => {
    const ledger = [
      { category: 'ツ', amount: 30, quantity: 3 },
      { category: 'コ', amount: 6, quantity: 3 },
      { category: '製造ミス', amount: 0, quantity: 0 },
    ];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.wip.missCount).toBe(1);
  });

  it('盗難は数量未指定の場合デフォルト2個が製品から失われる', () => {
    const ledger = [
      { category: 'ツ', amount: 30, quantity: 3 },
      { category: 'コ', amount: 6, quantity: 3 },
      { category: 'サ', amount: 3, quantity: 3 },
      { category: '盗難', amount: 0, quantity: 0 },
    ];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.prod.theftCount).toBe(2);
  });
});

describe('calculateFinancials - 法人税計算', () => {
  it('黒字かつ前期繰越利益剰余金がプラスの場合、税引前利益の30%が課税される', () => {
    const ledger = [{ category: 'キ', amount: 100, quantity: 5 }];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.pl.profitBeforeTax).toBe(100);
    expect(res.pl.corporateTax).toBe(30); // Math.round(100*0.3)
  });

  it('前期繰越がマイナスでも合計がプラスなら合計額の30%が課税される', () => {
    const carryover = freshCarryover({ retainedEarnings: -50 });
    const ledger = [{ category: 'キ', amount: 100, quantity: 5 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    // totalTaxBase = 100 + (-50) = 50 → 50*0.3=15
    expect(res.pl.corporateTax).toBe(15);
  });

  it('赤字の場合は一律7万円が課税される（下限）', () => {
    const ledger = [{ category: 'ツ', amount: 50, quantity: 5 }];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.pl.profitBeforeTax).toBeLessThanOrEqual(0);
    expect(res.pl.corporateTax).toBe(7);
  });
});

describe('calculateFinancials - 期末処理前後のP/L切り替え', () => {
  it('期末処理前（シ・セ・ソが未計上）は推定給与・保険料がPLに反映される', () => {
    const carryover = freshCarryover();
    const ledger = [{ category: '採用', amount: 10, workersHired: 1, salesmenHired: 1 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    // period1のnormal給与単価18万 * ワーカー1 = 18、セールスマンも18
    expect(res.pl.laborCost).toBe(18);
    expect(res.pl.salesCost).toBeGreaterThanOrEqual(18);
    // 未払給与が負債(accruedLaborCost)として計上されB/Sが一致する
    expect(res.bs.accruedLaborCost).toBeGreaterThan(0);
    expect(res.bs.difference).toBe(0);
  });

  it('期末処理後（シ・セ・ソに実績が入る）は出納帳実績値がPLに反映され、未払給与は計上されない', () => {
    const carryover = freshCarryover();
    const ledger = [
      { category: '採用', amount: 10, workersHired: 1, salesmenHired: 1 },
      { category: 'シ', amount: 18 },
      { category: 'セ', amount: 18 },
      { category: 'ソ', amount: 24 },
    ];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    expect(res.pl.laborCost).toBe(18);
    expect(res.bs.accruedLaborCost).toBe(0);
    expect(res.bs.difference).toBe(0);
  });
});

describe('calculateBudget', () => {
  it('手入力の固定費予算F各項目が合算される（自動利息なし＝借入残高0の場合）', () => {
    const budget = {
      targetG: 100,
      laborBudget: 20,
      manufacturingBudget: 10,
      depreciationBudget: 5,
      salesBudget: 15,
      adminBudget: 8,
      nonOperatingBudget: 2,
      rdBudget: 3,
    };
    const res = calculateBudget(budget, freshCarryover({ loan: 0 }), 1);
    expect(res.fixedCostTotal).toBe(63); // 20+10+5+15+8+2+3
    expect(res.autoInterestCost).toBe(0);
    expect(res.requiredMQ).toBe(163); // G(100) + F(63)
  });

  it('期1〜3は前期繰越の借入残高に対し10%が支払利息として自動計上される', () => {
    const budget = { targetG: 0 };
    const res = calculateBudget(budget, freshCarryover({ loan: 100 }), 1);
    expect(res.autoInterestCost).toBe(10);
    expect(res.autoInterestRate).toBe(0.10);
    expect(res.fixedCostTotal).toBe(10);
  });

  it('期4〜5は前期繰越の借入残高に対し5%が支払利息として自動計上される', () => {
    const budget = { targetG: 0 };
    const res = calculateBudget(budget, freshCarryover({ loan: 100 }), 4);
    expect(res.autoInterestCost).toBe(5);
    expect(res.autoInterestRate).toBe(0.05);

    const res5 = calculateBudget(budget, freshCarryover({ loan: 100 }), 5);
    expect(res5.autoInterestCost).toBe(5);
    expect(res5.autoInterestRate).toBe(0.05);
  });

  it('carryoverがundefined/nullでも例外にならず利息0として安全に動作する', () => {
    const budget = { targetG: 50 };
    expect(() => calculateBudget(budget, undefined, 1)).not.toThrow();
    expect(() => calculateBudget(budget, null, 2)).not.toThrow();
    const res1 = calculateBudget(budget, undefined, 1);
    const res2 = calculateBudget(budget, null, 2);
    expect(res1.autoInterestCost).toBe(0);
    expect(res2.autoInterestCost).toBe(0);
    expect(res1.requiredMQ).toBe(50);
  });

  it('必要MQ = 目標G + 固定費合計F', () => {
    const budget = { targetG: 200, laborBudget: 50 };
    const res = calculateBudget(budget, freshCarryover({ loan: 0 }), 1);
    expect(res.requiredMQ).toBe(res.fixedCostTotal + 200);
  });
});

describe('calculateFinancials - 旧test_*.jsスクリプトから引き継いだシナリオ', () => {
  // 旧 test_bs.js: 期末給与処理（ワーカー1・セールスマン1）でB/Sが一致することの確認
  it('期末給与処理（ワーカー1名・セールスマン1名）後もB/Sが一致する（旧test_bs.js）', () => {
    const ledger = [
      { category: 'シ', amount: 18 },
      { category: 'セ', amount: 18 },
      { category: 'ソ', amount: 24 }, // 12 * 2名
    ];
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    expect(res.bs.difference).toBe(0);
  });

  // 旧 test_hiring.js: amountに負値を入力した不正な採用エントリでも計算がクラッシュしないこと
  // （実装の疑わしい挙動あり。下記コメント参照）
  it('採用エントリにamountとして負の数値が入っても例外を起こさず計算できる（旧test_hiring.js）', () => {
    const ledger = [
      { category: '採用', amount: -50000, quantity: 0, workersHired: 1, salesmenHired: 0 },
    ];
    expect(() => calculateFinancials(freshCarryover(), ledger, {}, 1)).not.toThrow();
    const res = calculateFinancials(freshCarryover(), ledger, {}, 1);
    // amountの符号をそのまま使わずMath.absで出金額としているため、
    // 負の入力値でも「巨大な出金」として処理される（＝入力バリデーションはcalculations.js側にはない）
    expect(res.cashOutflow).toBe(50000);
    expect(res.bookEndingCash).toBe(300 - 50000);
  });

  // 旧 test_personnel.js: 1期→2期の人員・減価償却の繰り越しシナリオ
  it('1期末の人員・機械簿価が2期の期首繰越として正しく反映される（旧test_personnel.js）', () => {
    const p1Ledger = [
      { category: 'ケ', quantity: 3, amount: 30, smallMachines: 3 },
      { category: '採用', quantity: 5, amount: 50, workersHired: 3, salesmenHired: 2 },
    ];
    const p1ResultsBeforeEnd = calculateFinancials(freshCarryover(), p1Ledger, {}, 1);
    expect(p1ResultsBeforeEnd.machines.depreciation).toBe(0);
    expect(p1ResultsBeforeEnd.machines.endingValue).toBe(30);

    const p1Actuals = { actualWorkers: 3, actualSalesmen: 2 };
    const p1LedgerWithSalary = [
      ...p1Ledger,
      { category: 'シ', amount: 54 },
      { category: 'セ', amount: 36 },
      { category: 'ソ', amount: 60 },
    ];
    const p1Results = calculateFinancials(freshCarryover(), p1LedgerWithSalary, p1Actuals, 1);
    expect(p1Results.workers).toBe(3);
    expect(p1Results.salesmen).toBe(2);

    const p2Carryover = {
      cash: p1Results.bs.cash,
      materialsCount: p1Results.mat.endingCount,
      materialsValue: p1Results.mat.endingValue,
      wipCount: p1Results.wip.endingCount,
      wipValue: p1Results.wip.endingValue,
      productCount: p1Results.prod.endingCount,
      productValue: p1Results.prod.endingValue,
      largeMachines: p1Results.machines.large,
      smallMachines: p1Results.machines.small,
      attachments: p1Results.machines.attachments,
      machinesCount: p1Results.machines.large + p1Results.machines.small,
      machinesValue: p1Results.bs.fixedAssets,
      loan: p1Results.bs.loans,
      receivables: p1Results.bs.receivables,
      payables: p1Results.bs.payables,
      retainedEarnings: p1Results.bs.retainedEarnings,
      capital: p1Results.bs.capital,
      workers: p1Results.workers || 0,
      salesmen: p1Results.salesmen || 0,
    };
    expect(p2Carryover.workers).toBe(3);
    expect(p2Carryover.salesmen).toBe(2);

    const p2Results = calculateFinancials(p2Carryover, [], {}, 2);
    // 30万の機械が2期目で20%償却されて6万→簿価24万
    expect(p2Results.machines.depreciation).toBe(6);
    expect(p2Results.machines.endingValue).toBe(24);
    expect(p2Results.workers).toBe(3);
    expect(p2Results.salesmen).toBe(2);
  });
});

// C/F（キャッシュフロー計算書）の整合。
// ユーザーテスト準備時の実機検査で「期首現金 + 当期キャッシュ増減 が期末現金残高と
// 30万ずれる（差はB/Sの未払費用と一致）」ことを確認したため追加した。
// 原因は営業CFに未払費用（未支出の給与・保険料）の足し戻しが無かったこと。
describe('calculateFinancials - C/Fの帳尻', () => {
  // UT検査で使った一連の取引（採用→機械→材料→投入→完成→販売）
  const ledger = [
    { id: '1', voucherNo: '1', category: '採用', quantity: 0, price: 0, amount: 5, workersHired: 1, salesmenHired: 0 },
    { id: '2', voucherNo: '2', category: 'ケ', quantity: 1, price: 0, amount: 100, largeMachines: 0, smallMachines: 1, attachments: 0 },
    { id: '3', voucherNo: '3', category: 'ツ', quantity: 2, price: 0, amount: 20 },
    { id: '4', voucherNo: '4', category: 'コ', quantity: 1, price: 2, amount: 2 },
    { id: '5', voucherNo: '5', category: 'サ', quantity: 1, price: 1, amount: 1 },
    { id: '6', voucherNo: '6', category: 'キ', quantity: 1, price: 40, amount: 40 }
  ];

  it('期首現金 + 当期キャッシュ増減 = 期末現金残高 が成立する', () => {
    const carryover = freshCarryover();
    const res = calculateFinancials(carryover, ledger, {}, 1);

    // これが崩れていたのが NG-3。差分は許容しない（1円単位で一致すべき）
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
    expect(res.bs.cash).toBe(res.bookEndingCash);
  });

  it('未払費用が計上されている状態でも帳尻が合う', () => {
    const carryover = freshCarryover();
    const res = calculateFinancials(carryover, ledger, {}, 1);

    // 期末処理前なので未払費用（給与・保険料）が負債に立つ
    expect(res.bs.accruedLaborCost).toBeGreaterThan(0);
    // それでも C/F は帳尻が合う（足し戻しが効いている）
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
  });

  it('取引が一切ない場合も帳尻が合う', () => {
    const carryover = freshCarryover();
    const res = calculateFinancials(carryover, [], {}, 1);
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
  });

  it('営業CFの内訳を足すと営業CFに一致する（内訳が表示と矛盾しない）', () => {
    const carryover = freshCarryover();
    const res = calculateFinancials(carryover, ledger, {}, 1);

    const inventoryChange =
      (res.bs.materialsValue - carryover.materialsValue) +
      (res.bs.wipValue - carryover.wipValue) +
      (res.bs.productValue - carryover.productValue);
    const accruedChange = res.bs.accruedLaborCost - (carryover.accruedLaborCost || 0);

    const rebuilt =
      res.pl.profitBeforeTax
      + res.machines.depreciation
      - (res.bs.receivables - carryover.receivables)
      - inventoryChange
      + (res.bs.payables - carryover.payables)
      + accruedChange;

    expect(rebuilt).toBe(res.cf.operatingCF);
  });
});

// 減価償却費の一貫性。
// 実機検査で C/F・図解・固定資産台帳・予実ギャップの4画面が食い違っていた（NG-5）。
// 原因は (a) C/F が「製造固定費 − 製造経費」で逆算していた (b) pl.depreciation が未定義だった。
describe('calculateFinancials - 減価償却費の一貫性', () => {
  const machineLedger = [
    { id: '1', voucherNo: '1', category: 'ケ', quantity: 1, price: 0, amount: 100, largeMachines: 0, smallMachines: 1, attachments: 0 },
    { id: '2', voucherNo: '2', category: 'ス', quantity: 0, price: 0, amount: 50 }
  ];

  it('pl.depreciation と machines.depreciation が同じ値を返す（画面間で食い違わない）', () => {
    const res = calculateFinancials(freshCarryover(), machineLedger, {}, 2);
    expect(res.pl.depreciation).toBe(res.machines.depreciation);
  });

  it('減価償却費は製造固定費に含まれる（オーナー裁定: 償却分を固定費に入れる）', () => {
    const res = calculateFinancials(freshCarryover(), machineLedger, {}, 2);
    // manufacturingFixed = 製造経費(ス) + 減価償却 + PAC
    expect(res.pl.manufacturingFixed).toBeGreaterThanOrEqual(res.machines.depreciation);
    expect(res.pl.manufacturingFixed).toBe(50 + res.machines.depreciation);
  });

  it('減価償却費は固定費合計Fに含まれる', () => {
    const res = calculateFinancials(freshCarryover(), machineLedger, {}, 2);
    expect(res.pl.fixedCost).toBeGreaterThanOrEqual(res.machines.depreciation);
  });

  it('製造経費(ス)を逆算に使わない: 製造経費が大きくても償却額は変わらない', () => {
    const small = calculateFinancials(freshCarryover(), machineLedger, {}, 2);
    const large = calculateFinancials(freshCarryover(), [
      machineLedger[0],
      { id: '2', voucherNo: '2', category: 'ス', quantity: 0, price: 0, amount: 5000 }
    ], {}, 2);
    // 旧実装では「製造固定費 − ス」で逆算していたため、スの額に引きずられていた
    expect(large.machines.depreciation).toBe(small.machines.depreciation);
    expect(large.pl.depreciation).toBe(small.pl.depreciation);
  });
});

// 法人税の均等割。
// オーナー裁定（2026-07-30）: 赤字でも必ず7万を引く。これは均等割として正しい仕様。
// 計算は変更せず、ラベルのみ実態に合わせた。
describe('calculateFinancials - 法人税の均等割', () => {
  it('赤字でも7万が課税される（均等割・裁定により仕様）', () => {
    const res = calculateFinancials(freshCarryover(), [], {}, 1);
    expect(res.pl.profitBeforeTax).toBeLessThanOrEqual(0);
    expect(res.pl.corporateTax).toBe(7);
  });

  it('大きな赤字でも7万で固定される', () => {
    const res = calculateFinancials(freshCarryover(), [
      { id: '1', voucherNo: '1', category: 'ス', quantity: 0, price: 0, amount: 5000 }
    ], {}, 1);
    expect(res.pl.profitBeforeTax).toBeLessThan(-1000);
    expect(res.pl.corporateTax).toBe(7);
  });
});

// A1: C/Fの特別利益二重計上の修正。
// operatingCF は profitBeforeTax 起点で特別利益（イ・エ・自動保険金）を含むのに、
// investingCF = extraordinaryGain − purchasedMachineValue で同額を再加算していたため、
// 特別利益がある期は「期首現金 + totalCF ≠ 期末現金」になっていた
// （検証済み再現値: イ50のみ→現金増減+50に対し totalCF=+100）。
// 修正: 間接法の定石どおり営業CF側で特別利益を控除する。
describe('calculateFinancials - C/Fの特別利益二重計上（A1）', () => {
  it('機械売却（イ50万）のみ: 期首現金 + totalCF = 期末現金 が成立する', () => {
    const carryover = freshCarryover();
    const ledger = [{ category: 'イ', amount: 50 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);

    expect(res.bs.cash).toBe(350); // 300 + 50
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash); // 旧実装では +100 でズレていた
    // 売却収入は投資CF側にのみ計上される（営業CFでは控除済み）
    expect(res.cf.investingCF).toBe(50);
    expect(res.cf.operatingCF).toBe(res.pl.profitBeforeTax - res.pl.extraordinaryGain);
  });

  it('受取保険金（エ30万）のみ: 帳尻が合う', () => {
    const carryover = freshCarryover();
    const ledger = [{ category: 'エ', amount: 30 }];
    const res = calculateFinancials(carryover, ledger, {}, 1);

    expect(res.bs.cash).toBe(330);
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
  });

  it('保険チップ保有中の盗難（自動保険金）でも帳尻が合う', () => {
    const carryover = freshCarryover();
    const ledger = [
      { category: 'ツ', amount: 30, quantity: 3 },
      { category: 'コ', amount: 6, quantity: 3 },
      { category: 'サ', amount: 3, quantity: 3 },
      { category: '保険', amount: 20, quantity: 1 },
      { category: '盗難', amount: 0, quantity: 0 }, // デフォルト2個の盗難
    ];
    const res = calculateFinancials(carryover, ledger, {}, 1);

    // 自動保険金 = 盗難2個 × 10万 = 20万
    expect(res.pl.extraordinaryGain).toBe(20);
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
  });

  it('売却（イ）と保険金（エ）が併発しても帳尻が合う', () => {
    const carryover = freshCarryover();
    const ledger = [
      { category: 'イ', amount: 50 },
      { category: 'エ', amount: 30 },
    ];
    const res = calculateFinancials(carryover, ledger, {}, 1);

    expect(res.bs.cash).toBe(380);
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
    expect(res.cf.investingCF).toBe(80);
  });

  it('特別利益ゼロの期は修正の影響を受けない（従来どおり帳尻が合う）', () => {
    const carryover = freshCarryover();
    const ledger = [
      { category: 'ツ', amount: 20, quantity: 2 },
      { category: 'キ', amount: 40, quantity: 0 },
    ];
    const res = calculateFinancials(carryover, ledger, {}, 1);
    expect(res.pl.extraordinaryGain).toBe(0);
    expect(carryover.cash + res.cf.totalCF).toBe(res.bs.cash);
  });
});

// A2: hasProcessedPeriodEnd の誤判定修正。
// 旧仕様「シ・セ・ソのいずれかの金額>0」では、期中に普通に発生する
// セ（広告費・特別サービス・クレーム処理）や ソ（退職費用）1件で
// 期末処理済みと誤判定され、給与見積が全消えしていた
// （検証済み再現値: W2+S1第1期でセ5万→Fが90→5に）。
// 修正: PeriodEndWizard が書き込むエントリの periodEnd: true フラグを第一判定とし、
// 旧データ互換は「シ」の存在のみで判定する（シはウィザードしか書かない）。
describe('calculateFinancials - 期末処理判定（A2: periodEndフラグ）', () => {
  // ワーカー2名・セールスマン1名の期首体制（第1期: 給与単価18万・保険単価12万）
  // → 見積: 労務費36 + 販売費18 + 保険36 = 90（未払費用も90）
  const staffCarry = () => freshCarryover({ workers: 2, salesmen: 1 });

  it('期中の広告費（セ5万）を登録しても給与見積・未払費用が消えない', () => {
    const before = calculateFinancials(staffCarry(), [], {}, 1);
    const after = calculateFinancials(staffCarry(), [
      { category: 'セ', amount: 5, quantity: 1, customName: '特別サービス(広告)の支払' },
    ], {}, 1);

    // 旧実装ではセ1件で F が 90 → 5 に振れていた（給与見積85万の全消え）
    expect(before.pl.fixedCost).toBe(90);
    expect(before.bs.accruedLaborCost).toBe(90);
    expect(after.pl.laborCost).toBe(36);           // 労務費の見積が維持される
    expect(after.bs.accruedLaborCost).toBe(90);    // 未払費用が変わらない
    // F・G は広告費5万ぶんだけ動く（実費計上。見積の全消えは起きない）
    expect(after.pl.fixedCost).toBe(before.pl.fixedCost + 5);
    expect(after.pl.operatingProfit).toBe(before.pl.operatingProfit - 5);
    // 両モードとも B/S は貸借一致・C/Fの帳尻も合う
    expect(before.bs.difference).toBe(0);
    expect(after.bs.difference).toBe(0);
    expect(300 + after.cf.totalCF).toBe(after.bs.cash);
  });

  it('期中の退職費用（ソ5万）を登録しても給与見積が消えず、B/Sが一致する', () => {
    const res = calculateFinancials(staffCarry(), [
      { category: 'ソ', amount: 5, quantity: 1, customName: '退職費用 (ワーカー)' },
    ], {}, 1);
    expect(res.pl.laborCost).toBe(36);
    expect(res.bs.accruedLaborCost).toBe(90);
    expect(res.bs.difference).toBe(0);
  });

  it('periodEnd: true フラグ付きエントリがあれば期末処理済みとして実績値へ切り替わる', () => {
    const res = calculateFinancials(staffCarry(), [
      { category: 'シ', amount: 36, quantity: 1, periodEnd: true },
      { category: 'セ', amount: 18, quantity: 1, periodEnd: true },
      { category: 'ソ', amount: 36, quantity: 1, periodEnd: true },
    ], { actualWorkers: 2, actualSalesmen: 1 }, 1);
    expect(res.pl.laborCost).toBe(36);
    expect(res.pl.salesCost).toBe(18);
    expect(res.bs.accruedLaborCost).toBe(0); // 支払済みなので未払費用は消える
    expect(res.bs.difference).toBe(0);
  });

  it('期中の広告費セ + フラグ付き期末エントリの併存でも二重計上せずB/Sが一致する', () => {
    const res = calculateFinancials(staffCarry(), [
      { category: 'セ', amount: 5, quantity: 1 },                    // 期中の広告
      { category: 'シ', amount: 36, quantity: 1, periodEnd: true },  // 期末ウィザード分
      { category: 'セ', amount: 18, quantity: 1, periodEnd: true },
      { category: 'ソ', amount: 36, quantity: 1, periodEnd: true },
    ], { actualWorkers: 2, actualSalesmen: 1 }, 1);
    // 実績モード: 販売費 = 広告5 + セールス給与18（見積との二重計上なし）
    expect(res.pl.salesCost).toBe(23);
    expect(res.bs.accruedLaborCost).toBe(0);
    expect(res.bs.difference).toBe(0);
  });

  it('旧データ互換: フラグの無い「シ」があれば期末処理済みとみなす', () => {
    const res = calculateFinancials(staffCarry(), [
      { category: 'シ', amount: 36, quantity: 1 },
      { category: 'セ', amount: 18, quantity: 1 },
      { category: 'ソ', amount: 36, quantity: 1 },
    ], { actualWorkers: 2, actualSalesmen: 1 }, 1);
    expect(res.pl.laborCost).toBe(36);
    expect(res.bs.accruedLaborCost).toBe(0);
    expect(res.bs.difference).toBe(0);
  });
});
