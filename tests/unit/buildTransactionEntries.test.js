import { describe, it, expect } from 'vitest';
import { buildTransactionEntries, getNextVoucherNo } from '../../src/components/cashledger/buildTransactionEntries.js';

// CashLedger のフォーム state 初期値（resetForm 相当）。テストごとに複製して使う。
function makeForm(overrides = {}) {
  return {
    selectedCategory: 'キ',
    quantity: '',
    price: '',
    amount: '',
    isFireSale: false,
    fireSaleQty: '',
    workersHired: '',
    salesmenHired: '',
    hirePrice: 5,
    productionKo: '',
    productionSa: '',
    transferW2S: 0,
    transferS2W: 0,
    factoringAmount: '',
    repaymentAmount: '',
    riskTab: 'positive',
    riskAction: 'special_sale',
    riskQty: '',
    riskPrice: '',
    riskMonopolyAdQtys: { sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0 },
    marketQuantities: { sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0 },
    salesData: {
      sapporo: { qty: 0, price: '' }, sendai: { qty: 0, price: '' }, tokyo: { qty: 0, price: '' },
      nagoya: { qty: 0, price: '' }, osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
    },
    machineQuantities: { large: 0, small: 0, attachment: 0 },
    machineSaleQuantities: { large: 0, small: 0, attachment: 0 },
    adQuantities: { ad5: 0, ad10: 0, ad20: 0 },
    rdPrice: 20,
    greenChips: { pac: 0, md: 0, research: 0 },
    ...overrides
  };
}

// ctx（コンテキスト）。now/rand を固定して id・伝票番号・タイムスタンプを決定的にする。
function makeCtx(overrides = {}) {
  return {
    carryover: { cash: 300, capital: 300, retainedEarnings: 0, loan: 0, receivables: 0, payables: 0, taxes: 0 },
    ledger: [],
    results: {},
    currentPeriod: 1,
    transactionMode: 'cash',
    now: 1000,
    rand: () => 0,
    ...overrides
  };
}

describe('getNextVoucherNo', () => {
  it('空配列では1を返す', () => {
    expect(getNextVoucherNo([])).toBe(1);
  });
  it('既存の最大伝票番号+1を返す（歯抜けでも重複しない）', () => {
    expect(getNextVoucherNo([{ voucherNo: '1' }, { voucherNo: '5' }, { voucherNo: '3' }])).toBe(6);
  });
});

describe('buildTransactionEntries - 検証ガード', () => {
  it('カテゴリ未選択はエラー', () => {
    const res = buildTransactionEntries(makeCtx(), makeForm({ selectedCategory: '' }));
    expect(res.error).toBe('項目を選択してください');
  });

  it('0円取引（現金・数量単価ゼロ）はブロックされる', () => {
    // その他出金(ス)で金額未入力 → actualAmount 0 → ブロック
    const res = buildTransactionEntries(makeCtx(), makeForm({ selectedCategory: 'ス', amount: '' }));
    expect(res.error).toBe('0万円の処理は登録できません。金額や数量を確認してください。');
  });
});

describe('buildTransactionEntries - 銀行借入（オ）と自動利息', () => {
  it('借入100は伝票#1、利息10が伝票#2として自動計上され、infoAlertsが返る', () => {
    const res = buildTransactionEntries(
      makeCtx({ currentPeriod: 1 }),
      makeForm({ selectedCategory: 'オ', amount: '100' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger).toHaveLength(2);

    const [loan, interest] = res.ledger;
    expect(loan.category).toBe('オ');
    expect(loan.amount).toBe(100);
    expect(loan.voucherNo).toBe('1');

    expect(interest.category).toBe('タ');
    expect(interest.amount).toBe(10); // 期1〜3は10%
    expect(interest.voucherNo).toBe('2'); // 借入エントリを含めた採番
    expect(interest.id).toBe('1001'); // now+1

    expect(res.infoAlerts).toHaveLength(1);
    expect(res.infoAlerts[0]).toContain('10%');
  });

  it('期4以降は利息5%で計算される', () => {
    const res = buildTransactionEntries(
      makeCtx({ currentPeriod: 4 }),
      makeForm({ selectedCategory: 'オ', amount: '100' })
    );
    const interest = res.ledger.find(e => e.category === 'タ');
    expect(interest.amount).toBe(5);
  });

  it('借入上限を超えるとエラーで確定しない', () => {
    // 期1: 上限 = 2 × (capital300 + retained0) = 600。既存借入なし。650を借りようとする
    const res = buildTransactionEntries(
      makeCtx({ currentPeriod: 1 }),
      makeForm({ selectedCategory: 'オ', amount: '650' })
    );
    expect(res.error).toContain('上限');
    expect(res.ledger).toBeUndefined();
  });

  it('MAX_Loan は オ として保存され利息も付く', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'MAX_Loan', amount: '100' })
    );
    expect(res.ledger[0].category).toBe('オ');
    expect(res.ledger.find(e => e.category === 'タ').amount).toBe(10);
  });
});

