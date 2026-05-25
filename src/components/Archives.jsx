import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function Archives() {
  const navigate = useNavigate();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const { width, height } = useWindowSize();

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        const q = query(collection(db, "archives"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setArchives(data);
      } catch (error) {
        console.error("Failed to fetch archives:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchArchives();
  }, []);

  // 歴代全プレイヤーのデータを抽出し、純資産でソート
  const allTimePlayers = archives
    .flatMap(archive => 
      (archive.players || []).map(player => ({
        ...player,
        roomName: archive.roomId,
        date: new Date(archive.timestamp).toLocaleDateString('ja-JP')
      }))
    )
    .sort((a, b) => (b.totalNetAssets || 0) - (a.totalNetAssets || 0))
    .slice(0, 10); // トップ10のみ取得

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0c10', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <header style={{ padding: '20px 40px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '2.5rem' }}>🏆</span> 歴代ランキング＆過去の記録
        </h1>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '1rem' }}
        >
          ◀ ダッシュボードに戻る
        </button>
      </header>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', fontSize: '1.5rem', color: 'var(--text-secondary)' }}>データを読み込み中...</div>
        ) : (
          <>
            {/* 殿堂入り（Hall of Fame）セクション */}
            <section>
              <h2 style={{ fontSize: '2rem', color: '#FFD700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                👑 歴代 純資産トップ10 (Hall of Fame)
              </h2>
              {allTimePlayers.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>まだ記録がありません。</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '90px 1fr 120px 120px 120px 80px 120px', 
                    gap: '16px', 
                    padding: '0 24px', 
                    color: 'var(--text-secondary)', 
                    fontSize: '1rem', 
                    fontWeight: 'bold',
                    borderBottom: '2px solid rgba(255,255,255,0.1)',
                    paddingBottom: '12px',
                    marginBottom: '8px'
                  }}>
                    <div>歴代順位</div>
                    <div>プレイヤー名</div>
                    <div style={{ textAlign: 'center' }}>ルーム/日付</div>
                    <div style={{ textAlign: 'right', color: 'var(--mg-blue)' }}>純資産(サ)</div>
                    <div style={{ textAlign: 'right' }}>現金(ア)</div>
                    <div style={{ textAlign: 'right', color: 'var(--mg-yellow)' }}>販売数</div>
                    <div style={{ textAlign: 'right', color: 'var(--mg-pink)' }}>利益(G)</div>
                  </div>

                  {allTimePlayers.map((player, index) => {
                    const isTop = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;
                    
                    let rankStyle = { fontSize: '1.2rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
                    let rankText = `${index + 1}位`;
                    
                    if (isTop) {
                      rankStyle = { fontSize: '1.8rem', fontWeight: 'bold', color: '#FFD700', textShadow: '0 0 15px rgba(255, 215, 0, 0.8)', whiteSpace: 'nowrap' };
                      rankText = '👑 1位';
                    } else if (isSecond) {
                      rankStyle = { fontSize: '1.5rem', fontWeight: 'bold', color: '#C0C0C0', textShadow: '0 0 10px rgba(192, 192, 192, 0.5)', whiteSpace: 'nowrap' };
                      rankText = '🥈 2位';
                    } else if (isThird) {
                      rankStyle = { fontSize: '1.3rem', fontWeight: 'bold', color: '#CD7F32', whiteSpace: 'nowrap' };
                      rankText = '🥉 3位';
                    }

                    return (
                      <div 
                        key={index} 
                        className="glass-card" 
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '90px 1fr 120px 120px 120px 80px 120px', 
                          gap: '16px', 
                          alignItems: 'center', 
                          padding: '16px 24px', 
                          borderRadius: '12px',
                          border: isTop ? '2px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                          background: isTop ? 'rgba(255,215,0,0.1)' : 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <div style={rankStyle}>{rankText}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {player.id}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          <div>{player.roomName}</div>
                          <div>{player.date}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '1.5rem', fontWeight: '900', color: 'var(--mg-blue)' }}>
                          {(player.totalNetAssets || 0).toLocaleString()}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '1.2rem', fontFamily: 'monospace' }}>
                          {(player.cash || 0).toLocaleString()}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '1.2rem', fontFamily: 'monospace', color: 'var(--mg-yellow)' }}>
                          {player.salesQty || 0} 個
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--mg-pink)' }}>
                          {(player.profit || 0).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 過去の記録一覧セクション */}
            <section>
              <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                📁 過去の研修記録一覧
              </h2>
              {archives.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>保存されたアーカイブはありません。</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {archives.map((archive) => (
                    <div key={archive.id} className="glass-card" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--mg-blue)' }}>{archive.roomId}</h3>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>
                        保存日時: {new Date(archive.timestamp).toLocaleString('ja-JP')}
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                        <div style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#ccc' }}>トップ3プレイヤー:</div>
                        {([...(archive.players || [])]
                          .sort((a, b) => (b.totalNetAssets || 0) - (a.totalNetAssets || 0))
                          .slice(0, 3)
                          .map((p, i) => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                              <span>{i + 1}位: {p.id}</span>
                              <span style={{ color: 'var(--mg-blue)', fontWeight: 'bold' }}>{(p.totalNetAssets || 0).toLocaleString()}</span>
                            </div>
                          ))
                        )}
                        {archive.players && archive.players.length > 3 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '4px' }}>
                            ...他 {archive.players.length - 3} 名
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
