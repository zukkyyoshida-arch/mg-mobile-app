// localStorage の読み込み失敗・破損からデータを守るための純粋関数群。
// すべて storage（getItem/setItem/removeItem を持つオブジェクト）を引数で受け取るのでテスト可能。
// 方針: 読み込みに失敗しても空データで上書きしない／壊れた生データを退避する／直近3世代を回転保存する。

export const BACKUP_GENERATIONS = 3;

export const corruptKeyOf = (key, now = new Date()) => `mg_corrupt_${key}_${now.toISOString()}`;
export const backupKeyOf = (key, n) => `mg_backup_${key}_${n}`;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** 1期分のデータ構造が使える形かを検証する（足りない項目は normalizePeriods が補完する前提で、型だけ見る） */
export function validatePeriod(p) {
  if (!isObj(p)) return false;
  if ('ledger' in p && p.ledger !== undefined) {
    if (!Array.isArray(p.ledger)) return false;
    if (!p.ledger.every(isObj)) return false;
  }
  for (const k of ['carryover', 'actuals', 'budget']) {
    if (k in p && p[k] !== undefined && !isObj(p[k])) return false;
  }
  return true;
}

/**
 * 保存文字列を解析して期ごとに検証する。
 * 戻り値: { ok, periods, badPeriods: {no: rawValue}, error? }
 *  - ok=false: JSON不正 or 全体が期データのオブジェクトではない（全損）
 *  - ok=true: periods は正常な期のみ。壊れた期は badPeriods に隔離
 */
export function parsePeriodsText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, periods: null, badPeriods: {}, error: `JSON解析エラー: ${e.message}` };
  }
  if (!isObj(data)) return { ok: false, periods: null, badPeriods: {}, error: 'データ形式が不正です' };
  const periods = {};
  const badPeriods = {};
  for (const [no, p] of Object.entries(data)) {
    if (validatePeriod(p)) periods[no] = p;
    else badPeriods[no] = p;
  }
  if (Object.keys(periods).length === 0 && Object.keys(badPeriods).length > 0) {
    return { ok: false, periods: null, badPeriods: {}, error: 'すべての期のデータが不正です' };
  }
  return { ok: true, periods, badPeriods };
}

/** 容量超過などで書けないとき、古い世代のバックアップから消して再試行しながら setItem する */
export function setItemWithEviction(storage, key, value, baseKey = key) {
  const evictList = [];
  for (let n = BACKUP_GENERATIONS; n >= 1; n--) evictList.push(backupKeyOf(baseKey, n));
  for (let attempt = 0; attempt <= evictList.length; attempt++) {
    try {
      storage.setItem(key, value);
      return true;
    } catch (e) {
      if (attempt >= evictList.length) {
        console.error('[storage] 保存に失敗しました', key, e);
        return false;
      }
      try { storage.removeItem(evictList[attempt]); } catch { /* 続行 */ }
    }
  }
  return false;
}

/** 正常保存のたびに直近 BACKUP_GENERATIONS 世代を回転保存する（_1 が最新）。同一内容なら回転しない */
export function rotateBackups(storage, key, value) {
  try {
    if (storage.getItem(backupKeyOf(key, 1)) === value) return true;
  } catch { /* 続行 */ }
  for (let n = BACKUP_GENERATIONS; n >= 2; n--) {
    let prev = null;
    try { prev = storage.getItem(backupKeyOf(key, n - 1)); } catch { /* 続行 */ }
    if (prev !== null) {
      if (!setItemWithEviction(storage, backupKeyOf(key, n), prev, key)) return false;
    }
  }
  return setItemWithEviction(storage, backupKeyOf(key, 1), value, key);
}

/** 本体を保存し、成功したらバックアップを回転する。本体の保存失敗は false を返す（握りつぶさない） */
export function saveWithBackup(storage, key, value) {
  const ok = setItemWithEviction(storage, key, value, key);
  if (!ok) return { saved: false, backedUp: false };
  return { saved: true, backedUp: rotateBackups(storage, key, value) };
}

/** 新しい世代から順に、検証を通る最初のバックアップを返す */
export function findLatestValidBackup(storage, key) {
  for (let n = 1; n <= BACKUP_GENERATIONS; n++) {
    let text = null;
    try { text = storage.getItem(backupKeyOf(key, n)); } catch { /* 続行 */ }
    if (!text) continue;
    const parsed = parsePeriodsText(text);
    if (parsed.ok && Object.keys(parsed.badPeriods).length === 0) {
      return { generation: n, text, periods: parsed.periods };
    }
  }
  return null;
}

/**
 * 起動時の読み込み。上書きは一切しない（退避の書き込みのみ）。
 * 戻り値: { status: 'empty'|'ok'|'partial'|'corrupt', periods, issue }
 *  issue: { key, rawText, corruptKey, badPeriodNos, message, hasBackup, blocking }
 */
export function loadPeriodsSafely(storage, key = 'mg_periods_data', now = new Date()) {
  let text = null;
  try { text = storage.getItem(key); } catch { /* 読み取り不可は空扱い（上書きしないため issue 化はしない） */ }
  if (text === null || text === '') return { status: 'empty', periods: null, issue: null };

  const parsed = parsePeriodsText(text);
  if (parsed.ok && Object.keys(parsed.badPeriods).length === 0) {
    return { status: 'ok', periods: parsed.periods, issue: null };
  }

  const corruptKey = corruptKeyOf(key, now);
  const rawForQuarantine = parsed.ok ? JSON.stringify({ badPeriods: parsed.badPeriods }) : text;
  let quarantined = true;
  try { storage.setItem(corruptKey, rawForQuarantine); } catch { quarantined = false; }
  const hasBackup = !!findLatestValidBackup(storage, key);

  if (parsed.ok) {
    return {
      status: 'partial',
      periods: parsed.periods,
      issue: {
        key, rawText: rawForQuarantine, corruptKey, quarantined, hasBackup, blocking: false,
        badPeriodNos: Object.keys(parsed.badPeriods),
        message: `第${Object.keys(parsed.badPeriods).join('・')}期のデータが壊れていたため隔離しました。ほかの期は使えます。`
      }
    };
  }
  return {
    status: 'corrupt',
    periods: null,
    issue: {
      key, rawText: text, corruptKey, quarantined, hasBackup, blocking: true,
      badPeriodNos: [],
      message: parsed.error
    }
  };
}

/** 退避データのダウンロード用 Blob を作る（ブラウザ依存部分を分離） */
export function buildCorruptBlob(issue) {
  const body = JSON.stringify({ key: issue.key, savedAt: new Date().toISOString(), raw: issue.rawText }, null, 2);
  return new Blob([body], { type: 'application/json' });
}
