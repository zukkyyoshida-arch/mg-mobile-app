// 戦略MG 同期API（Cloudflare Workers + D1）。アプリと同一オリジンで /api/* を処理する。
// 秘密値（PIN・講師キー・端末トークン）はログに出さない。ハッシュのみ保存し、比較は定数時間。
import { sha256Hex, timingSafeEqualStr, verifySecret, randomToken, randomPin } from './crypto.js';

export const MAX_BODY_BYTES = 1024 * 1024; // 1MB
const MAX_DATA_BYTES = 128 * 1024;
const PIN_FAIL_LIMIT = 10;
const PIN_FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_NAME_TRIES = 50;

class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

// ---------- 入力検証 ----------
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
export function validName(s, max) {
  return typeof s === 'string' && s.trim().length >= 1 && s.length <= max && !CONTROL.test(s) && !s.includes('/');
}
const validRoomId = (s) => validName(s, 64) && s === s.trim();
const validPlayer = (s) => validName(s, 40) && s === s.trim();

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

async function readJson(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'データが大きすぎます');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'データが大きすぎます');
  try {
    const v = JSON.parse(text);
    if (!isPlainObject(v)) throw new Error('not object');
    return v;
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON の形式が正しくありません');
  }
}

const parseCol = (s) => {
  if (s == null) return null;
  try { return JSON.parse(s); } catch { return null; }
};

// ---------- 認証 ----------
async function getRoom(env, roomId) {
  const room = await env.DB.prepare('SELECT * FROM rooms WHERE room_id = ?').bind(roomId).first();
  if (!room) throw new HttpError(404, 'room_not_found', 'ルームが見つかりません');
  return room;
}

async function requireTeacher(request, env, roomId) {
  const room = await getRoom(env, roomId);
  const key = request.headers.get('x-teacher-key') || '';
  if (!(await verifySecret(key, room.teacher_key_hash))) {
    throw new HttpError(403, 'forbidden', '講師キーが正しくありません');
  }
  return room;
}

async function requireDevice(request, env, roomId, player) {
  const row = await env.DB.prepare('SELECT * FROM players WHERE room_id = ? AND player = ?').bind(roomId, player).first();
  if (!row) throw new HttpError(404, 'player_not_found', 'プレイヤーが見つかりません');
  const token = request.headers.get('x-device-token') || '';
  if (!(await verifySecret(token, row.token_hash))) {
    throw new HttpError(403, 'forbidden', 'この端末にはこのプレイヤーを操作する権限がありません');
  }
  return row;
}

const recordOf = (row) => ({ version: row.version, data: parseCol(row.data) || {}, backup: parseCol(row.backup) });

// ---------- ハンドラ ----------
async function createRoom(request, env) {
  const body = await readJson(request);
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
  if (!validRoomId(roomId)) throw new HttpError(400, 'bad_room_id', 'ルームIDは1〜64文字で入力してください（/ と制御文字は使えません）');
  const pin = randomPin();
  const teacherKey = randomToken(24);
  const salt = randomToken(12);
  const res = await env.DB.prepare(
    'INSERT INTO rooms (room_id, pin_salt, pin_hash, teacher_key_hash, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(room_id) DO NOTHING'
  ).bind(roomId, salt, await sha256Hex(salt + pin), await sha256Hex(teacherKey), Date.now()).run();
  if (!res.meta?.changes) throw new HttpError(409, 'room_exists', 'このルームIDは既に使われています');
  return json(201, { roomId, pin, teacherKey });
}

async function checkPin(env, room, pin) {
  const now = Date.now();
  let fails = room.pin_fail_count;
  let windowAt = room.pin_fail_window_at;
  if (now - windowAt > PIN_FAIL_WINDOW_MS) { fails = 0; windowAt = now; }
  if (fails >= PIN_FAIL_LIMIT) throw new HttpError(429, 'too_many_attempts', 'PINの入力失敗が続いたため、しばらく時間をおいてください');
  const ok = await verifySecret(typeof pin === 'string' ? pin : '', room.pin_hash, room.pin_salt);
  if (ok) {
    if (fails) await env.DB.prepare('UPDATE rooms SET pin_fail_count = 0 WHERE room_id = ?').bind(room.room_id).run();
    return;
  }
  await env.DB.prepare('UPDATE rooms SET pin_fail_count = ?, pin_fail_window_at = ? WHERE room_id = ?')
    .bind(fails + 1, windowAt, room.room_id).run();
  throw new HttpError(403, 'bad_pin', 'ルームPINが正しくありません');
}

async function joinRoom(request, env, roomId) {
  const body = await readJson(request);
  const requested = typeof body.player === 'string' ? body.player.trim() : '';
  if (!validPlayer(requested)) throw new HttpError(400, 'bad_player', 'プレイヤー名は1〜40文字で入力してください');
  const room = await getRoom(env, roomId);
  await checkPin(env, room, body.pin);

  // この端末が持っているトークン候補（同名の別人と区別するため、全候補名のトークンを受け取る）
  const tokens = Array.isArray(body.deviceTokens) ? body.deviceTokens.filter((t) => typeof t === 'string' && t.length <= 256).slice(0, 30) : [];
  const tokenHashes = await Promise.all(tokens.map(sha256Hex));
  const mine = (hash) => tokenHashes.some((h) => timingSafeEqualStr(h, hash));

  for (let n = 1; n <= MAX_NAME_TRIES; n++) {
    const candidate = n === 1 ? requested : `${requested}(${n})`;
    if (candidate.length > 40) break;
    const row = await env.DB.prepare('SELECT * FROM players WHERE room_id = ? AND player = ?').bind(roomId, candidate).first();
    if (row) {
      if (mine(row.token_hash)) {
        return json(200, { player: candidate, renamed: candidate !== requested, created: false, record: recordOf(row) });
      }
      continue; // 他人の名前 → 次の候補名へ
    }
    const token = randomToken(32);
    const now = Date.now();
    const ins = await env.DB.prepare(
      'INSERT INTO players (room_id, player, token_hash, version, data, backup, created_at, updated_at) VALUES (?, ?, ?, 0, ?, NULL, ?, ?) ON CONFLICT(room_id, player) DO NOTHING'
    ).bind(roomId, candidate, await sha256Hex(token), '{}', now, now).run();
    if (!ins.meta?.changes) { n--; continue; } // 同時に作られた → 同じ候補を再判定
    return json(200, {
      player: candidate, renamed: candidate !== requested, created: true, token,
      record: { version: 0, data: {}, backup: null }
    });
  }
  throw new HttpError(409, 'name_unavailable', '使える名前が見つかりませんでした。別の名前で参加してください');
}

