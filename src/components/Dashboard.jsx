/* eslint-disable react-refresh/only-export-components */
// 上記ルールを無効化する理由:
// 集計ロジック（computeOverallPlayer / getPeriodData）を純粋関数として
// ユニットテストから直接 import できるよう、あえてコンポーネントと
// 同一ファイルから export している。Fast Refresh の対象外になるだけで動作に影響しない。
import { useState, useEffect } from 'react';
import { subscribeToRoom, archiveRoom } from '../pocketbase';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { useNavigate } from 'react-router-dom';
import { TOTAL_PERIODS } from '../utils/constants';

// ヘルパー: 配列・オブジェクト両対応で指定期のデータを取り出す
export function getPeriodData(player, periodNum) {
  if (!player || !player.periods) return null;
  
  if (Array.isArray(player.periods)) {
    // 6要素の配列（[null, 1期, 2期, ...]）の場合
    if (player.periods.length === 6) {
      return player.periods[periodNum] || null;
    }
    // 5要素の配列（[1期, 2期, ...]）の場合
    if (player.periods.length === 5) {
      return player.periods[periodNum - 1] || null;
    }
    // その他
    if (player.periods.length > periodNum && player.periods[periodNum] !== null && player.periods[periodNum] !== undefined) {
      return player.periods[periodNum];
    }
    if (player.periods.length > (periodNum - 1) && (periodNum - 1) >= 0) {
      return player.periods[periodNum - 1] || null;
    }
    return null;
  }
  
  // オブジェクト（マップ）の場合
  return player.periods[periodNum] || player.periods[periodNum.toString()] || null;
}

