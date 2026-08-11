import { describe, it, expect } from 'vitest';
import { buildTransactionEntries, getNextVoucherNo, removeEntry, toSafeInt, checkCashBalance } from '../../src/components/cashledger/buildTransactionEntries.js';

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
    // 在庫チェック追加（B2）に伴い、手持在庫を持つ ctx で検証する
    const res = buildTransactionEntries(
      makeCtx({ transactionMode: 'cash', results: { prod: { endingCount: 5 } } }),
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

// 現金残高ガード。
// 研修中に桁を打ち間違えた受講者が、現金がマイナスの帳簿のまま決算まで進んでしまう事故を防ぐ。
// （ユーザーテスト準備時の実機検査で「残高288.5万に対し5000万の出金が無警告で通り、
//   現金 -4,711.5万 になる」ことを確認したため追加した）
describe('現金残高のガード', () => {
  it('残高を超える支出はエラーになり、ledgerを更新しない', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '5000' })
    );
    expect(res.error).toBeTruthy();
    expect(res.ledger).toBeUndefined();
  });

  it('エラーメッセージに不足額・現在残高・対処法を含む', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '5000' })
    );
    expect(res.error).toContain('4,700');    // 300 - 5000 = -4700 の不足額
    expect(res.error).toContain('300');      // 現在の現金残高
    expect(res.error).toContain('銀行借入'); // 資金調達の案内
  });

  it('残高ちょうどまでの支出は通る（境界値）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '300' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger).toHaveLength(1);
  });

  it('残高を1万超える支出は止まる（境界値）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '301' })
    );
    expect(res.error).toBeTruthy();
  });

  it('入金（現金売上）は残高に関係なく通る', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { productInventory: 5 } }),
      makeForm({
        selectedCategory: 'キ',
        salesData: {
          sapporo: { qty: 1, price: '30' }, sendai: { qty: 0, price: '' }, tokyo: { qty: 0, price: '' },
          nagoya: { qty: 0, price: '' }, osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
        }
      })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger).toHaveLength(1);
  });

  it('既にマイナスの帳簿でも、入金は通る（回復を妨げない）', () => {
    // 既存データが不正でも受講者が現金を回復できる経路を塞がないこと
    const ctx = makeCtx({
      carryover: { cash: 300, capital: 300, retainedEarnings: 0, loan: 0, receivables: 0, payables: 0, taxes: 0 },
      ledger: [{ id: '1', voucherNo: '1', category: 'ス', quantity: 0, price: 0, amount: 5000 }],
      results: { productInventory: 5 }
    });
    const res = buildTransactionEntries(ctx, makeForm({
      selectedCategory: 'キ',
      salesData: {
        sapporo: { qty: 1, price: '30' }, sendai: { qty: 0, price: '' }, tokyo: { qty: 0, price: '' },
        nagoya: { qty: 0, price: '' }, osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
      }
    }));
    expect(res.error).toBeUndefined();
  });

  it('既にマイナスの帳簿から、さらに減らす支出は止める', () => {
    const ctx = makeCtx({
      ledger: [{ id: '1', voucherNo: '1', category: 'ス', quantity: 0, price: 0, amount: 5000 }]
    });
    const res = buildTransactionEntries(ctx, makeForm({ selectedCategory: 'ス', amount: '10' }));
    expect(res.error).toBeTruthy();
  });

  it('借入は入金なので通る（自動利息を引いても残高が残る場合）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'オ', amount: '100' })
    );
    expect(res.error).toBeUndefined();
    // 借入100 + 自動利息10 の2件
    expect(res.ledger).toHaveLength(2);
  });

  it('材料購入も残高を超えれば止まる（早期リターン枝もガードされる）', () => {
    const ctx = makeCtx({
      carryover: { cash: 5, capital: 300, retainedEarnings: 0, loan: 0, receivables: 0, payables: 0, taxes: 0 },
      results: { productionCapacity: 10 }
    });
    const res = buildTransactionEntries(ctx, makeForm({
      selectedCategory: 'ツ',
      marketQuantities: { sapporo: 2, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0 },
      price: '10'
    }));
    expect(res.error).toBeTruthy();
  });

  it('投入・完成にも伝票番号が採番される（画面に裸の「#」が出ない）', () => {
    const ctx = makeCtx({
      ledger: [{ id: 'x', voucherNo: '1', category: 'ケ', quantity: 1, price: 100, amount: 100 }],
      results: { productionCapacity: 10, materialInventory: 10, wipInventory: 10 }
    });
    const res = buildTransactionEntries(ctx, makeForm({
      selectedCategory: '生産', productionKo: '1', productionSa: '1'
    }));
    expect(res.error).toBeUndefined();
    const added = res.ledger.slice(1);
    expect(added).toHaveLength(2);
    added.forEach(e => {
      expect(e.voucherNo).toBeTruthy();
      expect(Number(e.voucherNo)).toBeGreaterThan(1);
    });
    // 同時追加分どうしも番号が重複しない
    expect(added[0].voucherNo).not.toBe(added[1].voucherNo);
  });

  it('生産（投入・完成）も残高を超えれば止まる', () => {
    const ctx = makeCtx({
      carryover: { cash: 1, capital: 300, retainedEarnings: 0, loan: 0, receivables: 0, payables: 0, taxes: 0 },
      results: { productionCapacity: 10, materialInventory: 10, wipInventory: 10 }
    });
    const res = buildTransactionEntries(ctx, makeForm({
      selectedCategory: '生産', productionKo: '5', productionSa: '5'
    }));
    expect(res.error).toBeTruthy();
  });
});

