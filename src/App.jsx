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
import { BookOpen, FileText, CalendarCheck, Target, Settings, Sun, Moon } from 'lucide-react';

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

  // ダッシュボード用の同期ペイロード生成
  const generateSyncPayload = () => {
    const periodsData = {};
    [1, 2, 3, 4, 5].forEach(p => {
      const pData = periods[p];
      if (pData) {
        const pResults = calculateFinancials(pData.carryover, pData.ledger, pData.actuals, p);
        const pSalesCount = pResults?.prod?.salesCount || 0;
        const pSalesRevenue = pResults?.pl?.salesRevenue || 0;
        periodsData[p] = {
          totalNetAssets: pResults?.bs?.totalNetAssets || 0,
          sales: pSalesRevenue,
          profit: pResults?.pl?.operatingProfit || 0,
          salesQty: pSalesCount,
          averagePrice: pSalesCount > 0 ? Math.round(pSalesRevenue / pSalesCount) : 0,
          cash: pResults?.bs?.cash || 0,
          capital: pResults?.bs?.capital || 0,
          retainedEarnings: pResults?.bs?.retainedEarnings || 0
        };
      }
    });

    const currentSalesCount = results?.prod?.salesCount || 0;
    const currentSalesRevenue = results?.pl?.salesRevenue || 0;
    const currentAvgPrice = currentSalesCount > 0 ? Math.round(currentSalesRevenue / currentSalesCount) : 0;

    return {
      currentPeriod,
      totalNetAssets: results?.bs?.totalNetAssets || 0,
      cash: results?.bs?.cash || 0,
      capital: results?.bs?.capital || 0,
      retainedEarnings: results?.bs?.retainedEarnings || 0,
      sales: currentSalesRevenue,
      profit: results?.pl?.operatingProfit || 0,
      salesQty: currentSalesCount,
      averagePrice: currentAvgPrice,
      lastUpdated: Date.now(),
      periods: periodsData
    };
  };

  // 初回接続時（またはリロード時）に即座に同期してダッシュボードに表示させる
  useEffect(() => {
    if (roomId && playerId) {
      setSyncStatus('同期中...');
      syncPlayerData(roomId, playerId, generateSyncPayload()).then(() => {
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
        syncPlayerData(roomId, playerId, generateSyncPayload()).then(() => {
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
      <header className="app-header">
        <div className="app-header__content">
          <div className="app-header__title-row">
            <h1 className="app-title" style={{ fontSize: '1.2rem', margin: 0 }}>戦略MG</h1>
            <span className="badge badge-blue">第{currentPeriod}期</span>
          </div>
          <div
            className={`app-header__status ${syncStatus.includes('エラー') ? 'is-error' : ''}`}
            aria-live="polite"
          >
            <span aria-hidden="true">☁️</span>
            <span>{syncStatus}</span>
          </div>
        </div>
      </header>

      {/* アプリコンテンツ（スクロール可能） */}
      <main className="app-content" style={{ overflowX: 'hidden' }}>
        <>
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
            <div className="tab-panel" style={{ display: 'block' }}>
              <div className="glass-card" style={{ padding: '18px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.35 }}>ネットワーク設定</h3>
                </div>

                <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ padding: '10px 0', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>同期状態</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '800', color: syncStatus.includes('エラー') ? '#b91c1c' : 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {isOffline ? 'オフライン' : syncStatus}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ルームID</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.35 }}>{roomId || '未参加'}</div>
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginBottom: '4px' }}>プレイヤー名</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.35 }}>{playerId || '未設定'}</div>
                    </div>
                  </div>
                </div>

                {isOffline && (
                  <div
                    style={{
                      fontSize: '0.76rem',
                      lineHeight: 1.45,
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '12px'
                    }}
                  >
                    現在オフラインモードです。同期やルーム連携は行われません。
                  </div>
                )}

                <div style={{ display: 'grid', gap: '10px' }}>
                  <button 
                    className="btn-secondary"
                    onClick={() => {
                      if (roomId && playerId) {
                        setSyncStatus('同期中...');
                        syncPlayerData(roomId, playerId, generateSyncPayload()).then(() => {
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
                    style={{ width: '100%', padding: '12px' }}
                  >
                    プロジェクター用ダッシュボードを開く
                  </button>

                  <button 
                    onClick={() => {
                      if(window.confirm('ルーム設定を変更しますか？（参加画面に戻ります）')){
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
                    className="btn-danger"
                    style={{ width: '100%', padding: '12px', fontWeight: '700' }}
                  >
                    ルーム設定を変更する
                  </button>
                </div>
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
        </>

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
      <nav className="bottom-nav">
        <button 
          onClick={() => setActiveTab('ledger')} 
          className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
        >
          <BookOpen size={24} style={{ marginBottom: '4px', transition: 'transform 0.2s' }} />
          出納帳
        </button>

        <button 
          onClick={() => setActiveTab('periodEnd')} 
          className={`nav-item ${activeTab === 'periodEnd' ? 'active' : ''}`}
        >
          <CalendarCheck size={24} style={{ marginBottom: '4px', transition: 'transform 0.2s' }} />
          期末処理
        </button>
      </nav>

      {/* ルーム・プレイヤー登録モーダル */}
      {showLogin && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.35)', zIndex: 9999,
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
              style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '1rem', background: 'transparent', border: '1px solid var(--border-glass-focused)' }}
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
