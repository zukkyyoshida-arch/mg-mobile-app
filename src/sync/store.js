// 同期層が使う localStorage（端末トークン・講師キー・同期バージョン等）。例外は握りつぶす。
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const readObj = (k) => { try { const v = JSON.parse(get(k) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

const slot = (room, player) => `${room}\u0000${player}`;

export const getDeviceToken = (room, player) => readObj('mg_device_tokens')[slot(room, player)] || '';
export const setDeviceToken = (room, player, token) => { const o = readObj('mg_device_tokens'); o[slot(room, player)] = token; set('mg_device_tokens', JSON.stringify(o)); };
// ルーム内でこの端末が持つ全トークン（名前の自動ずらし後でも再参加できるよう参加時に全て送る）
export const deviceTokensForRoom = (room) => {
  const o = readObj('mg_device_tokens'); const out = [];
  for (const [k, v] of Object.entries(o)) if (k.startsWith(room + '\u0000')) out.push(v);
  return out;
};

export const getSyncState = (room, player) => readObj('mg_sync_state')[slot(room, player)] || { version: null, baseHashes: null };
export const setSyncState = (room, player, st) => { const o = readObj('mg_sync_state'); o[slot(room, player)] = st; set('mg_sync_state', JSON.stringify(o)); };

export const getTombstones = () => { try { const a = JSON.parse(get('mg_deleted_ids') || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
export const setTombstones = (ids) => set('mg_deleted_ids', JSON.stringify(ids));

// 講師キー: { [roomId]: { teacherKey, pin } }
export const getTeacherInfo = (room) => readObj('mg_teacher_keys')[room] || null;
export const setTeacherInfo = (room, info) => { const o = readObj('mg_teacher_keys'); o[room] = info; set('mg_teacher_keys', JSON.stringify(o)); };
export const listTeacherRooms = () => Object.keys(readObj('mg_teacher_keys'));