// 負の金額の拒否メッセージ。
// 以前は「<= 0」の一本の条件でゼロと負の数をまとめて弾いていたため、
// 人数に -3 を入れて合計 -15万 になった状態でも「0万円の処理は登録できません」と
// 表示され、原因が伝わらなかった（実機検査で確認）。
describe('負の金額の扱い', () => {
  it('負の金額は「マイナスの金額」と明示して拒否する', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '採用', workersHired: '-3', salesmenHired: '0', hirePrice: 5 })
    );
    expect(res.error).toBeTruthy();
    expect(res.error).toContain('マイナスの金額');
    expect(res.error).toContain('-15');       // 実際の金額を示す
    expect(res.error).not.toContain('0万円'); // ゼロ扱いのメッセージを出さない
    expect(res.ledger).toBeUndefined();
  });

  it('ゼロは従来どおり「0万円の処理は登録できません」で拒否する', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '0' })
    );
    expect(res.error).toContain('0万円');
    expect(res.error).not.toContain('マイナスの金額');
  });

  it('負の金額のメッセージに復旧手段（直す・削除）の案内を含む', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '-100' })
    );
    expect(res.error).toContain('マイナスの金額');
    expect(res.error).toContain('直す');
  });

  it('正の金額は通る（誤ってブロックしない）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '50' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger).toHaveLength(1);
  });
});

// 入力の防御的正規化ヘルパー（B1/B3）。
// UI（AddTransactionModal / CashLedger）の全クランプ箇所がこの関数を通る。
describe('toSafeInt - 入力の防御的正規化', () => {
  it('小数は切り捨てる（数量1.5個・採用2.5人の混入防止）', () => {
    expect(toSafeInt('2.5')).toBe(2);
    expect(toSafeInt(1.9)).toBe(1);
  });
  it('負の値は0に丸める', () => {
    expect(toSafeInt('-3')).toBe(0);
    expect(toSafeInt(-0.5)).toBe(0);
  });
  it('Infinity/NaN/数値以外は0に落とす', () => {
    expect(toSafeInt('1e309')).toBe(0); // 有限数の範囲を超える入力
    expect(toSafeInt(Infinity)).toBe(0);
    expect(toSafeInt(-Infinity)).toBe(0);
    expect(toSafeInt(NaN)).toBe(0);
    expect(toSafeInt('abc')).toBe(0);
    expect(toSafeInt('')).toBe(0);
  });
  it('通常の整数はそのまま通す', () => {
    expect(toSafeInt('5')).toBe(5);
    expect(toSafeInt(0)).toBe(0);
    expect(toSafeInt(100)).toBe(100);
  });
});

// B1: Infinity/NaN が帳簿に保存されると JSON.stringify で null 化し、
// リロード時に白画面が永続する事故（実ブラウザで確認済み）を多層で防ぐ。
describe('非有限金額の拒否（B1）', () => {
  it('金額欄にInfinityが渡っても保存されない', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: 'Infinity' })
    );
    expect(res.error).toBeTruthy();
    expect(res.ledger).toBeUndefined();
  });

  it('有限巨大数の乗算で金額がInfinityになる採用も拒否する（1e308人 × 5万）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '採用', workersHired: '1e308', salesmenHired: '0', hirePrice: 5 })
    );
    expect(res.error).toBeTruthy();
    expect(res.ledger).toBeUndefined();
  });

  it('非現金の損失カテゴリでもNaN金額（Infinity個 × 単価0）は拒否する', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '盗難', quantity: 'Infinity', price: '' })
    );
    expect(res.error).toBeTruthy();
    expect(res.ledger).toBeUndefined();
  });

  it('checkCashBalance は残高が非有限になる取引を素通しせず拒否する', () => {
    const ctx = makeCtx();
    const res = checkCashBalance(ctx, [
      { id: '1', voucherNo: '1', category: 'ス', quantity: 0, price: 0, amount: Infinity }
    ]);
    expect(res).not.toBeNull();
    expect(res.error).toBeTruthy();
  });

  it('通常の有限金額は従来どおり通る（誤ブロックしない）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'ス', amount: '100' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger).toHaveLength(1);
  });
});

