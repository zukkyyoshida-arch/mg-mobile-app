import { describe, it, expect } from 'vitest';
import { getRiskSaleLimit, getSalesLimitError } from '../../src/components/cashledger/salesLimits.js';

const results = (over = {}) => ({
  prod: { endingCount: 5 },
  activeSalesmen: 1,
  activeAdChips: 2,
  activeRdChips: 0,
  ...over
});

const risk = (riskAction, extra = {}) => ({
  selectedCategory: 'リスクカード', riskTab: 'positive', riskAction, ...extra
});

describe('getRiskSaleLimit', () => {
  it('在庫と「1単位につき2個」の小さい方が上限', () => {
    expect(getRiskSaleLimit('monopoly_salesman', results()).limit).toBe(2);
    expect(getRiskSaleLimit('monopoly_ad', results()).limit).toBe(4);
    expect(getRiskSaleLimit('monopoly_ad', results({ prod: { endingCount: 3 } })).limit).toBe(3);
    expect(getRiskSaleLimit('rd_success', results()).limit).toBe(0);
  });

  it('販売系以外は null', () => {
    expect(getRiskSaleLimit('special_mat', results())).toBeNull();
  });
});

describe('getSalesLimitError', () => {
  it('独占販売(Sマン)で上限を超える手入力はエラー（理由と上限値を含む）', () => {
    const msg = getSalesLimitError(risk('monopoly_salesman', { riskQty: '3' }), results());
    expect(msg).toContain('2個まで');
    expect(msg).toContain('セールスマン');
  });

  it('上限ちょうどは通る', () => {
    expect(getSalesLimitError(risk('monopoly_salesman', { riskQty: '2' }), results())).toBeNull();
  });

  it('在庫が少ないときは在庫を理由に挙げる', () => {
    const msg = getSalesLimitError(risk('monopoly_ad', { riskMonopolyAdQtys: { tokyo: 2, osaka: 2 } }), results({ prod: { endingCount: 3 } }));
    expect(msg).toContain('3個まで');
    expect(msg).toContain('手持在庫');
  });

  it('研究開発成功はチップがなければ販売できない', () => {
    expect(getSalesLimitError(risk('rd_success', { riskQty: '1' }), results())).toContain('0個まで');
  });

  it('通常販売: 市場ごとの上限と在庫を超えるとエラー', () => {
    const over = { sapporo: { qty: 4, price: 30 } };
    expect(getSalesLimitError({ selectedCategory: 'キ', salesData: over }, results())).toContain('札幌');
    const tooMany = { sendai: { qty: 4, price: 30 }, tokyo: { qty: 2, price: 30 } };
    expect(getSalesLimitError({ selectedCategory: 'キ', salesData: tooMany }, results())).toContain('手持在庫の 5個');
    expect(getSalesLimitError({ selectedCategory: 'ネ', salesData: { tokyo: { qty: 5, price: 30 } } }, results())).toBeNull();
  });

  it('投げ売りは在庫まで', () => {
    expect(getSalesLimitError({ selectedCategory: 'キ', isFireSale: true, fireSaleQty: '6' }, results())).toContain('5個');
    expect(getSalesLimitError({ selectedCategory: 'キ', isFireSale: true, fireSaleQty: '5' }, results())).toBeNull();
  });

  it('販売以外の項目は対象外', () => {
    expect(getSalesLimitError({ selectedCategory: 'ス', amount: '999' }, results())).toBeNull();
    expect(getSalesLimitError(risk('special_mat', { riskQty: '99' }), results())).toBeNull();
  });
});
