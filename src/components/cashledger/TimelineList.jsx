// 取引履歴タイムライン表示
// 元 CashLedger.jsx の「取引履歴タイムライン」ブロックをそのまま切り出したもの。
// visibleLedger（期首処理マーカーを除いた ledger）と削除ハンドラ、期首現金を props で受け取る。
import { CATEGORIES } from './constants';

function TimelineList({ visibleLedger, carryoverCash, onDelete, onRedo }) {
  return (
    // 下余白: 右下の＋ボタン（56px＋下16px）と少しの余白＋セーフエリア分を空け、
    // 最後のカードの操作ボタンが＋ボタンに隠れないようにする
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(56px + 16px + 24px + var(--safe-area-bottom, 0px))' }}>
      <h3 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-secondary)', margin: '16px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        取引履歴タイムライン
        <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
          期首現金: ¥{carryoverCash}万
        </span>
      </h3>

      {visibleLedger.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', opacity: 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          取引データがありません。<br />
          右下の「＋」ボタンから最初の出納データを入力してください。
        </div>
      ) : (
        [...visibleLedger].reverse().map((entry) => {
          const catMeta = CATEGORIES[entry.category] || { label: '未定義', color: 'pink', shortName: '不明', actionName: '不明' };
          const badgeClass = `badge badge-${catMeta.color}`;
          const iconText = entry.customShortName || catMeta.shortName || entry.category;
          const labelText = entry.customName || catMeta.actionName || catMeta.label;

          const amountText = `${catMeta.type === 'inflow' ? '+' : '-'} ¥${Number.isFinite(Number(entry.amount)) ? Number(entry.amount).toLocaleString() : '—'} 万`;

          return (
            <div key={entry.id} className="glass-card" style={{ margin: '8px 16px', padding: '12px 12px 8px 16px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: `4px solid var(--mg-${catMeta.color})` }}>
              {/* 上段: バッジ・項目名・伝票番号（左, 縮む） / 金額（右上, 折り返さない） */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className={badgeClass} style={{ minWidth: '40px', padding: '0 6px', height: '32px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                  {iconText}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '6px', minWidth: 0, flex: '1 1 auto' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: '700', overflowWrap: 'anywhere' }}>{labelText}</span>
                  {/* 採番前の旧データは裸の「#」を出さない（番号がある取引だけ表示） */}
                  {entry.voucherNo != null && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>#{entry.voucherNo}</span>
                  )}
                </div>
                <span className="electric-number" style={{ fontSize: '1.05rem', fontWeight: '700', whiteSpace: 'nowrap', flex: '0 0 auto', color: catMeta.type === 'inflow' ? 'var(--mg-pink)' : 'var(--text-primary)' }}>
                  {/* amount の null/非数値耐性: 過去の不具合で Infinity が JSON化→null で
                      保存された端末の localStorage を読んでも白画面にしない（復旧経路） */}
                  {amountText}
                </span>
              </div>

              {/* 下段: 明細（全幅） / 操作ボタン（右） */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  {["コ", "サ", "ツ", "ノ", "ケ"].includes(entry.category) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {/* 材料購入(ツ/ノ)・機械購入(ケ) は複数市場・複数機種を1件に合算するため
                          単価が一意に決まらず price は 0 で保存される。
                          そこに「単価 ¥0万」と出すと受講者が検算できなくなるので、
                          単価が取れないときは数量だけを示す（平均単価の捏造はしない）。 */}
                      数量: {entry.quantity} 個
                      {Number(entry.price) > 0 && ` × 単価 ¥${entry.price} 万`}
                </div>
              )}
              {["キ", "ネ"].includes(entry.category) && entry.salesDetails && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column' }}>
                  {Object.values(entry.salesDetails).map((detail, i) => (
                    <span key={i}>{detail.name}: {detail.qty}個 × @¥{detail.price}万</span>
                  ))}
                </div>
              )}
              {["キ", "ネ"].includes(entry.category) && !entry.salesDetails && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  数量: {entry.quantity} 個
                </div>
              )}
              {entry.category === "採用" && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  ワーカー: {entry.workersHired}名 / セールスマン: {entry.salesmenHired}名
                </div>
              )}
                </div>
                {/* 「入力し直す」「削除」は誤タップが致命傷になるため、
                    タップ領域を44×44pxに確保し、2つのボタンの間を16px空ける（Apple HIG / WCAG 2.5.8）。 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '0 0 auto' }}>
                    {onRedo && (
                      <button
                        onClick={() => onRedo(entry.id)}
                        title="入力し直す"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          opacity: 0.75,
                          cursor: 'pointer',
                          padding: 0,
                          minWidth: '44px',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: '0 0 auto'
                        }}
                        aria-label={`${labelText} を入力し直す`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(entry.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        opacity: 0.4,
                        cursor: 'pointer',
                        padding: 0,
                        minWidth: '44px',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: '0 0 auto'
                      }}
                      aria-label={`${labelText} を削除する`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default TimelineList;
