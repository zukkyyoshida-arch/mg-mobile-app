import { useState } from 'react';

const describe = (e) => {
  if (!e) return '(なし)';
  const parts = [];
  if (e.category) parts.push(String(e.category));
  if (e.quantity != null) parts.push(`${e.quantity}個`);
  if (e.amount != null) parts.push(`${Number(e.amount).toLocaleString()}`);
  if (e.timestamp) parts.push(new Date(e.timestamp).toLocaleTimeString('ja-JP'));
  return parts.join(' / ') || JSON.stringify(e).slice(0, 80);
};

// 同じ取引が別々の内容に変更されていたときだけ、どちらを残すかを選んでもらう
export default function MergeConflictModal({ conflicts, onResolve }) {
  const [choices, setChoices] = useState({});
  const keyOf = (c) => `${c.period}:${c.id}`;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', maxHeight: '86vh', overflowY: 'auto', padding: '20px', borderRadius: '16px' }}>
        <h3 style={{ marginTop: 0 }}>別の端末と内容が食い違っています</h3>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>同じ取引が両方で別の内容に変わっていました。残す方を選んでください。</p>
        {conflicts.map((c) => {
          const k = keyOf(c);
          const sel = choices[k] || 'local';
          return (
            <div key={k} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>第{c.period}期</div>
              {[['local', 'この端末', c.local], ['remote', 'サーバー', c.remote]].map(([v, label, entry]) => (
                <label key={v} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', fontSize: '0.88rem' }}>
                  <input type="radio" name={k} checked={sel === v} onChange={() => setChoices({ ...choices, [k]: v })} />
                  <span><strong>{label}</strong>：{describe(entry)}</span>
                </label>
              ))}
            </div>
          );
        })}
        <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => onResolve(choices)}>この内容で確定する</button>
      </div>
    </div>
  );
}
