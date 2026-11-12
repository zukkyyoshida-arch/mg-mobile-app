import { AlertTriangle } from 'lucide-react';

// 保存データの読み込み失敗を知らせ、復元・退避保存・初期化を選べるバナー
export default function StorageRecoveryBanner({ issue, onRestore, onDownload, onReset, onDismiss }) {
  if (!issue) return null;
  const btn = {
    minHeight: '44px', padding: '8px 14px', fontSize: '0.875rem', fontWeight: 600,
    borderRadius: '8px', border: '1px solid var(--border-card)', cursor: 'pointer',
    background: 'var(--bg-card)', color: 'var(--text-primary)'
  };
  return (
    <div
      role="alert"
      style={{
        position: 'sticky', top: 0, zIndex: 1000, padding: '12px 16px',
        background: 'var(--surface-warning)', borderBottom: '2px solid var(--mg-yellow)',
        color: 'var(--text-primary)'
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          <strong style={{ fontSize: '1rem' }}>保存データを読み込めませんでした</strong>
          <div>{issue.message}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            壊れたデータは別の場所に退避済みです。選ぶまで上書きしません。
            {!issue.hasBackup && '（予備のスナップショットはありません）'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <button type="button" style={btn} onClick={onRestore} disabled={!issue.hasBackup}>予備から復元</button>
        <button type="button" style={btn} onClick={onDownload}>退避データを保存</button>
        <button type="button" style={{ ...btn, color: 'var(--mg-pink)' }} onClick={onReset}>初期化して始める</button>
        {!issue.blocking && <button type="button" style={btn} onClick={onDismiss}>このまま使う</button>}
      </div>
    </div>
  );
}
