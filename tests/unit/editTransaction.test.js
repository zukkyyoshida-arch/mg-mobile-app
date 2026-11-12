import { describe, it, expect } from 'vitest';
import {
  getEntryGroup,
  getGroupVoucherNos,
  entryToFormState,
  removeEntryWithPositions,
  restoreRemovedEntries
} from '../../src/components/cashledger/editTransaction.js';

const loan = { id: '100', groupId: 'g1', voucherNo: '1', category: 'オ', quantity: 1, price: 50, amount: 50 };
const interest = { id: '100-int', groupId: 'g1', voucherNo: '2', category: 'タ', quantity: 1, price: 5, amount: 5 };
const other = { id: '200', voucherNo: '3', category: 'ス', quantity: 1, price: 30, amount: 30 };
const adTokyo = { id: '300-sale-tokyo', voucherNo: '4', category: 'キ', quantity: 2, price: 32, amount: 64, usedAd: true };
const adOsaka = { id: '300-sale-osaka', voucherNo: '5', category: 'キ', quantity: 1, price: 24, amount: 24, usedAd: true };
const ko = { id: '400-ko', voucherNo: '6', category: 'コ', quantity: 3, price: 1, amount: 3 };
const sa = { id: '400-sa', voucherNo: '7', category: 'サ', quantity: 2, price: 1, amount: 2 };

describe('getEntryGroup', () => {
  const ledger = [loan, interest, other, adTokyo, adOsaka, ko, sa];

  it('groupId が同じ行をまとめる（借入＋自動利息）', () => {
    expect(getEntryGroup(ledger, interest).map(e => e.id)).toEqual(['100', '100-int']);
  });

  it('groupId のない独占販売（広告）の市場別行を、登録時刻の一致でまとめる', () => {
    expect(getEntryGroup(ledger, adOsaka).map(e => e.id)).toEqual(['300-sale-tokyo', '300-sale-osaka']);
  });

  it('生産のコ＋サをまとめる', () => {
    expect(getEntryGroup(ledger, ko).map(e => e.id)).toEqual(['400-ko', '400-sa']);
  });

  it('単独の取引は自分だけ', () => {
    expect(getEntryGroup(ledger, other)).toEqual([other]);
  });

  it('伝票番号は数値の昇順で返す', () => {
    expect(getGroupVoucherNos([{ voucherNo: '10' }, { voucherNo: '9' }, {}])).toEqual([9, 10]);
  });
});

describe('entryToFormState', () => {
  it('借入（組）は 銀行借入 の項目と金額を復元する', () => {
    const { form } = entryToFormState(interest, [loan, interest]);
    expect(form).toEqual({ selectedCategory: 'オ', amount: '50' });
  });

  it('独占販売（広告）は全市場の数量をまとめて復元する', () => {
    const { form } = entryToFormState(adTokyo, [adTokyo, adOsaka]);
    expect(form.selectedCategory).toBe('リスクカード');
    expect(form.riskAction).toBe('monopoly_ad');
    expect(form.riskMonopolyAdQtys).toMatchObject({ tokyo: 2, osaka: 1, sapporo: 0 });
  });

  it('生産はコとサの両方を復元する', () => {
    const { form } = entryToFormState(sa, [ko, sa]);
    expect(form).toEqual({ selectedCategory: '生産', productionKo: '3', productionSa: '2' });
  });

  it('内訳のない材料購入は項目だけ選び、案内文を返す', () => {
    const r = entryToFormState({ id: '1', category: 'ツ', quantity: 4, amount: 48 });
    expect(r.form).toEqual({ selectedCategory: 'ツ' });
    expect(r.note).toContain('合計4個');
  });

  it('既定は項目と金額を復元する', () => {
    expect(entryToFormState(other).form).toEqual({ selectedCategory: 'ス', amount: '30' });
  });
});

describe('removeEntryWithPositions / restoreRemovedEntries', () => {
  const ledger = [loan, interest, other, adTokyo, adOsaka];

  it('組ごと削除し、元に戻すと元の位置・順序に戻る', () => {
    const { ledger: next, removed } = removeEntryWithPositions(ledger, loan);
    expect(next.map(e => e.id)).toEqual(['200', '300-sale-tokyo', '300-sale-osaka']);
    expect(removed.map(r => r.index)).toEqual([0, 1]);
    expect(restoreRemovedEntries(next, removed)).toEqual(ledger);
  });

  it('独占販売の市場別行もまとめて削除・復元する', () => {
    const { ledger: next, removed } = removeEntryWithPositions(ledger, adOsaka);
    expect(next.map(e => e.id)).toEqual(['100', '100-int', '200']);
    expect(restoreRemovedEntries(next, removed)).toEqual(ledger);
  });

  it('削除後に追加された取引があっても壊さず戻す', () => {
    const { ledger: next, removed } = removeEntryWithPositions(ledger, other);
    const added = { id: '999', voucherNo: '6', category: 'ス', amount: 1 };
    const restored = restoreRemovedEntries([...next, added], removed);
    expect(restored.map(e => e.id)).toEqual(['100', '100-int', '200', '300-sale-tokyo', '300-sale-osaka', '999']);
  });

  it('同じ取引を二重に戻さない', () => {
    const { removed } = removeEntryWithPositions(ledger, other);
    expect(restoreRemovedEntries(ledger, removed)).toEqual(ledger);
  });
});