describe('buildTransactionEntries - 商品販売（キ）と投げ売り', () => {
  it('複数市場の現金販売が1エントリに合算され salesDetails を持つ', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 10 } } }),
      makeForm({
        selectedCategory: 'キ',
        salesData: {
          sapporo: { qty: 2, price: 30 }, sendai: { qty: 1, price: 20 },
          tokyo: { qty: 0, price: '' }, nagoya: { qty: 0, price: '' },
          osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
        }
      })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger).toHaveLength(1);
    const e = res.ledger[0];
    expect(e.category).toBe('キ');
    expect(e.quantity).toBe(3);
    expect(e.amount).toBe(2 * 30 + 1 * 20); // 80
    expect(e.salesDetails.sapporo).toEqual({ qty: 2, price: 30, name: '札幌' });
    expect(e.salesDetails.sendai).toEqual({ qty: 1, price: 20, name: '仙台' });
  });

  it('数量ありで単価未入力はエラー', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 10 } } }),
      makeForm({
        selectedCategory: 'キ',
        salesData: {
          sapporo: { qty: 2, price: '' }, sendai: { qty: 0, price: '' },
          tokyo: { qty: 0, price: '' }, nagoya: { qty: 0, price: '' },
          osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
        }
      })
    );
    expect(res.error).toBe('札幌の販売単価を入力してください');
  });

  it('投げ売りは単価18固定・在庫超過はエラー', () => {
    const ok = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 5 } } }),
      makeForm({ selectedCategory: 'キ', isFireSale: true, fireSaleQty: '3' })
    );
    expect(ok.ledger[0].amount).toBe(3 * 18);
    expect(ok.ledger[0].price).toBe(18);
    expect(ok.ledger[0].customShortName).toBe('投売');
    expect(ok.ledger[0].salesDetails.fireSale).toEqual({ qty: 3, price: 18, name: '投げ売り' });

    const over = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 2 } } }),
      makeForm({ selectedCategory: 'キ', isFireSale: true, fireSaleQty: '3' })
    );
    expect(over.error).toContain('手持在庫');
  });
});

describe('buildTransactionEntries - 材料仕入（ツ）とMD割引', () => {
  it('MDチップ保有時は仕入単価が-2される', () => {
    const withMD = buildTransactionEntries(
      makeCtx({ ledger: [{ category: 'MD' }], results: { productionCapacity: 10, mat: { endingCount: 0 } } }),
      makeForm({ selectedCategory: 'ツ', marketQuantities: { sapporo: 1, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0 } })
    );
    // 札幌 basePrice10 - 2 = 8
    const entry = withMD.ledger.find(e => e.category === 'ツ');
    expect(entry.amount).toBe(8);

    const noMD = buildTransactionEntries(
      makeCtx({ results: { productionCapacity: 10, mat: { endingCount: 0 } } }),
      makeForm({ selectedCategory: 'ツ', marketQuantities: { sapporo: 1, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0 } })
    );
    expect(noMD.ledger.find(e => e.category === 'ツ').amount).toBe(10);
  });

  it('数量ゼロはエラー', () => {
    const res = buildTransactionEntries(makeCtx(), makeForm({ selectedCategory: 'ツ' }));
    expect(res.error).toBe('購入する数量を入力してください');
  });
});