// B2: リスクカード販売系の在庫チェック。
// 修正前は在庫5個でも999999個販売でき、製品在庫マイナス・現金+3200万円が恒久保存された。
describe('リスクカード販売の在庫チェック（B2）', () => {
  it('独占販売(Sマン)は在庫超過を拒否する', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 5 } } }),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'monopoly_salesman', riskQty: '999999', riskPrice: '32' })
    );
    expect(res.error).toContain('手持在庫');
    expect(res.ledger).toBeUndefined();
  });

  it('研究開発成功(rd_success)も在庫超過を拒否する', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 3 } } }),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'rd_success', riskQty: '4', riskPrice: '32' })
    );
    expect(res.error).toContain('手持在庫');
  });

  it('独占販売(広告)は合計数量が在庫を超えると拒否する', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 3 } } }),
      makeForm({
        selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'monopoly_ad',
        riskMonopolyAdQtys: { sapporo: 2, sendai: 2, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0 }
      })
    );
    expect(res.error).toContain('手持在庫');
  });

  it('在庫ちょうどまでの販売は通る（境界値）', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 5 } } }),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'monopoly_salesman', riskQty: '5', riskPrice: '32' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger[0].quantity).toBe(5);
    expect(res.ledger[0].amount).toBe(160);
  });

  it('数量の小数は切り捨てて整数個で計上する（B3）', () => {
    const res = buildTransactionEntries(
      makeCtx({ results: { prod: { endingCount: 5 } } }),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'monopoly_salesman', riskQty: '2.9', riskPrice: '32' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger[0].quantity).toBe(2);
    expect(res.ledger[0].amount).toBe(64);
  });

  it('特別サービス(広告)の口数も整数化される（B3）', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'リスクカード', riskTab: 'positive', riskAction: 'special_ad', riskQty: '1.5' })
    );
    expect(res.error).toBeUndefined();
    expect(res.ledger[0].quantity).toBe(1);
    expect(res.ledger[0].amount).toBe(5);
  });
});

// 借入(オ)＋自動利息(タ)、売掛割引(ア)＋手数料(タ)の組に groupId を付け、
// 片方だけ削除されて帳簿が不整合になる事故を防ぐ（removeEntry は組ごと削除する）。
describe('同時登録の組（groupId）と一括削除', () => {
  it('借入(オ)と自動利息(タ)は同一groupIdを持ち、どちらを削除しても組ごと消える', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'オ', amount: '100' })
    );
    expect(res.ledger).toHaveLength(2);
    const [loan, interest] = res.ledger;
    expect(loan.groupId).toBeTruthy();
    expect(loan.groupId).toBe(interest.groupId);
    // オを消してもタを消しても、組ごと消えて孤児が残らない
    expect(removeEntry(res.ledger, loan)).toHaveLength(0);
    expect(removeEntry(res.ledger, interest)).toHaveLength(0);
  });

  it('利息が発生しない少額の借入は組を作らない（単独削除できる）', () => {
    // 期1（利率10%）で9万借入 → floor(0.9)=0 で利息エントリなし
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: 'オ', amount: '9' })
    );
    expect(res.ledger).toHaveLength(1);
    expect(res.ledger[0].groupId).toBeUndefined();
  });

  it('売掛割引(ア)と手数料(タ)は同一groupIdを持ち、組ごと消える', () => {
    const res = buildTransactionEntries(
      makeCtx(),
      makeForm({ selectedCategory: '売掛割引', factoringAmount: '100' })
    );
    expect(res.ledger).toHaveLength(2);
    const [ar, fee] = res.ledger;
    expect(ar.category).toBe('ア');
    expect(fee.category).toBe('タ');
    expect(ar.groupId).toBeTruthy();
    expect(ar.groupId).toBe(fee.groupId);
    expect(removeEntry(res.ledger, ar)).toHaveLength(0);
    expect(removeEntry(res.ledger, fee)).toHaveLength(0);
  });
});
