/**
 * 数値入力の防御的サニタイズ（アプリ共通ヘルパー）。
 *
 * MGは全て整数（個・人・万円）前提の研修ツールのため、フォーム入力は
 * 「非有限（Infinity/NaN）は拒否して0・下限0・整数化（切り捨て）」で受ける。
 * 1e999 のような入力は Number() で Infinity になり、localStorage 保存時の
 * JSON.stringify で null 化 → リロード後に null 算術で黙って0円に化ける
 * （サイレント破壊）ため、state に入る前にここで確実に落とす。
 * 負数も一律 0 へクランプする（期首繰越の資本金・人数・在庫などはすべて0以上が前提）。
 *
 * 有限でも非常識に大きい値（1e13万 など）は MAX_AMOUNT へ上限クランプする。
 *
 * 本ファイルが正（単一の実装）。src/components/cashledger/buildTransactionEntries.js は
 * 本ファイルから MAX_AMOUNT / toSafeInt を re-export しているだけ
 * （tests/unit/inputSanitizers.test.js が両者の一致を検証してドリフトを防ぐ）。
 * 本ファイルは何も import しないこと（循環 import 防止）。
 */

// 入力値の上限（万円・個）。ゲーム内で到達し得ない大きさ（1e13万 など）の入力を
// この値へ丸める。9,999,999万円 ≒ 1000億円で、研修で扱う金額の数万倍の余裕がある。
export const MAX_AMOUNT = 9999999;

export function toSafeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_AMOUNT, Math.max(0, Math.floor(n)));
}
