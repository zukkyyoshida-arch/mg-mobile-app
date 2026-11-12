// 409（バージョン競合）時の自動マージ。すべて純粋関数。
// - ledger は取引IDで突き合わせる。片方にしか無いものは残す。
// - 削除は tombstone（deletedIds: 削除済みID配列）で表し、どちらかが削除していたら削除扱い。
// - 同じIDが両方で異なる内容のとき、baseHashes（前回同期時点の内容ハッシュ）で
//   「片方だけが変えた」なら変えた方を採る。両方が変えた（またはbase不明）ときだけ conflicts に出す。
// - ledger 以外の期データ（carryover / actuals / budget など）は項目ごとに新しい側（localTs/remoteTs）を採る。

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (isObj(v)) {
    return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

// 短い文字列ハッシュ（FNV-1a 32bit 2本）。base 比較専用で暗号用途ではない。
export function hashEntry(e) {
  const s = stableStringify(e);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(36) + h2.toString(36) + s.length.toString(36);
}

export const entryKey = (e) => (e && e.id != null ? String(e.id) : '__h:' + hashEntry(e));

// periods から { 取引ID: 内容ハッシュ } を作る（同期成功時の base として保存する）
export function buildBaseHashes(periods) {
  const out = {};
  for (const p of Object.values(periods || {})) {
    for (const e of p?.ledger || []) out[entryKey(e)] = hashEntry(e);
  }
  return out;
}

export function mergeLedger({ local = [], remote = [], deleted = new Set(), baseHashes = null }) {
  const conflicts = [];
  const remoteMap = new Map(remote.map((e) => [entryKey(e), e]));
  const localKeys = new Set();
  const result = [];

  for (const le of local) {
    const k = entryKey(le);
    localKeys.add(k);
    if (deleted.has(k)) continue;
    const re = remoteMap.get(k);
    if (!re) { result.push(le); continue; }
    const lh = hashEntry(le), rh = hashEntry(re);
    if (lh === rh) { result.push(le); continue; }
    const bh = baseHashes ? baseHashes[k] : undefined;
    if (bh !== undefined && bh === lh) result.push(re);        // 自分は未変更 → 相手の変更を採る
    else if (bh !== undefined && bh === rh) result.push(le);   // 相手は未変更 → 自分の変更を採る
    else { result.push(le); conflicts.push({ id: k, local: le, remote: re }); }
  }
  for (const re of remote) {
    const k = entryKey(re);
    if (localKeys.has(k) || deleted.has(k)) continue;
    result.push(re);
  }
  // 時刻が揃っているときだけ時系列に整える（安定ソート）
  if (result.every((e) => typeof e?.timestamp === 'string' && !Number.isNaN(Date.parse(e.timestamp)))) {
    result.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }
  return { ledger: result, conflicts };
}

function mergeFields(local, remote, preferRemote) {
  const out = {};
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const k of keys) {
    const inL = local && k in local, inR = remote && k in remote;
    if (inL && !inR) out[k] = local[k];
    else if (!inL && inR) out[k] = remote[k];
    else out[k] = stableStringify(local[k]) === stableStringify(remote[k]) ? local[k] : (preferRemote ? remote[k] : local[k]);
  }
  return out;
}

export function mergePeriods({ local, remote, localDeleted = [], remoteDeleted = [], baseHashes = null, localTs = 0, remoteTs = 0 }) {
  const deleted = new Set([...(localDeleted || []), ...(remoteDeleted || [])].map(String));
  const preferRemote = Number(remoteTs) > Number(localTs);
  const periods = {};
  const conflicts = [];
  const nos = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const no of nos) {
    const lp = local?.[no], rp = remote?.[no];
    if (!isObj(lp)) { periods[no] = rp ? { ...rp, ledger: (rp.ledger || []).filter((e) => !deleted.has(entryKey(e))) } : rp; continue; }
    if (!isObj(rp)) { periods[no] = { ...lp, ledger: (lp.ledger || []).filter((e) => !deleted.has(entryKey(e))) }; continue; }
    const m = mergeLedger({ local: lp.ledger || [], remote: rp.ledger || [], deleted, baseHashes });
    const merged = {};
    const keys = new Set([...Object.keys(lp), ...Object.keys(rp)]);
    for (const k of keys) {
      if (k === 'ledger') continue;
      if (isObj(lp[k]) && isObj(rp[k])) merged[k] = mergeFields(lp[k], rp[k], preferRemote);
      else if (!(k in rp)) merged[k] = lp[k];
      else if (!(k in lp)) merged[k] = rp[k];
      else merged[k] = stableStringify(lp[k]) === stableStringify(rp[k]) ? lp[k] : (preferRemote ? rp[k] : lp[k]);
    }
    merged.ledger = m.ledger;
    periods[no] = merged;
    for (const c of m.conflicts) conflicts.push({ period: no, ...c });
  }
  return { periods, deletedIds: [...deleted], conflicts };
}

// ユーザーが選んだ側（'local' | 'remote'）をマージ結果へ反映する。choices: { `${period}:${id}`: 'local'|'remote' }
export function applyConflictChoices(periods, conflicts, choices) {
  const out = { ...periods };
  for (const c of conflicts) {
    if ((choices || {})[`${c.period}:${c.id}`] !== 'remote') continue;
    const p = out[c.period];
    if (!p) continue;
    out[c.period] = { ...p, ledger: p.ledger.map((e) => (entryKey(e) === c.id ? c.remote : e)) };
  }
  return out;
}

// 前後のスナップショットから「消えた取引ID」を tombstone に加える。生きているIDは tombstone から外す。
export function updateTombstones(prevPeriods, nextPeriods, tombstones = [], cap = 3000) {
  const live = new Set();
  for (const p of Object.values(nextPeriods || {})) for (const e of p?.ledger || []) live.add(entryKey(e));
  const set = new Set(tombstones.filter((id) => !live.has(id)));
  for (const p of Object.values(prevPeriods || {})) {
    for (const e of p?.ledger || []) {
      const k = entryKey(e);
      if (!live.has(k)) set.add(k);
    }
  }
  return [...set].slice(-cap);
}