describe('buildTransactionEntries - 機械売却（イ）', () => {
  it('保有台数を超える売却はエラー', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { largeMachines: 1, smallMachines: 0, attachments: 0 } }),
      makeForm({ selectedCategory: 'イ', machineSaleQuantities: { large: 2, small: 0, attachment: 0 }, amount: '100' })
    );
    expect(res.error).toContain('保有台数を超える売却はできません');
    expect(res.ledger).toBeUndefined();
  });

  it('正常な売却は台数と入金額を記録する', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { largeMachines: 2, smallMachines: 0, attachments: 0 } }),
      makeForm({ selectedCategory: 'イ', machineSaleQuantities: { large: 1, small: 0, attachment: 0 }, amount: '150' })
    );
    const e = res.ledger[0];
    expect(e.category).toBe('イ');
    expect(e.quantity).toBe(1);
    expect(e.amount).toBe(150);
    expect(e.soldLargeMachines).toBe(1);
  });

  it('売却額ゼロはエラー', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { largeMachines: 2 } }),
      makeForm({ selectedCategory: 'イ', machineSaleQuantities: { large: 1, small: 0, attachment: 0 }, amount: '' })
    );
    expect(res.error).toBe('売却額（入金額）を入力してください');
  });
});

describe('buildTransactionEntries - 緑チップ（複数エントリと伝票連番）', () => {
  it('PAC/MD/リサーチを複数買うと各1エントリずつ、伝票番号が連番になる', () => {
    const res = buildTransactionEntries(
      makeCtx({ ledger: [{ voucherNo: '3' }] }),
      makeForm({ selectedCategory: '緑チップ', greenChips: { pac: 1, md: 1, research: 1 } })
    );
    // 既存1件 + 3チップ
    expect(res.ledger).toHaveLength(4);
    const chips = res.ledger.slice(1);
    expect(chips.map(c => c.category)).toEqual(['PAC', 'MD', 'リサーチ']);
    // 既存 voucherNo=3 の次から連番 4,5,6
    expect(chips.map(c => c.voucherNo)).toEqual(['4', '5', '6']);
    chips.forEach(c => { expect(c.amount).toBe(10); expect(c.price).toBe(10); });
  });

  it('数量ゼロはエラー', () => {
    const res = buildTransactionEntries(makeCtx(), makeForm({ selectedCategory: '緑チップ' }));
    expect(res.error).toBe('購入する緑チップの数量を入力してください');
  });
});

describe('buildTransactionEntries - 保険の保有上限', () => {
  it('既に保険を保有していると追加不可', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { activeInsuranceChips: 1 } }),
      makeForm({ selectedCategory: '保険' })
    );
    expect(res.error).toContain('保険は同時に1つ');
  });
  it('未保有なら5万で購入できる', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { activeInsuranceChips: 0 } }),
      makeForm({ selectedCategory: '保険' })
    );
    expect(res.ledger[0].category).toBe('保険');
    expect(res.ledger[0].amount).toBe(5);
  });
});

describe('buildTransactionEntries - 売掛割引（早期リターン枝）', () => {
  it('割引額に対しア(回収)とタ(手数料5%)の2エントリを生成', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '売掛割引', factoringAmount: '100' })
    );
    expect(res.ledger).toHaveLength(2);
    expect(res.ledger[0].category).toBe('ア');
    expect(res.ledger[0].amount).toBe(100);
    expect(res.ledger[1].category).toBe('タ');
    expect(res.ledger[1].amount).toBe(5); // round(100*0.05)
  });

  it('割引額ゼロはエラー', () => {
    const res = buildTransactionEntries(makeCtx(), makeForm({ selectedCategory: '売掛割引', factoringAmount: '' }));
    expect(res.error).toBe('割引する売掛金の金額を入力してください');
  });
});

