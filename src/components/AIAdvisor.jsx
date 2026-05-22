import { useState } from 'react';
import { useAI } from '../hooks/useAI';

export default function AIAdvisor({ results, currentPeriod }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { warnings, report, generateReport } = useAI(results, currentPeriod);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '30px',
          background: 'linear-gradient(135deg, #00C6FF, #0072FF)',
          color: 'white',
          border: 'none',
          boxShadow: '0 8px 16px rgba(0, 114, 255, 0.4)',
          fontSize: '1.5rem',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        💡
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '380px',
      height: '600px',
      maxHeight: '80vh',
      backgroundColor: 'var(--bg-card)',
      borderRadius: '16px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(0, 198, 255, 0.1), rgba(0, 114, 255, 0.1))',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>💡</span>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>AI経営診断ダッシュボード</h3>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
        >
          ×
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* リアルタイムアラートセクション */}
        <section>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🔴 リアルタイム監視</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warnings.map((w, index) => {
              let bg = 'rgba(255,255,255,0.05)';
              let border = 'rgba(255,255,255,0.1)';
              let icon = 'ℹ️';
              
              if (w.type === 'danger') {
                bg = 'rgba(255, 82, 82, 0.1)';
                border = '#ff5252';
                icon = '🚨';
              } else if (w.type === 'warning') {
                bg = 'rgba(255, 193, 7, 0.1)';
                border = '#ffc107';
                icon = '⚠️';
              } else if (w.type === 'success') {
                bg = 'rgba(76, 175, 80, 0.1)';
                border = '#4caf50';
                icon = '✅';
              }

              return (
                <div key={index} style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: bg,
                  borderLeft: `4px solid ${border}`,
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '1rem' }}>{icon}</span>
                  <div>{w.message}</div>
                </div>
              );
            })}
          </div>
        </section>

{/* 市場単価上限表示 */}
<section style={{ marginTop: '12px' }}>
  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🌐 市場単価上限</h4>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
    {Object.entries({ 札幌: 40, 仙台: 36, 東京: 32, 名古屋: 28, 大阪: 24, 福岡: 20 }).map(([city, cap]) => (
      <span key={city} style={{
        background: 'rgba(0,198,255,0.15)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        {city}: {cap} 万円
      </span>
    ))}
  </div>
</section>

        {/* 決算レポートセクション */}
        <section style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📊 第{currentPeriod}期 決算レポート出力</h4>
          {!report ? (
            <button 
              onClick={generateReport}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--mg-green)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
            >
              今期の決算を分析する
            </button>
          ) : (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {report}
              <button 
                onClick={generateReport}
                style={{ width: '100%', marginTop: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                再分析する
              </button>
            </div>
          )}
        </section>
        
      </div>
    </div>
  );
}
