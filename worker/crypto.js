// 秘密値まわりのユーティリティ。秘密値はログに出さない・比較は定数時間。

const enc = new TextEncoder();

export const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

// 長さが同じ文字列同士を定数時間で比較する（ハッシュ16進同士の比較用）
export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// 平文の秘密値と保存済みハッシュを比較（まずハッシュ化して長さを揃える）
export async function verifySecret(plain, storedHash, salt = '') {
  if (typeof plain !== 'string' || plain.length === 0 || plain.length > 256) return false;
  const h = await sha256Hex(salt + plain);
  return timingSafeEqualStr(h, storedHash);
}

export function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 6桁の数字PIN（先頭0あり）。拒否サンプリングで偏りを避ける。
export function randomPin() {
  const arr = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  do { crypto.getRandomValues(arr); } while (arr[0] >= limit);
  return String(arr[0] % 1000000).padStart(6, '0');
}
