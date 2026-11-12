// 同期API（/api/*、Cloudflare Workers + D1）のクライアント。App / Dashboard / Archives から使う。
import { getDeviceToken, setDeviceToken, deviceTokensForRoom, getSyncState, setSyncState, getTeacherInfo, setTeacherInfo } from './store.js';

export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `通信エラー (${status})`);
    this.status = status;
    this.code = body?.error;
    this.body = body;
  }
}

// 保存データ破損中（storageIssue.blocking）はサーバーへ push しない。pull（取得）は許可する。
let pushBlocked = false;
export const setPushBlocked = (v) => { pushBlocked = !!v; };
export const isPushBlocked = () => pushBlocked;
export class PushBlockedError extends Error {
  constructor() { super('保存データの確認が済むまで、サーバーへの送信は停止しています'); this.name = 'PushBlockedError'; }
}

async function call(method, path, { body, headers } = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* 空レスポンス */ }
  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed;
}

const enc = encodeURIComponent;
const dev = (room, player) => ({ 'x-device-token': getDeviceToken(room, player) });

// ---- 講師 ----
export async function createRoom(roomId) {
  const r = await call('POST', '/rooms', { body: { roomId } });
  setTeacherInfo(r.roomId, { teacherKey: r.teacherKey, pin: r.pin });
  return r;
}

// ---- 参加者 ----
// 戻り値: { player, renamed, created, record:{version,data,backup} }。トークンは保存して返さない。
export async function joinRoom(roomId, player, pin) {
  const r = await call('POST', `/rooms/${enc(roomId)}/join`, { body: { player, pin, deviceTokens: deviceTokensForRoom(roomId) } });
  if (r.token) setDeviceToken(roomId, r.player, r.token);
  return { player: r.player, renamed: r.renamed, created: r.created, record: r.record };
}

export const hasDeviceToken = (room, player) => !!getDeviceToken(room, player);
export const getStoredVersion = (room, player) => getSyncState(room, player).version;
export const getBaseHashes = (room, player) => getSyncState(room, player).baseHashes;
export const markSynced = (room, player, version, baseHashes) => setSyncState(room, player, { version, baseHashes: baseHashes ?? getBaseHashes(room, player) });

export const fetchPlayerRecord = (room, player) => call('GET', `/rooms/${enc(room)}/players/${enc(player)}`, { headers: dev(room, player) });

// 書き込み。成功: { ok:true, version }。競合: { conflict:true, server:{version,data,backup} }。
// baseVersion を省略すると、この端末が最後に知っているバージョンを使う。
export async function pushPlayer(room, player, data, backup, baseVersion) {
  if (pushBlocked) throw new PushBlockedError();
  const base = baseVersion ?? getStoredVersion(room, player) ?? 0;
  try {
    const body = { baseVersion: base, data };
    if (backup !== undefined) body.backup = backup;
    const r = await call('PUT', `/rooms/${enc(room)}/players/${enc(player)}`, { body, headers: dev(room, player) });
    return { ok: true, version: r.version };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.body?.server) return { conflict: true, server: e.body.server };
    throw e;
  }
}

// ［この端末の内容でサーバーを上書き］: 最新バージョンを取り直してから、その版を基準に書く
export async function overwriteServer(room, player, data, backup) {
  if (pushBlocked) throw new PushBlockedError();
  const cur = await fetchPlayerRecord(room, player);
  return pushPlayer(room, player, data, backup, cur.version);
}

// ---- 講師向け ----
const teacherHeaders = (room, key) => ({ 'x-teacher-key': key || getTeacherInfo(room)?.teacherKey || '' });

// Dashboard 用ポーリング購読。callback({ [player]: data })。unsubscribe 関数を返す。
export function subscribeToRoom(room, callback, { teacherKey, intervalMs = 4000, onError } = {}) {
  if (!room) return () => {};
  let stopped = false;
  let timer = null;
  const tick = async () => {
    try {
      const r = await call('GET', `/rooms/${enc(room)}/players`, { headers: teacherHeaders(room, teacherKey) });
      if (!stopped) callback(r.players || {});
    } catch (e) {
      if (!stopped && onError) onError(e);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

export const archiveRoom = (room, players, teacherKey) => {
  if (!room || !players || players.length === 0) return Promise.reject(new Error('保存するデータがありません'));
  return call('POST', `/rooms/${enc(room)}/archives`, { body: { players }, headers: teacherHeaders(room, teacherKey) });
};

export const listArchives = async (room, teacherKey) =>
  (await call('GET', `/rooms/${enc(room)}/archives`, { headers: teacherHeaders(room, teacherKey) })).archives;