// 総合(overall)基準でプレイヤー1名分の集計値を算出する純粋関数（タブ選択非依存）。
// 第1期〜第TOTAL_PERIODS(20)期を合算する（以前は1〜5期ハードコードで、
// 第6期以降のプレイヤーは純資産が5期末値で凍結・売上/利益が欠落していた）。
export function computeOverallPlayer(player) {
  let sales = 0, profit = 0, salesQty = 0;
  let latestNetAssets = 0;
  if (player.periods) {
    for (let p = 1; p <= TOTAL_PERIODS; p++) {
      const pData = getPeriodData(player, p);
      if (pData) {
        sales += (pData.sales || 0);
        profit += (pData.profit || 0);
        salesQty += (pData.salesQty || 0);
        if (p <= player.currentPeriod) {
          latestNetAssets = pData.totalNetAssets || 0;
        }
      }
    }
  } else {
    sales = player.sales || 0;
    profit = player.profit || 0;
    salesQty = player.salesQty || 0;
    latestNetAssets = player.totalNetAssets || 0;
  }
  return {
    ...player,
    displayPeriod: '総合',
    totalNetAssets: latestNetAssets,
    sales,
    profit,
    salesQty,
    averagePrice: salesQty > 0 ? Math.round(sales / salesQty) : 0
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  // localStorageから前回の状態を復元
  const [roomId, setRoomId] = useState(() => {
    try { return localStorage.getItem('dashboard_room_id') || ''; } catch (e) { return ''; }
  });
  const [isSubscribed, setIsSubscribed] = useState(() => {
    try { return localStorage.getItem('dashboard_is_subscribed') === 'true'; } catch (e) { return false; }
  });
  const [selectedTab, setSelectedTab] = useState('overall');
  const [playersData, setPlayersData] = useState({});
  const { width, height } = useWindowSize();

  // 状態が変わるたびにlocalStorageに保存
  useEffect(() => {
    try { localStorage.setItem('dashboard_room_id', roomId); } catch (e) {}
  }, [roomId]);

  useEffect(() => {
    try { localStorage.setItem('dashboard_is_subscribed', isSubscribed); } catch (e) {}
  }, [isSubscribed]);

  useEffect(() => {
    if (!isSubscribed || !roomId) return;
    
    const cleanRoom = roomId.trim();
    // Firebaseからのリアルタイム同期
    const unsubscribe = subscribeToRoom(cleanRoom, (data) => {
      setPlayersData(data || {});
    });

    return () => unsubscribe();
  }, [roomId, isSubscribed]);

  // 総合(overall)基準でソート済みプレイヤーリストを算出する（アーカイブ保存専用、selectedTabに非依存）
  const getOverallPlayers = () => {
    const rawPlayers = Object.entries(playersData).map(([id, data]) => ({ id, ...data }));
    return rawPlayers
      .map(computeOverallPlayer)
      .sort((a, b) => (b.totalNetAssets || 0) - (a.totalNetAssets || 0));
  };

  // タブに応じたプレイヤーデータの生成
  const getProcessedPlayers = () => {
    const rawPlayers = Object.entries(playersData).map(([id, data]) => ({ id, ...data }));
    console.log(`[Dashboard] tab=${selectedTab}, rawPlayers:`, rawPlayers);

    return rawPlayers.map(player => {
      if (selectedTab === 'overall') {
        return computeOverallPlayer(player);
      } else {
        const periodNum = parseInt(selectedTab);
        if (player.currentPeriod >= periodNum) {
          const pData = getPeriodData(player, periodNum);
          const useFallback = !pData && (player.currentPeriod === periodNum);

          return {
            ...player,
            displayPeriod: periodNum,
            totalNetAssets: pData?.totalNetAssets ?? (useFallback ? (player.totalNetAssets || 0) : (periodNum === 1 ? 300 : 0)),
            sales: pData?.sales ?? (useFallback ? (player.sales || 0) : 0),
            profit: pData?.profit ?? (useFallback ? (player.profit || 0) : 0),
            salesQty: pData?.salesQty ?? (useFallback ? (player.salesQty || 0) : 0),
            averagePrice: pData?.averagePrice ?? (useFallback ? (player.averagePrice || 0) : 0)
          };
        } else {
          return null; // この期にまだ到達していない
        }
      }
    }).filter(p => p !== null).sort((a, b) => (b.totalNetAssets || 0) - (a.totalNetAssets || 0));
  };

  const sortedPlayers = getProcessedPlayers();

  // 期タブ: 第1〜5期は常に表示し、プレイヤーが第6期以降へ進んだら到達期まで自動で増やす
  const maxReachedPeriod = Math.min(
    TOTAL_PERIODS,
    Math.max(5, ...Object.values(playersData).map(p => Number(p?.currentPeriod) || 1))
  );
  const periodTabs = Array.from({ length: maxReachedPeriod }, (_, i) => String(i + 1));

  if (!isSubscribed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '20px' }}>
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
          <button 
            onClick={() => navigate('/')}
            className="btn-secondary"
            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', marginTop: '12px' }}
          >
            🎮 ゲームアプリ画面に戻る
          </button>
        </div>
      </div>
    );
  }

  const topPlayer = sortedPlayers.length > 0 ? sortedPlayers[0] : null;

  return (
    <div style={{ minHeight: '100vh', width: '100%', minWidth: 0, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* 第5期でトッププレイヤーがいる場合は紙吹雪 */}
      {topPlayer && topPlayer.currentPeriod >= 5 && (
        <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />
      )}

      {/* ヘッダー（スマホ幅でも操作できるよう折り返し・可変パディングにする） */}
      <header style={{ padding: '16px clamp(12px, 4vw, 40px)', background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)', borderBottom: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.25rem, 3.5vw, 2rem)', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <span style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)' }}>📊</span> 戦略MG リアルタイム成績表
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/')} 
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '1rem', background: 'var(--mg-blue)', border: 'none' }}
          >
            🎮 ゲームアプリ画面に戻る
          </button>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border-glass)', borderRadius: '999px' }}>
              ルームID: <strong style={{ color: 'var(--text-primary)' }}>{roomId}</strong>
            </span>
          <button
            onClick={() => {
              const overallPlayers = getOverallPlayers();
              if(window.confirm(`${overallPlayers.length}名の総合成績を保存します。よろしいですか？`)) {
                archiveRoom(roomId, overallPlayers)
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
            onClick={() => navigate('/archives')} 
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '1rem', background: '#ffffff', border: '1px solid #e5e7eb', color: 'var(--text-primary)' }}
          >
            🏆 歴代ランキングを見る
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
      <main style={{ flex: 1, padding: 'clamp(12px, 3vw, 40px)', overflowY: 'auto' }}>
        {sortedPlayers.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📡</div>
            <h2 style={{ fontWeight: 'normal' }}>プレイヤーの接続を待機中...</h2>
            <p>参加者がアプリからログインし、操作を行うとここに表示されます。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* タブUI（期数が増えても・狭い画面でも折り返して全タブへ到達できる） */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {[...periodTabs, 'overall'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedTab === tab ? 'var(--mg-blue)' : 'var(--surface-subtle)',
                    color: selectedTab === tab ? '#fff' : 'var(--text-secondary)',
                    border: selectedTab === tab ? '1px solid var(--mg-blue)' : '1px solid var(--border-glass)',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab === 'overall' ? '総合' : `第${tab}期`}
                </button>
              ))}
            </div>

            {/* ランキング表: グリッドの最小幅が広い（約850px）ため、
                スマホ幅ではこのコンテナ内で横スクロールして全列に到達できるようにする */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: '880px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* テーブルヘッダー */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 70px 120px 120px 80px 100px 120px',
              gap: '16px',
              padding: '0 24px',
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 'bold',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '12px',
              marginBottom: '8px'
            }}>
              <div>順位</div>
              <div>プレイヤー名</div>
              <div style={{ textAlign: 'center' }}>期</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-blue)' }}>純資産(サ)</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-blue)' }}>売上(PQ)</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>販売数</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>平均単価</div>
              <div style={{ textAlign: 'right', color: 'var(--mg-pink)' }}>利益(G)</div>
            </div>

            {/* ランキングリスト */}
            {sortedPlayers.map((player, index) => {
              const isTop = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;
              
              let rankStyle = { fontSize: '1.2rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
              let rankText = `${index + 1}位`;
              
              if (isTop) {
                rankStyle = { fontSize: '1.8rem', fontWeight: 'bold', color: '#D97706', whiteSpace: 'nowrap' };
                rankText = '👑 1位';
              } else if (isSecond) {
                rankStyle = { fontSize: '1.5rem', fontWeight: 'bold', color: '#6B7280', whiteSpace: 'nowrap' };
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
                    gridTemplateColumns: '90px 1fr 70px 120px 120px 80px 100px 120px',
                    gap: '16px',
                    alignItems: 'center', 
                    padding: '20px 24px', 
                    borderRadius: '16px',
                    border: isTop ? '2px solid rgba(245, 158, 11, 0.45)' : '1px solid #e5e7eb',
                    background: isTop 
                      ? '#fffbeb'
                      : '#ffffff',
                    boxShadow: isTop ? '0 8px 24px rgba(245, 158, 11, 0.12)' : 'none',
                    transform: isTop ? 'scale(1.01)' : 'scale(1)',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    zIndex: isTop ? 10 : 1
                  }}
                >
                  <div style={rankStyle}>{rankText}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player.id}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className="badge badge-pink" style={{ fontSize: '1rem', padding: '4px 8px' }}>
                      {player.displayPeriod === '総合' ? '総合' : `第${player.displayPeriod}期`}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.6rem', fontWeight: '900', color: 'var(--mg-blue)' }}>
                    {(player.totalNetAssets || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.4rem', fontFamily: 'monospace', color: 'var(--mg-blue)' }}>
                    {(player.sales || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.3rem', fontFamily: 'monospace', color: 'var(--text-primary)', opacity: 0.9 }}>
                    {player.salesQty || 0} 個
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.2rem', fontFamily: 'monospace', color: 'var(--text-secondary)', opacity: 0.9 }}>
                    @{(player.averagePrice || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--mg-pink)' }}>
                    {(player.profit || 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
