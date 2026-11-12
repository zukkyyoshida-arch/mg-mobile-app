import { describe, it, expect } from 'vitest';
import { mergeLedger, mergePeriods, applyConflictChoices, updateTombstones, buildBaseHashes, hashEntry } from '../../src/sync/merge.js';

const e = (id, amount = 100, extra = {}) => ({ id, category: 'x', amount, timestamp: `2026-01-01T00:00:0${id.length}.000Z`, ...extra });

describe('mergeLedger', () => {
  it('片方にしか無い取引は残す', () => {
    const r = mergeLedger({ local: [e('a')], remote: [e('bb')] });
    expect(r.ledger.map((x) => x.id).sort()).toEqual(['a', 'bb']);
    expect(r.conflicts).toEqual([]);
  });
  it('tombstone は削除扱い（両側から消える）', () => {
    const r = mergeLedger({ local: [e('a'), e('bb')], remote: [e('a'), e('ccc')], deleted: new Set(['a', 'ccc']) });
    expect(r.ledger.map((x) => x.id)).toEqual(['bb']);
  });
  it('base が一致する側は未変更とみなし、変更した側を採る', () => {
    const base = { a: hashEntry(e('a', 100)) };
    const r1 = mergeLedger({ local: [e('a', 100)], remote: [e('a', 200)], baseHashes: base });
    expect(r1.ledger[0].amount).toBe(200); expect(r1.conflicts).toEqual([]);
    const r2 = mergeLedger({ local: [e('a', 300)], remote: [e('a', 100)], baseHashes: base });
    expect(r2.ledger[0].amount).toBe(300); expect(r2.conflicts).toEqual([]);
  });
  it('両方が別内容に変えたとき／base 不明のときだけ conflict', () => {
    const base = { a: hashEntry(e('a', 100)) };
    const r = mergeLedger({ local: [e('a', 300)], remote: [e('a', 200)], baseHashes: base });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].local.amount).toBe(300); expect(r.conflicts[0].remote.amount).toBe(200);
    expect(mergeLedger({ local: [e('a', 1)], remote: [e('a', 2)] }).conflicts).toHaveLength(1);
  });
  it('同一内容は conflict にならない', () => {
    expect(mergeLedger({ local: [e('a')], remote: [e('a')] }).conflicts).toEqual([]);
  });
});

describe('mergePeriods', () => {
  const mk = (ledger, carryover = {}) => ({ 1: { carryover, ledger, actuals: {}, budget: {} } });
  it('ledger を統合し、carryover は新しい側を項目ごとに採る', () => {
    const local = mk([e('a')], { cash: 10, loan: 5 });
    const remote = mk([e('bb')], { cash: 20, tax: 3 });
    const r = mergePeriods({ local, remote, localTs: 1, remoteTs: 2 });
    expect(r.periods[1].ledger).toHaveLength(2);
    expect(r.periods[1].carryover).toEqual({ cash: 20, loan: 5, tax: 3 });
    const r2 = mergePeriods({ local, remote, localTs: 3, remoteTs: 2 });
    expect(r2.periods[1].carryover.cash).toBe(10);
  });
  it('片方にしか無い期は残り、tombstone を除外する', () => {
    const r = mergePeriods({ local: { 1: { ledger: [e('a')] } }, remote: { 2: { ledger: [e('bb')] } }, localDeleted: ['bb'] });
    expect(r.periods[1].ledger).toHaveLength(1);
    expect(r.periods[2].ledger).toHaveLength(0);
    expect(r.deletedIds).toEqual(['bb']);
  });
  it('conflict は選択で反映できる', () => {
    const r = mergePeriods({ local: mk([e('a', 1)]), remote: mk([e('a', 2)]) });
    expect(r.conflicts).toHaveLength(1);
    const key = `${r.conflicts[0].period}:${r.conflicts[0].id}`;
    expect(applyConflictChoices(r.periods, r.conflicts, { [key]: 'remote' })[1].ledger[0].amount).toBe(2);
    expect(applyConflictChoices(r.periods, r.conflicts, { [key]: 'local' })[1].ledger[0].amount).toBe(1);
  });
});

describe('tombstones / base', () => {
  it('消えたIDを記録し、復活したIDは外す', () => {
    const prev = mk1(['a', 'bb']);
    const next = mk1(['a']);
    expect(updateTombstones(prev, next, [])).toEqual(['bb']);
    expect(updateTombstones(next, prev, ['bb'])).toEqual([]);
  });
  it('buildBaseHashes', () => {
    expect(Object.keys(buildBaseHashes(mk1(['a', 'bb'])))).toEqual(['a', 'bb']);
  });
});
function mk1(ids) { return { 1: { ledger: ids.map((i) => e(i)) } }; }
