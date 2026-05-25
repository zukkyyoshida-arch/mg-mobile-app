import React, { useState, useEffect } from 'react';
import { subscribeToRoom, removePlayer, archiveRoom } from '../firebase';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function Dashboard() {
  const [roomId, setRoomId] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [playersData, setPlayersData] = useState({});
  const { width, height } = useWindowSize();

  // URLパラメーターからルームIDを自動取得（例: ?room=mg-test）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
      setIsSubscribed(true);
    }
  }, []);

  useEffect(() => {
    if (!isSubscribed || !roomId) return;
    
    const cleanRoom = roomId.trim();
    // Firebaseからのリアルタイム同期
    const unsubscribe = subscribeToRoom(cleanRoom, (data) => {
      setPlayersData(data || {});
    });

    return () => unsubscribe();
  }, [roomId, isSubscribed]);

  // プレイヤーデータを配列に変換し、自己資本（純資産）で降順ソート
  const sortedPlayers = Object.entries(playersData)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.totalNetAssets || 0) - (a.totalNetAssets || 0));

  if (!isSubscribed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0c10', color: 'white', padding: '20px' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '40px', color: 'var(--mg-blue)' }}>プロジェクター用ダッシュボード</h1>
        <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '1.2rem' }}>表示するルームIDを入力</label>
            <input 
              type="text" 
              className="form-input" 
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="例: mg-tokyo-01"
              style={{ fontSize: '1.5rem', padding: '16px', textAlign: 'center' }}
            />
          </div>
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', marginTop: '20px' }}
            onClick={() => setIsSubscribed(true)}
            disabled={!roomId}
          >
            モニタリング開始
          </button>
        </div>
      </div>
    );
  }

  const topPlayer = sortedPlayers.length > 0 ? sortedPlayers[0] : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0c10', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* 第5期でトッププレイヤーがいる場合は紙吹雪 */}
      {topPlayer && topPlayer.currentPeriod >= 5 && (
        <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />
      )}
      
      {/* ヘッダー */}
      <header style={{ padding: '20px 40px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '2.5rem' }}>📊</span> 戦略MG リアルタイム成績表
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            ルームID: <strong style={{ color: 'white' }}>{roomId}</strong>
          </span>
          <button 
            onClick={() => {
              if(window.confirm('現在の成績を「アーカイブ（過去の記録）」として永久保存しますか？')) {
                archiveRoom(roomId, sortedPlayers)
                  .then(() => alert('✅ 成績をアーカイブに保存しました！'))
                  .catch(e => alert('保存に失敗しました: ' + e.message));
              }
            }} 
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '1rem', background: 'var(--mg-pink)', border: 'none' }}
          >
            💾 成績を永久保存
          </button>
          <button 
            onClick={() => setIsSubscribed(false)} 
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '1rem' }}
          >
            ルーム変更
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {sortedPlayers.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📡</div>
            <h2 style={{ fontWeight: 'normal' }}>プレイヤーの接続を待機中...</h2>
            <p>参加者がアプリからログインし、操作を行うとここに表示されます。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* テーブルヘッダー */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '90px 1fr 70px 120px 120px 120px 80px 100px 120px 40px', 
              gap: '16px', 
              padding: '0 24px', 
              color: 'var(--text-secondary)', 
              fontSize: '1rem', 
              fontWeight: 'bold',
              borderBottom: '2px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
              marginBottom: '8px'
            }}>
              <div>順位</div>
              <div>プレイヤー名</div>
              <div style={{ textAlign: 'center' }}>期</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-blue)' }}>純資産(サ)</div>
              <div style={{ textAlign: 'right' }}>現金(ア)</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-yellow)' }}>売上(PQ)</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-yellow)' }}>販売数</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-yellow)' }}>平均単価</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-pink)' }}>利益(G)</div>
              <div style={{ textAlign: 'center' }}></div>
            </div>

            {/* ランキングリスト */}
            {sortedPlayers.map((player, index) => {
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
                  key={player.id} 
                  className="glass-card" 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '90px 1fr 70px 120px 120px 120px 80px 100px 120px', 
                    gap: '16px', 
                    alignItems: 'center', 
                    padding: '20px 24px', 
                    borderRadius: '16px',
                    border: isTop ? '2px solid rgba(255, 215, 0, 0.8)' : '1px solid rgba(255,255,255,0.05)',
                    background: isTop 
                      ? 'linear-gradient(90deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%)' 
                      : 'rgba(255, 255, 255, 0.03)',
                    boxShadow: isTop ? '0 8px 32px rgba(255, 215, 0, 0.15)' : 'none',
                    transform: isTop ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    zIndex: isTop ? 10 : 1
                  }}
                >
                  <div style={rankStyle}>{rankText}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: isTop ? '0 0 10px rgba(255,255,255,0.3)' : 'none' }}>
                    {player.id}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className="badge badge-pink" style={{ fontSize: '1rem', padding: '4px 8px' }}>
                      第{player.currentPeriod || 1}期
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.6rem', fontWeight: '900', color: 'var(--mg-blue)' }}>
                    {(player.totalNetAssets || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.4rem', fontFamily: 'monospace' }}>
                    {(player.cash || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.4rem', fontFamily: 'monospace', color: 'var(--mg-yellow)' }}>
                    {(player.sales || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.3rem', fontFamily: 'monospace', color: '#ffeb3b', opacity: 0.9 }}>
                    {player.salesQty || 0} 個
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.2rem', fontFamily: 'monospace', color: '#ffeb3b', opacity: 0.8 }}>
                    @{(player.averagePrice || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--mg-pink)' }}>
                    {(player.profit || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => {
                        if (window.confirm(`「${player.id}」を成績表から削除しますか？`)) {
                          removePlayer(roomId, player.id);
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#ff4444', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}
                      title="退出させる"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
