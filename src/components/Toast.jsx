// 汎用トースト（画面下部に短時間だけ出る通知）。
//
// alert() は画面を止めて OK を押させるため、連続入力のテンポを崩す。
// 結果のお知らせ（「#3 を削除しました［元に戻す］」「利息を自動計上しました」など）は
// このトーストで出し、操作を止めない。
//
// 使い方:
//   const [toast, setToast] = useState(null);
//   setToast({ id: Date.now(), message: '…', actionLabel: '元に戻す', onAction: () => {…} });
//   {toast && <Toast key={toast.id} {...toast} onClose={() => setToast(null)} />}
//
// props:
//   message     … 表示する文言（改行可）
//   actionLabel … 右側のボタンの文言（省略するとボタンなし）
//   onAction    … ボタンを押したときの処理（押すとトーストは閉じる）
//   duration    … 自動で閉じるまでのミリ秒（既定 5000。0 以下なら自動で閉じない）
//   onClose     … 閉じたとき（自動・× ・アクション後）に呼ばれる
//   tone        … 'info'（既定） | 'error'
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

function Toast({ message, actionLabel, onAction, duration = 5000, onClose, tone = 'info' }) {
  // onClose を ref に退避し、親の再描画で関数が変わってもタイマーを張り直さない
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!(duration > 0)) return undefined;
    const timer = setTimeout(() => onCloseRef.current?.(), duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  if (!message) return null;

  // アプリ枠（.phone-shell）の中に出す。PC表示では枠が画面中央に浮いているため、
  // 画面基準（fixed）だと枠の外に出てしまう。枠が見つからなければ body に出す。
  const host = (typeof document !== 'undefined' && (document.querySelector('.phone-shell') || document.body)) || null;

  const node = (
    <div
      className={`app-toast${tone === 'error' ? ' app-toast--error' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <span className="app-toast__message">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          className="app-toast__action"
          onClick={() => { onAction(); onCloseRef.current?.(); }}
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        className="app-toast__close"
        aria-label="通知を閉じる"
        onClick={() => onCloseRef.current?.()}
      >
        ×
      </button>
    </div>
  );

  return host ? createPortal(node, host) : node;
}

export default Toast;
