import { describe, it, expect, afterEach } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { pb, isRemoteNewer, syncPlayerData } from '../../src/pocketbase.js';

// pb.collection をテスト用実装に差し替える（インスタンスのownプロパティで
// プロトタイプメソッドをシャドウし、afterEach で delete して元に戻す）
function mockCollection(impl) {
  pb.collection = () => impl;
}

afterEach(() => {
  delete pb.collection;
});

describe('isRemoteNewer (C2/C3: lastUpdated 比較の純粋関数)', () => {
  it('サーバー側が新しい場合のみ true', () => {
    expect(isRemoteNewer({ lastUpdated: 2000 }, 1000)).toBe(true);
    expect(isRemoteNewer({ lastUpdated: 1000 }, 2000)).toBe(false);
    expect(isRemoteNewer({ lastUpdated: 1000 }, 1000)).toBe(false); // 同時刻は上書き許可
  });

  it('サーバー側の lastUpdated が欠落・不正なら false（旧スキーマ互換＝従来どおり送信）', () => {
    expect(isRemoteNewer({}, 1000)).toBe(false);
    expect(isRemoteNewer(null, 1000)).toBe(false);
    expect(isRemoteNewer({ lastUpdated: 'broken' }, 1000)).toBe(false);
    expect(isRemoteNewer({ lastUpdated: 0 }, 1000)).toBe(false);
  });

  it('ローカル基準が不正なら false（誤スキップでpushを止めない）', () => {
    expect(isRemoteNewer({ lastUpdated: 2000 }, NaN)).toBe(false);
    expect(isRemoteNewer({ lastUpdated: 2000 }, undefined)).toBe(false);
  });

  it('ローカル基準が0（未記録）ならサーバー側があれば true（C3: リロード時は確認を挟む）', () => {
    expect(isRemoteNewer({ lastUpdated: 2000 }, 0)).toBe(true);
  });
});

describe('syncPlayerData (C2: 追い越し上書きガード)', () => {
  it('サーバーの data.lastUpdated が送信ペイロードより新しければ update せず skipped を返す', async () => {
    let updateCalled = false;
    mockCollection({
      getFirstListItem: async () => ({ id: 'rec1', data: { lastUpdated: 2000 } }),
      update: async () => { updateCalled = true; return { id: 'rec1' }; }
    });

    const result = await syncPlayerData('room1', 'player1', { lastUpdated: 1000 });
    expect(result).toEqual({ skipped: true, reason: 'server-newer' });
    expect(updateCalled).toBe(false);
  });

  it('送信ペイロードの方が新しければ従来どおり update する', async () => {
    let capturedBody = null;
    mockCollection({
      getFirstListItem: async () => ({ id: 'rec1', data: { lastUpdated: 1000 } }),
      update: async (id, body) => { capturedBody = body; return { id, ...body }; }
    });

    const payload = { lastUpdated: 2000 };
    const result = await syncPlayerData('room1', 'player1', payload);
    expect(result.skipped).toBeUndefined();
    expect(capturedBody.data).toEqual(payload);
  });

  it('サーバー側レコードに lastUpdated が無い旧形式でも update する（後方互換）', async () => {
    let updateCalled = false;
    mockCollection({
      getFirstListItem: async () => ({ id: 'rec1', data: {} }),
      update: async (id, body) => { updateCalled = true; return { id, ...body }; }
    });

    await syncPlayerData('room1', 'player1', { lastUpdated: 1000 });
    expect(updateCalled).toBe(true);
  });

  it('レコードが無ければ create する（既存のupsert挙動を維持）', async () => {
    let created = null;
    mockCollection({
      getFirstListItem: async () => {
        throw new ClientResponseError({ status: 404, response: { code: 404 } });
      },
      create: async (body) => { created = body; return { id: 'new1' }; }
    });

    await syncPlayerData('room1', 'player1', { lastUpdated: 1000 });
    expect(created).toMatchObject({ room: 'room1', player: 'player1' });
    expect(created.data).toEqual({ lastUpdated: 1000 });
  });
});

describe('syncPlayerData (C1: 空ローカルからの backup 上書き防止の透過性)', () => {
  it('backup が undefined のとき body に backup キーを含めない（サーバー側の復元点を潰さない）', async () => {
    let capturedBody = null;
    mockCollection({
      getFirstListItem: async () => ({ id: 'rec1', data: { lastUpdated: 1000 } }),
      update: async (id, body) => { capturedBody = body; return { id, ...body }; }
    });

    await syncPlayerData('room1', 'player1', { lastUpdated: 2000 }, undefined);
    expect('backup' in capturedBody).toBe(false);
  });

  it('backup が渡されたときは body に backup を含める', async () => {
    let capturedBody = null;
    mockCollection({
      getFirstListItem: async () => ({ id: 'rec1', data: { lastUpdated: 1000 } }),
      update: async (id, body) => { capturedBody = body; return { id, ...body }; }
    });

    const backup = { periods: { 1: { ledger: [] } }, currentPeriod: 1, savedAt: 123 };
    await syncPlayerData('room1', 'player1', { lastUpdated: 2000 }, backup);
    expect(capturedBody.backup).toEqual(backup);
  });
});
