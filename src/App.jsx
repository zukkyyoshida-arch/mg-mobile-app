import React, { useState, useEffect, useRef } from 'react';
import { calculateFinancials, DEFAULT_PERIOD_DATA } from './utils/calculations';
import CashLedger from './components/CashLedger';
import FinancialStatements from './components/FinancialStatements';
import PeriodEndWizard from './components/PeriodEndWizard';
import ManagementPlan from './components/ManagementPlan';
import PriorPeriodCarryover from './components/PriorPeriodCarryover';
import PerformanceReport from './components/PerformanceReport';
import ErrorBoundary from './components/ErrorBoundary';
import { syncPlayerData, removePlayer } from './firebase';
import { useDebounce } from 'react-use';
import { useNavigate } from 'react-router-dom';

// 安全な localStorage ラッパー
const safeStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
};

function App() {
  // テーマの状態 (ダーク / ライト)
  const [theme, setTheme] = useState(() => {
    const saved = safeStorage.getItem('mg_theme');
    return saved || 'dark';
  });

  // 成績表表示の状態
  const [showPerformanceReport, setShowPerformanceReport] = useState(false);

  // 全期 (1期〜5期) のデータ管理
  const [periods, setPeriods] = useState(() => {
    const saved = safeStorage.getItem('mg_periods_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse periods data", e);
      }
    }
    // 初期データ (1期〜20期)
    const initialData = {};
    for (let i = 1; i <= 20; i++) {
      initialData[i] = JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));
    }
    return initialData;
  });

  // 現在の期 (1〜5)
  const [currentPeriod, setCurrentPeriod] = useState(() => {
    const saved = safeStorage.getItem('mg_current_period');
    return saved ? Number(saved) : 1;
  });

  // アクティブなタブ (ledger, statements, periodEnd, plan, settings)
  const [activeTab, setActiveTab] = useState('ledger');

  // 取引モード ('cash' or 'credit')
  const [transactionMode, setTransactionMode] = useState(() => {
    return safeStorage.getItem('mg_transaction_mode') || 'cash';
  });

  // Firebase Room/Player ID
  const [roomId, setRoomId] = useState(() => safeStorage.getItem('mg_room_id') || '');
  const [playerId, setPlayerId] = useState(() => safeStorage.getItem('mg_player_id') || '');
  
  // オフラインモード（同期なし）フラグ
  const [isOffline, setIsOffline] = useState(() => safeStorage.getItem('mg_offline_mode') === 'true');

  const [showLogin, setShowLogin] = useState(() => {
    if (safeStorage.getItem('mg_offline_mode') === 'true') return false;
    return !safeStorage.getItem('mg_room_id') || !safeStorage.getItem('mg_player_id');
  });
  
  const [loginInput, setLoginInput] = useState({ room: safeStorage.getItem('mg_room_id') || '', player: safeStorage.getItem('mg_player_id') || '' });

  const navigate = useNavigate();

  // 同期ステータス表示用
  const [syncStatus, setSyncStatus] = useState(isOffline ? 'オフライン' : '未同期');

  // データ変更時に localStorage に保存
  useEffect(() => {
    safeStorage.setItem('mg_periods_data', JSON.stringify(periods));
  }, [periods]);

  useEffect(() => {
    safeStorage.setItem('mg_current_period', String(currentPeriod));
  }, [currentPeriod]);

  useEffect(() => {
    safeStorage.setItem('mg_transaction_mode', transactionMode);
  }, [transactionMode]);

  // テーマ切り替え処理
  useEffect(() => {
    // Apply theme via data-theme attribute on <html>
    document.documentElement.dataset.theme = theme;
    safeStorage.setItem('mg_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 現在の期のデータを取得
  const currentData = periods[currentPeriod] || JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));

  // リアルタイム財務計算を実行
  const results = calculateFinancials(currentData.carryover, currentData.ledger, currentData.actuals, currentPeriod);

  // 初回接続時（またはリロード時）に即座に同期してダッシュボードに表示させる
  useEffect(() => {
    if (roomId && playerId) {
      setSyncStatus('同期中...');
      const salesCount = results?.cost?.salesCount || 0;
      const salesRevenue = results?.pl?.salesRevenue || 0;
      const avgPrice = salesCount > 0 ? Math.round(salesRevenue / salesCount) : 0;
      
      syncPlayerData(roomId, playerId, {
        currentPeriod,
        totalNetAssets: results?.bs?.totalNetAssets || 0,
        cash: results?.bs?.cash || 0,
        capital: results?.bs?.capital || 0,
        retainedEarnings: results?.bs?.retainedEarnings || 0,
        sales: salesRevenue,
        profit: results?.pl?.recurringProfit || 0,
        salesQty: salesCount,
        averagePrice: avgPrice,
        lastUpdated: Date.now()
      }).then(() => {
        setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
      }).catch(err => {
        console.error(err);
        setSyncStatus('同期エラー');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]); // ルーム参加時に1回だけ即時実行

  // Firebaseへデータ同期（通信量を抑えるために2秒ディレイでデバウンス送信）
  useDebounce(
    () => {
      if (roomId && playerId) {
        setSyncStatus('同期中...');
        const salesCount = results?.cost?.salesCount || 0;
        const salesRevenue = results?.pl?.salesRevenue || 0;
        const avgPrice = salesCount > 0 ? Math.round(salesRevenue / salesCount) : 0;

        syncPlayerData(roomId, playerId, {
          currentPeriod,
          totalNetAssets: results?.bs?.totalNetAssets || 0,
          cash: results?.bs?.cash || 0,
          capital: results?.bs?.capital || 0,
          retainedEarnings: results?.bs?.retainedEarnings || 0,
          sales: salesRevenue,
          profit: results?.pl?.recurringProfit || 0,
          salesQty: salesCount,
          averagePrice: avgPrice,
          lastUpdated: Date.now()
        }).then(() => {
          setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
        }).catch(err => {
          console.error("Firebase sync error:", err);
          setSyncStatus('同期エラー');
          alert("データベース接続エラー（URLや権限の可能性があります）: " + err.message);
        });
      }
    },
    5000, // 5秒間操作が落ち着いたら送信
    [results, currentPeriod, roomId, playerId]
  );

  // バグ救済用：期をまたいだ際に未払税金が引き継がれていない場合、一度だけ自動補完する
  const taxPatchedRef = useRef({});
  useEffect(() => {
    const key = `${currentPeriod}`;
    if (currentPeriod > 1 && !currentData.carryover.taxes && !taxPatchedRef.current[key]) {
      taxPatchedRef.current[key] = true;
      const prevData = periods[currentPeriod - 1];
      if (prevData) {
        const prevResults = calculateFinancials(prevData.carryover, prevData.ledger, prevData.actuals, currentPeriod - 1);
        const unpaidTax = prevResults.bs?.unpaidTax || 0;
        if (unpaidTax > 0) {
          setPeriods(prev => ({
            ...prev,
            [currentPeriod]: {
              ...prev[currentPeriod],
              carryover: {
                ...prev[currentPeriod].carryover,
                taxes: unpaidTax
              }
            }
          }));
        }
      }
    }
  }, [currentPeriod]);

  // データの更新関数群
  const updatePeriodData = (field, newData) => {
    setPeriods(prev => ({
      ...prev,
      [currentPeriod]: {
        ...prev[currentPeriod],
        [field]: newData
      }
    }));
  };

  // 全期リセット機能
  const resetAllData = () => {
    if (window.confirm("全てのデータを初期化して最初から開始しますか？\n（この操作は取り消せません）")) {
      const freshData = {};
      for (let i = 1; i <= 20; i++) {
        freshData[i] = JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));
      }
      setPeriods(freshData);
      setCurrentPeriod(1);
      setTransactionMode('cash');
      setActiveTab('ledger');
    }
  };

  // 前期の期末決算データから今期の期首データ（繰越）を自動引き継ぎ
  const rollForwardFromPrevious = () => {
    if (currentPeriod <= 1) return;
    const prevPeriod = currentPeriod - 1;
    const prevData = periods[prevPeriod];
    if (!prevData) return;

    // 前期の決算計算結果を取得
    const prevResults = calculateFinancials(prevData.carryover, prevData.ledger, prevData.actuals, prevPeriod);

    const prevBS = prevResults.bs;
    const prevMat = prevResults.mat;
    const prevWip = prevResults.wip;
    const prevProd = prevResults.prod;
    const prevMach = prevResults.machines;

    // B/S残高を引き継ぎ（次期に必要な全情報を網羅）
    const nextCarryover = {
      // 現金
      cash: prevBS.cash,
      // 棚卸資産
      materialsCount: prevMat.endingCount,
      materialsValue: prevMat.endingValue,
      wipCount: prevWip.endingCount,
      wipValue: prevWip.endingValue,
      productCount: prevProd.endingCount,
      productValue: prevProd.endingValue,
      // 機械設備
      largeMachines: prevMach.large,
      smallMachines: prevMach.small,
      attachments: prevMach.attachments,
      machinesCount: prevMach.large + prevMach.small,
      machinesValue: prevBS.fixedAssets,
      // 負債
      loan: prevBS.loans,
      receivables: prevBS.receivables,
      payables: prevBS.payables,
      taxes: prevBS.unpaidTax,       // 未払法人税等
      // 純資産
      retainedEarnings: prevBS.retainedEarnings,
      capital: prevBS.capital,
      // 人員
      workers: prevResults.workers || 0,
      salesmen: prevResults.salesmen || 0
    };

    if (window.confirm(`第${prevPeriod}期末の決算データ（現金: ¥${prevBS.cash}万、純資産: ¥${prevBS.totalNetAssets}万）を、第${currentPeriod}期の期首データとして自動引き継ぎしますか？`)) {
      setPeriods(prev => ({
        ...prev,
        [currentPeriod]: {
          ...prev[currentPeriod],
          carryover: nextCarryover,
          actuals: {
            ...prev[currentPeriod].actuals,
            actualCash: prevBS.cash,
            actualMaterials: prevMat.endingCount,
            actualWip: prevWip.endingCount,
            actualProduct: prevProd.endingCount
          }
        }
      }));
      alert(`第${currentPeriod}期の期首データを自動設定しました！「設定」タブから内訳を確認・修正できます。`);
    }
  };

  return (
    <div className="phone-shell">
      {/* アプリ共通ヘッダー */}
      <header className="app-header glass-bg">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>戦略MG</h1>
          <span className="badge badge-blue">第{currentPeriod}期</span>
          <span style={{ fontSize: '0.8rem', color: syncStatus.includes('エラー') ? '#ff4444' : 'var(--text-secondary)' }}>
            ☁️ {syncStatus}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={toggleTheme} className="theme-switch" aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707-.707m12.728 0l-.707.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 01-8 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* アプリコンテンツ（スクロール可能） */}
      <main className="app-content">
        {activeTab === 'ledger' && (
          <div className="tab-panel">
            <CashLedger 
              carryover={currentData.carryover}
              ledger={currentData.ledger} 
              onUpdateLedger={(newLedger) => updatePeriodData('ledger', newLedger)}
              results={results}
              currentPeriod={currentPeriod}
              transactionMode={transactionMode}
              setTransactionMode={setTransactionMode}
            />
          </div>
        )}
        
        {activeTab === 'statements' && (
          <div className="tab-panel">
            <FinancialStatements 
              results={results} 
              carryover={currentData.carryover}
              currentPeriod={currentPeriod}
              ledger={currentData.ledger}
              onShowPerformance={() => setShowPerformanceReport(true)}
            />
          </div>
        )}

        {activeTab === 'periodEnd' && (
          <div className="tab-panel">
            <PeriodEndWizard 
              carryover={currentData.carryover}
              ledger={currentData.ledger}
              actuals={currentData.actuals}
              onUpdateActuals={(newActuals) => updatePeriodData('actuals', newActuals)}
              onUpdateLedger={(newLedger) => updatePeriodData('ledger', newLedger)}
              currentPeriod={currentPeriod}
              results={results}
              onShowPerformance={() => setShowPerformanceReport(true)}
            />
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="tab-panel">
            <ManagementPlan 
              budget={currentData.budget}
              carryover={currentData.carryover}
              onUpdateBudget={(newBudget) => updatePeriodData('budget', newBudget)}
              results={results}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-panel">
            <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>ネットワーク設定</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <div>ルームID: <strong style={{ color: 'white' }}>{roomId || '未参加'}</strong></div>
                  <div>プレイヤー名: <strong style={{ color: 'white' }}>{playerId || '未設定'}</strong></div>
                  {isOffline && <div style={{ color: 'var(--mg-yellow)' }}>現在オフラインモードです</div>}
                </div>
                <button 
                  onClick={() => {
                    if(window.confirm('ルーム設定を変更しますか？（参加画面に戻ります）')){
                      // Firestoreからプレイヤー情報を削除
                      if (roomId && playerId) {
                        removePlayer(roomId, playerId);
                      }
                      safeStorage.setItem('mg_room_id', '');
                      safeStorage.setItem('mg_player_id', '');
                      safeStorage.setItem('mg_offline_mode', 'false');
                      setRoomId('');
                      setPlayerId('');
                      setIsOffline(false);
                      setSyncStatus('未同期');
                      setShowLogin(true);
                    }
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  退出する
                </button>
              </div>
              <button 
                className="btn-secondary"
                onClick={() => {
                  if (roomId && playerId) {
                    setSyncStatus('同期中...');
                    const salesCount = results?.cost?.salesCount || 0;
                    const salesRevenue = results?.pl?.salesRevenue || 0;
                    const avgPrice = salesCount > 0 ? Math.round(salesRevenue / salesCount) : 0;

                    syncPlayerData(roomId, playerId, {
                      currentPeriod,
                      totalNetAssets: results?.bs?.totalNetAssets || 0,
                      cash: results?.bs?.cash || 0,
                      capital: results?.bs?.capital || 0,
                      retainedEarnings: results?.bs?.retainedEarnings || 0,
                      sales: salesRevenue,
                      profit: results?.pl?.recurringProfit || 0,
                      salesQty: salesCount,
                      averagePrice: avgPrice,
                      lastUpdated: Date.now()
                    }).then(() => {
                      setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
                      alert('手動での強制同期が完了しました');
                    }).catch(err => {
                      setSyncStatus('同期エラー');
                      alert("エラー: " + err.message);
                    });
                  } else {
                    alert("ルームに参加していません");
                  }
                }}
                style={{ width: '100%', padding: '12px' }}
              >
                手動で強制同期する
              </button>
              
              <button 
                className="btn-secondary"
                onClick={() => navigate('/dashboard')}
                style={{ width: '100%', padding: '12px', marginTop: '12px', border: '1px solid var(--mg-blue)', color: 'var(--mg-blue)', background: 'transparent' }}
              >
                📊 プロジェクター用ダッシュボードを開く
              </button>
            </div>

            <PriorPeriodCarryover 
              carryover={currentData.carryover}
              onUpdateCarryover={(newCarryover) => updatePeriodData('carryover', newCarryover)}
              currentPeriod={currentPeriod}
              periods={periods}
              setCurrentPeriod={setCurrentPeriod}
              rollForwardFromPrevious={rollForwardFromPrevious}
              resetAllData={resetAllData}
            />
          </div>
        )}

        {showPerformanceReport && (() => {
          const prevData = currentPeriod > 1 ? periods[currentPeriod - 1] : null;
          const prevResults = prevData ? calculateFinancials(prevData.carryover, prevData.ledger, prevData.actuals, currentPeriod - 1) : null;
          
          return (
            <ErrorBoundary>
              <PerformanceReport
                ledger={currentData.ledger}
                results={results}
                prevLedger={prevData?.ledger}
                prevResults={prevResults}
                currentPeriod={currentPeriod}
                onClose={() => setShowPerformanceReport(false)}
              />
            </ErrorBoundary>
          );
        })()}
      </main>

      {/* スマホ用ボトムナビゲーション */}
      <nav className="bottom-nav glass-bg">
        <button 
          onClick={() => setActiveTab('ledger')} 
          className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          出納帳
        </button>

        <button 
          onClick={() => setActiveTab('statements')} 
          className={`nav-item ${activeTab === 'statements' ? 'active' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
          決算書
        </button>

        <button 
          onClick={() => setActiveTab('periodEnd')} 
          className={`nav-item ${activeTab === 'periodEnd' ? 'active' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          期末処理
        </button>

        <button 
          onClick={() => setActiveTab('plan')} 
          className={`nav-item ${activeTab === 'plan' ? 'active' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          計画表
        </button>

        <button 
          onClick={() => setActiveTab('settings')} 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          設定
        </button>
      </nav>

      {/* ルーム・プレイヤー登録モーダル */}
      {showLogin && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '24px', borderRadius: '16px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-primary)' }}>研修ルームに参加</h2>
            <div className="form-group">
              <label className="form-label">ルームID（講師から指定されたID）</label>
              <input 
                type="text" 
                className="form-input" 
                value={loginInput.room}
                onChange={e => setLoginInput({...loginInput, room: e.target.value})}
                placeholder="例: mg-tokyo-01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">プレイヤー名（表示名）</label>
              <input 
                type="text" 
                className="form-input" 
                value={loginInput.player}
                onChange={e => setLoginInput({...loginInput, player: e.target.value})}
                placeholder="例: 鈴木一郎"
              />
            </div>
            <button 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '20px', padding: '12px', fontSize: '1.1rem' }}
              onClick={() => {
                const cleanRoom = loginInput.room.trim();
                const cleanPlayer = loginInput.player.trim();
                if (!cleanRoom || !cleanPlayer) {
                  alert("ルームIDとプレイヤー名を入力してください");
                  return;
                }
                safeStorage.setItem('mg_room_id', cleanRoom);
                safeStorage.setItem('mg_player_id', cleanPlayer);
                safeStorage.setItem('mg_offline_mode', 'false');
                setRoomId(cleanRoom);
                setPlayerId(cleanPlayer);
                setIsOffline(false);
                setShowLogin(false);
              }}
            >
              参加する
            </button>
            <button 
              className="btn-secondary" 
              style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '1rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}
              onClick={() => {
                safeStorage.setItem('mg_offline_mode', 'true');
                setIsOffline(true);
                setSyncStatus('オフライン');
                setShowLogin(false);
              }}
            >
              参加せずに一人でプレイする
            </button>
            
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button 
                onClick={() => navigate('/dashboard')}
                style={{ background: 'none', border: 'none', color: 'var(--mg-blue)', textDecoration: 'underline', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                プロジェクター用ダッシュボード画面へ移動
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