async function listPlayers(request, env, roomId) {
  await requireTeacher(request, env, roomId);
  const { results } = await env.DB.prepare('SELECT player, version, data FROM players WHERE room_id = ?').bind(roomId).all();
  const players = {};
  for (const r of results || []) players[r.player] = parseCol(r.data) || {};
  return json(200, { players });
}

async function getPlayer(request, env, roomId, player) {
  const row = await requireDevice(request, env, roomId, player);
  return json(200, recordOf(row));
}

async function putPlayer(request, env, roomId, player) {
  const row = await requireDevice(request, env, roomId, player);
  const body = await readJson(request);
  const { baseVersion, data, backup } = body;
  if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new HttpError(400, 'bad_base_version', 'baseVersion が正しくありません');
  if (!isPlainObject(data)) throw new HttpError(400, 'bad_data', 'data はオブジェクトで指定してください');
  if (backup !== undefined && backup !== null && !isPlainObject(backup)) throw new HttpError(400, 'bad_backup', 'backup はオブジェクトで指定してください');
  const dataStr = JSON.stringify(data);
  if (dataStr.length > MAX_DATA_BYTES) throw new HttpError(413, 'too_large', 'data が大きすぎます');
  const backupStr = backup ? JSON.stringify(backup) : null;

  // 楽観ロック: version が一致するときだけ更新（原子的）
  const updated = await env.DB.prepare(
    'UPDATE players SET data = ?, backup = COALESCE(?, backup), version = version + 1, updated_at = ? WHERE room_id = ? AND player = ? AND version = ? RETURNING version'
  ).bind(dataStr, backupStr, Date.now(), roomId, player, baseVersion).first();
  if (updated) return json(200, { version: updated.version });

  const current = await env.DB.prepare('SELECT * FROM players WHERE room_id = ? AND player = ?').bind(roomId, player).first();
  if (!current) throw new HttpError(404, 'player_not_found', 'プレイヤーが見つかりません');
  void row;
  throw new HttpError(409, 'version_conflict', 'サーバー側のデータが更新されています', { server: recordOf(current) });
}

async function postArchive(request, env, roomId) {
  await requireTeacher(request, env, roomId);
  const body = await readJson(request);
  if (!Array.isArray(body.players) || body.players.length === 0 || !body.players.every(isPlainObject)) {
    throw new HttpError(400, 'bad_players', '保存するデータがありません');
  }
  const ts = new Date().toISOString();
  await env.DB.prepare('INSERT INTO archives (room_id, timestamp, players) VALUES (?, ?, ?)')
    .bind(roomId, ts, JSON.stringify(body.players)).run();
  return json(201, { ok: true, timestamp: ts });
}

async function listArchives(request, env, roomId) {
  await requireTeacher(request, env, roomId);
  const { results } = await env.DB.prepare('SELECT room_id, timestamp, players FROM archives WHERE room_id = ? ORDER BY id DESC LIMIT 200')
    .bind(roomId).all();
  return json(200, {
    archives: (results || []).map((r) => ({ roomId: r.room_id, timestamp: r.timestamp, players: parseCol(r.players) || [] }))
  });
}

// ---------- ルーティング ----------
export async function handleApi(request, env) {
  try {
    if (!env?.DB) throw new HttpError(500, 'no_db', 'サーバー設定エラー');
    const url = new URL(request.url);
    const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map((s) => {
      try { return decodeURIComponent(s); } catch { throw new HttpError(400, 'bad_path', 'URLが正しくありません'); }
    });
    const m = request.method;
    const allow = (...methods) => { if (!methods.includes(m)) throw new HttpError(405, 'method_not_allowed', 'メソッドが許可されていません'); };

    if (seg[0] === 'health' && seg.length === 1) return json(200, { ok: true });
    if (seg[0] === 'rooms') {
      if (seg.length === 1) { allow('POST'); return await createRoom(request, env); }
      const roomId = seg[1];
      if (seg[2] === 'join' && seg.length === 3) { allow('POST'); return await joinRoom(request, env, roomId); }
      if (seg[2] === 'players') {
        if (seg.length === 3) { allow('GET'); return await listPlayers(request, env, roomId); }
        if (seg.length === 4) {
          allow('GET', 'PUT');
          return m === 'GET' ? await getPlayer(request, env, roomId, seg[3]) : await putPlayer(request, env, roomId, seg[3]);
        }
      }
      if (seg[2] === 'archives' && seg.length === 3) {
        allow('GET', 'POST');
        return m === 'GET' ? await listArchives(request, env, roomId) : await postArchive(request, env, roomId);
      }
    }
    throw new HttpError(404, 'not_found', 'APIが見つかりません');
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message, ...(e.extra || {}) });
    console.error('api error:', e?.name, e?.message); // 秘密値は含めない
    return json(500, { error: 'internal', message: 'サーバーエラーが発生しました' });
  }
}
