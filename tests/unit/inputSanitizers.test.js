import { describe, it, expect } from 'vitest';
import { toSafeInt, MAX_AMOUNT } from '../../src/utils/inputSanitizers.js';
import {
  toSafeInt as ledgerToSafeInt,
  MAX_AMOUNT as LEDGER_MAX_AMOUNT
} from '../../src/components/cashledger/buildTransactionEntries.js';

// フォーム側（inputSanitizers）と出納帳側（buildTransactionEntries）の toSafeInt が
// 同一仕様であることを検証し、実装のドリフトを防ぐ。
const CASES = [
  0, 1, 42, '7', '2.5', 1.9, -0.5, '-3', -100,
  Infinity, -Infinity, NaN, '1e309', 'abc', '', null, undefined,
  MAX_AMOUNT, MAX_AMOUNT + 1, 1e13, '99999999'
];

describe('toSafeInt - inputSanitizers と buildTransactionEntries の一致', () => {
  it('MAX_AMOUNT は両者で同一（9999999）', () => {
    expect(MAX_AMOUNT).toBe(9999999);
    expect(LEDGER_MAX_AMOUNT).toBe(MAX_AMOUNT);
  });

  it.each(CASES)('入力 %s に対して両関数の結果が一致する', (v) => {
    expect(ledgerToSafeInt(v)).toBe(toSafeInt(v));
  });
});

describe('toSafeInt - 仕様', () => {
  it('Infinity / NaN / 非数値は 0', () => {
    expect(toSafeInt(Infinity)).toBe(0);
    expect(toSafeInt(-Infinity)).toBe(0);
    expect(toSafeInt(NaN)).toBe(0);
    expect(toSafeInt('1e309')).toBe(0);
    expect(toSafeInt('abc')).toBe(0);
  });

  it('負数は 0 へクランプ', () => {
    expect(toSafeInt(-1)).toBe(0);
    expect(toSafeInt('-3')).toBe(0);
    expect(toSafeInt(-0.5)).toBe(0);
  });

  it('小数は切り捨て', () => {
    expect(toSafeInt(1.9)).toBe(1);
    expect(toSafeInt('2.5')).toBe(2);
  });

  it('MAX_AMOUNT を超える値は上限クランプ', () => {
    expect(toSafeInt(MAX_AMOUNT)).toBe(MAX_AMOUNT);
    expect(toSafeInt(MAX_AMOUNT + 1)).toBe(MAX_AMOUNT);
    expect(toSafeInt(1e13)).toBe(MAX_AMOUNT);
  });
});
