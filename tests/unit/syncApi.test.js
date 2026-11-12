import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleApi } from '../../worker/api.js';
import { timingSafeEqualStr } from '../../worker/crypto.js';

// node:sqlite を D1 互換（prepare/bind/first/run/all）に包む
function makeDB() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      let args = [];
      const st = db.prepare(sql);
      const obj = {
        bind(...a) { args = a; return obj; },
        async first() { return st.get(...args) ?? null; },
        async all() { return { results: st.all(...args) }; },
        async run() { const r = st.run(...args); return { meta: { changes: Number(r.changes) } }; }
      };
      return obj;
    }
  };
}

let env;
beforeEach(() => { env = { DB: makeDB() }; });

const api = async (method, path, { body, headers } = {}) => {
  const res = await handleApi(new Request('http://x/api' + path, {
    method, headers: { 'content-type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined
  }), env);
  return { status: res.status, body: await res.json() };
};
const setup = async () => {
  const room = (await api('POST', '/rooms', { body: { roomId: 'r1' } })).body;
  return room;
};
const join = (pin, player, tokens = []) => api('POST', '/rooms/r1/join', { body: { player, pin, deviceTokens: tokens } });
const put = (player, token, baseVersion, data = { a: 1 }, backup) =>
  api('PUT', `/rooms/r1/players/${encodeURIComponent(player)}`, { headers: { 'x-device-token': token }, body: { baseVersion, data, backup } });

describe('sync API', () => {
  it('ルーム作成→参加→保存→古いbaseVersionで409', async () => {
    const room = await setup();
    expect(room.pin).toMatch(/^\d{6}$/);
    const j = (await join(room.pin, '鈴木')).body;
    expect(j.player).toBe('鈴木'); expect(j.created).toBe(true); expect(j.record.version).toBe(0);
    const r1 = await put('鈴木', j.token, 0, { v: 1 }, { periods: { 1: {} } });
    expect(r1.status).toBe(200); expect(r1.body.version).toBe(1);
    const stale = await put('鈴木', j.token, 0, { v: 2 });
    expect(stale.status).toBe(409);
    expect(stale.body.server.version).toBe(1);
    expect(stale.body.server.data).toEqual({ v: 1 });
    expect(stale.body.server.backup).toEqual({ periods: { 1: {} } });
    // backup 省略時は既存を保持
    const r2 = await put('鈴木', j.token, 1, { v: 3 });
    expect(r2.body.version).toBe(2);
    const got = await api('GET', '/rooms/r1/players/%E9%88%B4%E6%9C%A8', { headers: { 'x-device-token': j.token } });
    expect(got.body.backup).toEqual({ periods: { 1: {} } });
  });

  it('トークン違いは403、書き込めない', async () => {
    const room = await setup();
    const j = (await join(room.pin, '鈴木')).body;
    expect((await put('鈴木', 'wrong', 0)).status).toBe(403);
    expect((await put('鈴木', '', 0)).status).toBe(403);
    expect((await put('鈴木', j.token, 0)).status).toBe(200);
  });

  it('同名の別端末は「名前(2)」で登録され、上書きされない。自分のトークンなら元の名前に戻れる', async () => {
    const room = await setup();
    const a = (await join(room.pin, '鈴木')).body;
    await put('鈴木', a.token, 0, { who: 'a' });
    const b = (await join(room.pin, '鈴木')).body;
    expect(b.player).toBe('鈴木(2)'); expect(b.renamed).toBe(true);
    const c = (await join(room.pin, '鈴木')).body;
    expect(c.player).toBe('鈴木(3)');
    // b の端末が再参加（全トークンを送る）→ 鈴木(2) に戻る
    const b2 = (await join(room.pin, '鈴木', [b.token])).body;
    expect(b2.player).toBe('鈴木(2)'); expect(b2.created).toBe(false);
    // a のデータは無事
    const ga = await api('GET', '/rooms/r1/players/%E9%88%B4%E6%9C%A8', { headers: { 'x-device-token': a.token } });
    expect(ga.body.data).toEqual({ who: 'a' });
    // b のトークンで a は書けない
    expect((await put('鈴木', b.token, 1)).status).toBe(403);
  });

  it('PIN違いは403、失敗が続くと429', async () => {
    const room = await setup();
    const wrong = room.pin === '000000' ? '111111' : '000000';
    expect((await join(wrong, 'x')).status).toBe(403);
    for (let i = 0; i < 9; i++) await join(wrong, 'x');
    expect((await join(room.pin, 'x')).status).toBe(429);
  });

  it('講師キーなしのアーカイブ作成・一覧・全員閲覧は403、講師キーでは可', async () => {
    const room = await setup();
    const players = [{ id: 'a', totalNetAssets: 1 }];
    expect((await api('POST', '/rooms/r1/archives', { body: { players } })).status).toBe(403);
    expect((await api('POST', '/rooms/r1/archives', { body: { players }, headers: { 'x-teacher-key': 'bad' } })).status).toBe(403);
    expect((await api('GET', '/rooms/r1/archives')).status).toBe(403);
    expect((await api('GET', '/rooms/r1/players')).status).toBe(403);
    const h = { 'x-teacher-key': room.teacherKey };
    expect((await api('POST', '/rooms/r1/archives', { body: { players }, headers: h })).status).toBe(201);
    expect((await api('GET', '/rooms/r1/archives', { headers: h })).body.archives).toHaveLength(1);
    expect((await api('GET', '/rooms/r1/players', { headers: h })).status).toBe(200);
  });

  it('入力検証: 型・サイズ・重複ルーム', async () => {
    const room = await setup();
    expect((await api('POST', '/rooms', { body: { roomId: 'r1' } })).status).toBe(409);
    expect((await api('POST', '/rooms', { body: { roomId: 'a/b' } })).status).toBe(400);
    const j = (await join(room.pin, 'p')).body;
    expect((await put('p', j.token, 'x')).status).toBe(400);
    expect((await put('p', j.token, 0, [1])).status).toBe(400);
    const big = await api('PUT', '/rooms/r1/players/p', { headers: { 'x-device-token': j.token }, body: { baseVersion: 0, data: {}, backup: { s: 'x'.repeat(1100000) } } });
    expect(big.status).toBe(413);
  });

  it('PIN/トークンはDBにハッシュでのみ保存される', async () => {
    const room = await setup();
    const j = (await join(room.pin, 'p')).body;
    const rows = await env.DB.prepare('SELECT * FROM rooms').all();
    const dump = JSON.stringify(rows.results) + JSON.stringify((await env.DB.prepare('SELECT * FROM players').all()).results);
    expect(dump).not.toContain(room.teacherKey);
    expect(dump).not.toContain(j.token);
    expect(dump).not.toContain(`"${room.pin}"`);
  });
});

describe('timingSafeEqualStr', () => {
  it('一致/不一致/長さ違い', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true);
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false);
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualStr(null, 'a')).toBe(false);
  });
});
