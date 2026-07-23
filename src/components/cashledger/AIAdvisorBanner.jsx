// 💡 AIアドバイザー（リアルタイム警告バナー）
// 元 CashLedger.jsx の該当 JSX をそのまま切り出したプレゼンテーショナルコンポーネント。
// actionableWarnings（danger/warning のみ）が空、または closed のときは呼び出し側で描画しない。
function AIAdvisorBanner({ actionableWarnings, onClose }) {
  return (
    <div
      style={{
        margin: '8px 16px',
        padding: '12px 14px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(255, 152, 0, 0.12) 100%)',
        border: '1px solid rgba(255, 193, 7, 0.4)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#ffb300', display: 'flex', alignItems: 'center', gap: '6px' }}>
          💡 AIアドバイザー
          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)' }}>({actionableWarnings.length}件)</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="AIアドバイザーを閉じる"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, cursor: 'pointer', padding: '2px 6px' }}
        >
          ×
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {actionableWarnings.map((w, i) => {
          const isDanger = w.type === 'danger';
          const accent = isDanger ? '#ef4444' : '#ffb300';
          return (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                fontSize: '0.78rem',
                lineHeight: '1.45',
                color: 'var(--text-secondary)',
                background: 'rgba(0,0,0,0.03)',
                borderLeft: `3px solid ${accent}`,
                borderRadius: '6px',
                padding: '8px 10px'
              }}
            >
              <span style={{ flexShrink: 0 }}>{isDanger ? '🚨' : '⚠️'}</span>
              <span>{w.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AIAdvisorBanner;