describe('buildTransactionEntries - 期首処理（早期リターン枝）', () => {
  it('繰越の売掛/買掛/税/利息/返済を一括計上し、マーカーとresetSelectedCategoryを返す', () => {
    const res = buildTransactionEntries(
      makeCtx({
        currentPeriod: 2,
        carryover: { cash: 300, capital: 300, retainedEarnings: 0, receivables: 50, payables: 30, taxes: 7, loan: 100 }
      }),
      makeForm({ selectedCategory: '期首処理', repaymentAmount: '20' })
    );
    expect(res.resetSelectedCategory).toBe(true);
    const cats = res.ledger.map(e => e.category);
    expect(cats).toContain('ア'); // 売掛回収
    expect(cats).toContain('ヌ'); // 買掛支払
    expect(cats).toContain('ニ'); // 税
    expect(cats).toContain('タ'); // 利息 round(100*0.10)=10
    expect(cats).toContain('ナ'); // 返済20
    expect(cats).toContain('期首処理'); // マーカー
    expect(res.ledger.find(e => e.category === 'タ').amount).toBe(10);
  });
});

describe('buildTransactionEntries - 生産（早期リターン枝）', () => {
  it('投入コと完成サを別エントリで生成する', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '生産', productionKo: '3', productionSa: '2' })
    );
    const sa = res.ledger.find(e => e.category === 'サ');
    const ko = res.ledger.find(e => e.category === 'コ');
    expect(sa.quantity).toBe(2);
    expect(sa.amount).toBe(2); // 単価1
    expect(ko.quantity).toBe(3);
    expect(ko.amount).toBe(6); // 単価2
  });

  it('両方ゼロはエラー', () => {
    const res = buildTransactionEntries(makeCtx(), makeForm({ selectedCategory: '生産' }));
    expect(res.error).toBe('投入または完成する数量を入力してください');
  });
});

describe('buildTransactionEntries - リスクカード', () => {
  it('ポジティブ独占販売(Sマン)は販売エントリを1件生成', () => {
    const res = buildTransactionEntries(
      makeCtx({ transactionMode: 'cash' }),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'monopoly_salesman', riskQty: '2', riskPrice: '32' })
    );
    expect(res.ledger).toHaveLength(1);
    expect(res.ledger[0].category).toBe('キ');
    expect(res.ledger[0].amount).toBe(64);
    expect(res.ledger[0].usedRD).toBe(false);
  });

  it('ネガティブ ワーカー退職は退職と退職費用(ソ5)を同一groupIdで生成', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'negative', riskAction: 'retire_worker' })
    );
    expect(res.ledger).toHaveLength(2);
    expect(res.ledger[0].category).toBe('退職');
    expect(res.ledger[1].category).toBe('ソ');
    expect(res.ledger[1].amount).toBe(5);
    expect(res.ledger[0].groupId).toBe(res.ledger[1].groupId);
  });

  it('盗難で保険保有時は保険金(特別利益)も自動計上', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 5 } }, ledger: [{ category: '保険', quantity: 1 }] }),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'negative', riskAction: 'theft' })
    );
    const theft = res.ledger.find(e => e.category === '盗難');
    const ins = res.ledger.find(e => e.category === '特別利益');
    expect(theft.quantity).toBe(2); // min(2, 5)
    expect(ins.amount).toBe(20); // 2 * 10
  });
});

describe('buildTransactionEntries - 採用と配置転換（既定枝）', () => {
  it('採用はワーカー/セールスマン数と単価から費用を計算', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '採用', workersHired: '2', salesmenHired: '1', hirePrice: 5 })
    );
    const e = res.ledger[0];
    expect(e.category).toBe('採用');
    expect(e.amount).toBe(3 * 5);
    expect(e.workersHired).toBe(2);
    expect(e.salesmenHired).toBe(1);
  });

  it('配置転換は移動人数×5の費用、不足時はエラー', () => {
    const ok = buildTransactionEntries(
      makeCtx({ results: { workers: 3, salesmen: 3 } }),
      makeForm({ selectedCategory: '配置転換', transferW2S: 2, transferS2W: 0 })
    );
    expect(ok.ledger[0].amount).toBe(10);

    const ng = buildTransactionEntries(
      makeCtx({ results: { workers: 1, salesmen: 3 } }),
      makeForm({ selectedCategory: '配置転換', transferW2S: 2, transferS2W: 0 })
    );
    expect(ng.error).toBe('ワーカーの数が不足しています');
  });

  it('生産能力を超えるコ投入はエラー', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { productionCapacity: 2 } }),
      makeForm({ selectedCategory: 'コ', quantity: '5', price: '2' })
    );
    expect(res.error).toContain('生産能力');
  });
});
