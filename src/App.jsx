import { useState, useEffect, useRef } from 'react';
import { calculateFinancials, DEFAULT_PERIOD_DATA } from './utils/calculations';
import CashLedger from './components/CashLedger';
import FinancialStatements from './components/FinancialStatements';
import PeriodEndWizard from './components/PeriodEndWizard';
import ManagementPlan from './components/ManagementPlan';
import PriorPeriodCarryover from './components/PriorPeriodCarryover';
import PerformanceReport from './components/PerformanceReport';
import ErrorBoundary from './components/ErrorBoundary';
import { syncPlayerData, fetchPlayerRecord, isRemoteNewer } from './pocketbase';
import { TOTAL_PERIODS, isAllLedgersEmpty, buildPeriodsSummary } from './utils/constants';
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
    for (let i = 1; i <= TOTAL_PERIODS; i++) {
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

  // 掛け取引ルールの有効・無効
  const [enableCredit, setEnableCredit] = useState(() => {
    return safeStorage.getItem('mg_enable_credit') !== 'false';
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

  // 「最後のリセットを取り消す」ボタン表示用（mg_reset_backup の有無・退避日時）
  const [resetBackupInfo, setResetBackupInfo] = useState(() => {
    try {
      const raw = safeStorage.getItem('mg_reset_backup');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { ts: parsed?.ts || null };
    } catch {
      return null;
    }
  });

  // 同期の自動リトライ管理（useRefで再レンダーを起こさずタイマー/回数を保持）
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);

  // C3対策: 初回のサーバー確認（fetchPlayerRecord）が完了するまで、
  // マウント直後のデバウンス同期がローカル状態を無確認でpushしないようにするフラグ
  const initialCheckDoneRef = useRef(false);

  // 保留中のリトライをキャンセルする（新しいデバウンス同期が走ったとき等）
  const cancelRetry = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
  };

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

  useEffect(() => {
    safeStorage.setItem('mg_enable_credit', String(enableCredit));
  }, [enableCredit]);

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
  // 期別サマリーは第1期〜第TOTAL_PERIODS(20)期を対象にする（以前は1〜5期ハードコードで6期以降が欠落）
  const generateSyncPayload = () => {
    const periodsData = buildPeriodsSummary(periods, currentPeriod);

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

  // 仕訳明細フルバックアップ生成（全期の ledger/carryover/actuals をそのまま保存）
  // サマリー同期とは別に players.backup(json) へ保存し、端末紛失時などにサーバーから復元できるようにする
  // C1ガード: ローカルが実質空（全期のledgerが空）のときは undefined を返して backup を
  // 送信ペイロードから外し、サーバー上の既存バックアップ（唯一の復元点）を空データで潰さない
  const generateBackupPayload = () => {
    if (isAllLedgersEmpty(periods)) return undefined;
    return {
      periods,
      currentPeriod,
      savedAt: Date.now()
    };
  };

  // C2対策: リトライのクロージャが古いレンダーのペイロード生成関数を捕捉して
  // 古いスナップショットを再送しないよう、最新の生成関数を常に ref に持たせ、
  // 送信直前に ref 経由で再生成する（refの更新はレンダー中でなくエフェクトで行う）
  const payloadFnsRef = useRef({ sync: generateSyncPayload, backup: generateBackupPayload });
  useEffect(() => {
    payloadFnsRef.current = { sync: generateSyncPayload, backup: generateBackupPayload };
  });

  // 自動リトライ付き同期（初回同期・デバウンス同期で共用）
  // 失敗時は 5秒→15秒→30秒 の最大3回まで自動再送。3回目も失敗したときだけ onFinalError を発火する。
  const RETRY_DELAYS = [5000, 15000, 30000];
  const syncWithRetry = (onFinalError) => {
    if (!roomId || !playerId) return;

    const attempt = () => {
      // 送信直前に ref 経由で最新stateからペイロードを再生成する（古いスナップショットの再送防止）
      setSyncStatus(retryCountRef.current > 0 ? `再試行中(${retryCountRef.current}/${RETRY_DELAYS.length})...` : '同期中...');
      const payload = payloadFnsRef.current.sync();
      const backup = payloadFnsRef.current.backup();
      syncPlayerData(roomId, playerId, payload, backup)
        .then((result) => {
          retryCountRef.current = 0;
          retryTimerRef.current = null;
          if (result?.skipped) {
            // サーバー側が新しいため上書きしなかった（C2ガード）
            setSyncStatus(`同期スキップ：サーバー側が新しいため (${new Date().toLocaleTimeString()})`);
          } else {
            // 最後にサーバーへ反映できた時刻を記録（C3のリロード時比較に使う）
            safeStorage.setItem('mg_last_synced_at', String(payload.lastUpdated));
            setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
          }
        })
        .catch((err) => {
          console.error('Sync error:', err);
          if (retryCountRef.current < RETRY_DELAYS.length) {
            const delay = RETRY_DELAYS[retryCountRef.current];
            retryCountRef.current += 1;
            setSyncStatus(`再試行中(${retryCountRef.current}/${RETRY_DELAYS.length})...`);
            retryTimerRef.current = setTimeout(attempt, delay);
          } else {
            // 最大リトライ到達＝最終失敗
            retryCountRef.current = 0;
            retryTimerRef.current = null;
            setSyncStatus('同期エラー');
            if (onFinalError) onFinalError(err);
          }
        });
    };

    attempt();
  };

  // 初回接続時（またはリロード時）に即座に同期してダッシュボードに表示させる
  // C3対策: 保存済み認証で起動した端末が無確認でサーバーをpushしないよう、
  // 同期の前に fetchPlayerRecord でサーバー側を確認し、サーバーの lastUpdated が
  // この端末の最終同期時刻（mg_last_synced_at）より新しい場合は確認ダイアログを挟む。
  useEffect(() => {
    if (!roomId || !playerId) return undefined;
    cancelRetry(); // ルーム参加/リロード時は保留中のリトライを破棄してからやり直す
    initialCheckDoneRef.current = false; // 確認が終わるまでデバウンス同期のpushを止める
    let cancelled = false;

    (async () => {
      try {
        setSyncStatus('サーバー確認中...');
        const record = await fetchPlayerRecord(roomId, playerId);
        if (cancelled) return;
        const localSyncedTs = Number(safeStorage.getItem('mg_last_synced_at')) || 0;
        if (record && isRemoteNewer(record.data, localSyncedTs)) {
          const load = window.confirm(
            'サーバーに新しいデータがあります。読み込みますか？\n\n・『OK』：サーバーのデータをこの端末に読み込んで再開します。\n・『キャンセル』：この端末のデータでサーバーを上書きして続行します。'
          );
          if (load) {
            const backup = record.backup;
            if (backup && backup.periods) {
              setPeriods(backup.periods);
              setCurrentPeriod(backup.currentPeriod || 1);
              safeStorage.setItem('mg_periods_data', JSON.stringify(backup.periods));
              safeStorage.setItem('mg_current_period', String(backup.currentPeriod || 1));
            } else {
              alert('サーバーに読み込める明細データ（バックアップ）がありませんでした。この端末のデータで続行します。');
            }
            // 読み込んだサーバー時点までは同期済みとして記録し、次回リロードでの再確認を防ぐ
            safeStorage.setItem('mg_last_synced_at', String(Number(record.data?.lastUpdated) || Date.now()));
            setSyncStatus(`サーバーから読み込み完了 (${new Date().toLocaleTimeString()})`);
            initialCheckDoneRef.current = true; // 以後の変更はデバウンス同期が拾う
            return; // push しない
          }
          // キャンセル＝この端末の内容で上書きすることをユーザーが明示的に選択した
        }
      } catch (err) {
        // fetch失敗（DB不達）→ 従来どおりリトライ同期に任せる（C2のlastUpdatedガードが最後の防波堤）
        console.error('Initial fetchPlayerRecord failed, falling back to retry sync:', err);
      }
      if (cancelled) return;
      initialCheckDoneRef.current = true;
      // 初回同期は最終失敗しても alert は出さず、ステータス表示のみ（従来挙動を踏襲）
      syncWithRetry(null);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]); // ルーム参加時に1回だけ即時実行

  // Firebaseへデータ同期（通信量を抑えるために2秒ディレイでデバウンス送信）
  useDebounce(
    () => {
      if (roomId && playerId) {
        // C3対策: 初回のサーバー確認が終わるまではマウント直後の発火でpushしない
        // （確認完了後の変更は、次のstate変化で改めてこのデバウンスが発火して同期される）
        if (!initialCheckDoneRef.current) return;
        // 新しいデバウンス同期が走ったら、前回の保留中リトライは破棄する
        cancelRetry();
        // 最終失敗（3回目失敗）時のみ alert を発火する
        syncWithRetry((err) => {
          alert("データベース接続エラー（URLや権限の可能性があります）: " + err.message);
        });
      }
    },
    2000, // 2秒間操作が落ち着いたら送信
    [periods, currentPeriod, roomId, playerId]
  );

  // アンマウント時にリトライタイマーをクリアする
  useEffect(() => {
    return () => cancelRetry();
  }, []);

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
          setTimeout(() => {
            setPeriods(prev => {
              if (prev[currentPeriod]?.carryover?.taxes) return prev;
              return {
                ...prev,
                [currentPeriod]: {
                  ...prev[currentPeriod],
                  carryover: {
                    ...prev[currentPeriod].carryover,
                    taxes: unpaidTax
                  }
                }
              };
            });
          }, 0);
        }
      }
    }
  }, [currentPeriod, currentData.carryover.taxes, periods]);

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
    if (window.confirm("全てのデータを初期化して最初から開始しますか？\n（直前の状態は「設定 > 最後のリセットを取り消す」で1回だけ復元できます）")) {
      // リセット直前のスナップショットを1世代だけ退避（「最後のリセットを取り消す」で復元可能にする）
      const ts = Date.now();
      safeStorage.setItem('mg_reset_backup', JSON.stringify({ periods, currentPeriod, ts }));
      setResetBackupInfo({ ts });

      const freshData = {};
      for (let i = 1; i <= TOTAL_PERIODS; i++) {
        freshData[i] = JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));
      }
      setPeriods(freshData);
      setCurrentPeriod(1);
      setTransactionMode('cash');
      setActiveTab('ledger');
    }
  };

  // 「最後のリセットを取り消す」：mg_reset_backup からリセット直前の状態を復元する
  const undoLastReset = () => {
    const raw = safeStorage.getItem('mg_reset_backup');
    if (!raw) {
      alert('取り消せるリセットデータがありません。');
      setResetBackupInfo(null);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('退避データの読み込みに失敗しました。');
      return;
    }
    if (!parsed || !parsed.periods) {
      alert('退避データが不正です。');
      return;
    }
    const when = parsed.ts ? new Date(parsed.ts).toLocaleString() : '不明';
    if (window.confirm(`${when} のリセットを取り消し、その直前の状態に戻しますか？\n（現在の入力内容は失われます）`)) {
      setPeriods(parsed.periods);
      setCurrentPeriod(parsed.currentPeriod || 1);
      try { localStorage.removeItem('mg_reset_backup'); } catch { /* ignore */ }
      setResetBackupInfo(null);
      setActiveTab('ledger');
      alert('リセットを取り消しました。');
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
                enableCredit={enableCredit}
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
                periods={periods}
                onShowPerformance={() => setShowPerformanceReport(true)}
              />
            </div>
          )}

          {activeTab === 'periodEnd' && (
            <div className="tab-panel">
              <PeriodEndWizard 
                key={`${currentPeriod}-${currentData.ledger.length}-${JSON.stringify(currentData.carryover)}`}
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
              {/* ルール設定カード */}
              <div className="glass-card" style={{ padding: '18px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.35 }}>ルール設定</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>掛け取引ルールを有効にする</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        無効にすると、2期目以降も現金取引（現金売上・仕入）のみになります。
                      </div>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                      <input 
                        type="checkbox" 
                        checked={enableCredit} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setEnableCredit(val);
                          if (!val) {
                            setTransactionMode('cash'); // 無効時は強制的に現金モードへ
                          }
                        }}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: enableCredit ? '#00b0ff' : '#ccc',
                        borderRadius: '24px',
                        transition: '0.4s',
                        boxShadow: enableCredit ? '0 0 8px rgba(0, 176, 255, 0.4)' : 'none'
                      }}>
                        <span style={{
                          position: 'absolute', height: '18px', width: '18px', left: enableCredit ? '22px' : '4px', bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.4s'
                        }} />
                      </span>
                    </label>
                  </div>

                  {enableCredit && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>現在の取引モード</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setTransactionMode('cash')}
                          className={`btn-premium ${transactionMode === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '8px 0', fontSize: '0.8rem' }}
                        >
                          現金取引のみ
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransactionMode('credit')}
                          className={`btn-premium ${transactionMode === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '8px 0', fontSize: '0.8rem' }}
                        >
                          掛け取引モード
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                        cancelRetry(); // 手動同期が保留中リトライを引き継ぐ
                        setSyncStatus('同期中...');
                        const payload = generateSyncPayload();
                        syncPlayerData(roomId, playerId, payload, generateBackupPayload()).then((result) => {
                          if (result?.skipped) {
                            setSyncStatus(`同期スキップ：サーバー側が新しいため (${new Date().toLocaleTimeString()})`);
                            alert('サーバーに、この端末より新しいデータがあるため上書きしませんでした。');
                          } else {
                            safeStorage.setItem('mg_last_synced_at', String(payload.lastUpdated));
                            setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
                            alert('手動での強制同期が完了しました');
                          }
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
                      if(window.confirm('ルーム設定を変更しますか？（参加画面に戻ります）\n※サーバー上の成績とバックアップは残ります。同じ名前で再参加すれば復元できます。')){
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

              {/* 最後のリセットを取り消す（mg_reset_backup が存在するときのみ表示） */}
              {resetBackupInfo && (
                <div className="glass-card" style={{ padding: '18px 16px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.35 }}>データ復旧</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={undoLastReset}
                    style={{ width: '100%', padding: '12px', fontWeight: '700' }}
                  >
                    ⏪ 最後のリセットを取り消す
                  </button>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                    退避日時: {resetBackupInfo.ts ? new Date(resetBackupInfo.ts).toLocaleString() : '不明'}
                  </div>
                </div>
              )}

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
          onClick={() => setActiveTab('statements')} 
          className={`nav-item ${activeTab === 'statements' ? 'active' : ''}`}
        >
          <FileText size={24} style={{ marginBottom: '4px', transition: 'transform 0.2s' }} />
          決算書
        </button>

        <button 
          onClick={() => setActiveTab('periodEnd')} 
          className={`nav-item ${activeTab === 'periodEnd' ? 'active' : ''}`}
        >
          <CalendarCheck size={24} style={{ marginBottom: '4px', transition: 'transform 0.2s' }} />
          期末処理
        </button>

        <button 
          onClick={() => setActiveTab('plan')} 
          className={`nav-item ${activeTab === 'plan' ? 'active' : ''}`}
        >
          <Target size={24} style={{ marginBottom: '4px', transition: 'transform 0.2s' }} />
          計画表
        </button>

        <button 
          onClick={() => setActiveTab('settings')} 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <Settings size={24} style={{ marginBottom: '4px', transition: 'transform 0.2s' }} />
          設定
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
              onClick={async () => {
                const cleanRoom = loginInput.room.trim();
                const cleanPlayer = loginInput.player.trim();
                if (!cleanRoom || !cleanPlayer) {
                  alert("ルームIDとプレイヤー名を入力してください");
                  return;
                }

                // 過去のゲームデータ（仕訳、期首変更、2期以降の進捗など）が残っているかチェック
                const hasExistingData = Object.values(periods).some(p => p.ledger.length > 0) ||
                                        currentPeriod > 1 ||
                                        periods[1].carryover.capital !== 300 ||
                                        periods[1].carryover.loan !== 0;

                // 参加確定処理（localStorage＋stateへ反映してモーダルを閉じる）
                const commitJoin = () => {
                  safeStorage.setItem('mg_room_id', cleanRoom);
                  safeStorage.setItem('mg_player_id', cleanPlayer);
                  safeStorage.setItem('mg_offline_mode', 'false');
                  setRoomId(cleanRoom);
                  setPlayerId(cleanPlayer);
                  setIsOffline(false);
                  setShowLogin(false);
                };

                // 従来フロー（サーバーに同名レコードが無い/確認不能な場合）
                const legacyJoinFlow = () => {
                  // 直前のルームと異なるルームに入ろうとしている場合は先頭に注意文を足す
                  const prevRoom = safeStorage.getItem('mg_room_id') || '';
                  const roomChangedNote = (prevRoom && prevRoom !== cleanRoom)
                    ? `前回のルーム『${prevRoom}』と異なるルームです。\n`
                    : '';

                  if (hasExistingData) {
                    const shouldReset = window.confirm(
                      roomChangedNote +
                      "過去のゲームデータが残っています。\n新しいルームに参加するにあたり、データを初期化して最初から開始しますか？\n\n・『OK』：データを初期化して最初から開始します。参加後の同期で、サーバー上の同名プレイヤーの成績も初期化後の内容に更新されます。\n（初期化直前の状態は「設定 > 最後のリセットを取り消す」で1回だけ復元できます）\n・『キャンセル』：現在のデータを引き継いで参加します（再接続など）。"
                    );
                    if (shouldReset) {
                      // C1対策: resetAllData と同じく、初期化直前のスナップショットを1世代だけ退避する
                      // （「設定 > 最後のリセットを取り消す」で復元可能にする）
                      const ts = Date.now();
                      safeStorage.setItem('mg_reset_backup', JSON.stringify({ periods, currentPeriod, ts }));
                      setResetBackupInfo({ ts });

                      const freshData = {};
                      for (let i = 1; i <= TOTAL_PERIODS; i++) {
                        freshData[i] = JSON.parse(JSON.stringify(DEFAULT_PERIOD_DATA));
                      }
                      setPeriods(freshData);
                      setCurrentPeriod(1);
                      setTransactionMode('cash');
                      setActiveTab('ledger');
                      safeStorage.setItem('mg_periods_data', JSON.stringify(freshData));
                      safeStorage.setItem('mg_current_period', '1');
                    }
                  }
                  commitJoin();
                };

                // サーバー上の同名レコードを確認（通信エラー時は確認をスキップして従来フローへ＝オフライン耐性）
                let serverRecord;
                try {
                  serverRecord = await fetchPlayerRecord(cleanRoom, cleanPlayer);
                } catch (err) {
                  console.error('fetchPlayerRecord failed, fallback to legacy flow:', err);
                  legacyJoinFlow();
                  return;
                }

                if (serverRecord) {
                  if (!hasExistingData) {
                    // サーバーに同名あり & ローカルにデータなし → 復元 or 別人としてキャンセル
                    const ok = window.confirm(
                      `このルームには既に『${cleanPlayer}』さんのデータがあります。\n\n・あなた自身の続きなら『OK』（サーバーのデータを復元して再開します）\n・別人なら『キャンセル』して名前を変えてください`
                    );
                    if (!ok) {
                      // 参加中断（モーダルに留まる）
                      return;
                    }
                    const backup = serverRecord.backup;
                    if (backup && backup.periods) {
                      setPeriods(backup.periods);
                      setCurrentPeriod(backup.currentPeriod || 1);
                      safeStorage.setItem('mg_periods_data', JSON.stringify(backup.periods));
                      safeStorage.setItem('mg_current_period', String(backup.currentPeriod || 1));
                      setActiveTab('ledger');
                    } else {
                      // 古いレコードで復元可能なbackupが無い → そのまま参加（＝新規上書き）
                      alert('サーバーに復元できるデータがありませんでした。新規として参加します。');
                    }
                    // サーバー時点まで同期済みとして記録（直後の初回同期で再確認ダイアログを出さない）
                    safeStorage.setItem('mg_last_synced_at', String(Number(serverRecord.data?.lastUpdated) || Date.now()));
                    commitJoin();
                    return;
                  } else {
                    // サーバーに同名あり & ローカルにデータあり → 今の端末の内容で上書きするか確認
                    const ok = window.confirm(
                      `サーバーに同名『${cleanPlayer}』さんのデータが既にあります。\n\n・あなたの以前のデータなら『OK』（今のこの端末の内容で上書きして続行します）\n・他の参加者の可能性があるなら『キャンセル』して名前を変えてください`
                    );
                    if (!ok) {
                      // 参加中断（モーダルに留まる）
                      return;
                    }
                    // OK＝今の端末のデータのまま参加（初回同期でサーバーが上書きされる）
                    // ユーザーが上書きを明示的に選択したので、直後の初回同期で再確認ダイアログを出さない
                    safeStorage.setItem('mg_last_synced_at', String(Number(serverRecord.data?.lastUpdated) || Date.now()));
                    commitJoin();
                    return;
                  }
                }

                // サーバーに同名レコードなし → 従来フロー
                legacyJoinFlow();
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
