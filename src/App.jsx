import { useState, useEffect, useRef } from 'react';
import { calculateFinancials } from './utils/calculations';
import CashLedger from './components/CashLedger';
import FinancialStatements from './components/FinancialStatements';
import PeriodEndWizard from './components/PeriodEndWizard';
import ManagementPlan from './components/ManagementPlan';
import PriorPeriodCarryover from './components/PriorPeriodCarryover';
import PerformanceReport from './components/PerformanceReport';
import ErrorBoundary from './components/ErrorBoundary';
import StorageRecoveryBanner from './components/StorageRecoveryBanner';
import { loadPeriodsSafely, saveWithBackup, findLatestValidBackup, buildCorruptBlob } from './utils/storageRecovery';
import { joinRoom, pushPlayer, overwriteServer, fetchPlayerRecord, hasDeviceToken, getStoredVersion, getBaseHashes, markSynced, setPushBlocked, PushBlockedError } from './sync/client';
import { mergePeriods, applyConflictChoices, updateTombstones, buildBaseHashes, stableStringify } from './sync/merge';
import { getTombstones, setTombstones } from './sync/store';
import MergeConflictModal from './components/MergeConflictModal';
import { TOTAL_PERIODS, isAllLedgersEmpty, buildPeriodsSummary, normalizePeriods, buildNextCarryover, createDefaultPeriodData } from './utils/constants';
import { useDebounce } from 'react-use';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, CalendarCheck, Target, Settings, CloudOff, CloudCheck, CloudAlert, RefreshCw } from 'lucide-react';

// 安全な localStorage ラッパー
const safeStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* 無視 */ }
  }
};

// storageRecovery 用の localStorage アダプタ（例外は呼び出し側で扱う）
const lsAdapter = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k)
};

function App() {
  // 保存データの読み込み結果（壊れていても上書きせず、退避してバナーで通知する）
  const [initialLoad] = useState(() => loadPeriodsSafely(lsAdapter));
  const [storageIssue, setStorageIssue] = useState(initialLoad.issue);

  // テーマの状態 (ダーク / ライト)
  const [theme] = useState(() => {
    const saved = safeStorage.getItem('mg_theme');
    return saved || 'dark';
  });

  // 成績表表示の状態
  const [showPerformanceReport, setShowPerformanceReport] = useState(false);

  // 全期 (1期〜5期) のデータ管理
  const [periods, setPeriods] = useState(() => {
    // 旧データ（キー1〜5のみ）や欠損フィールドを20期分に補完（第6期以降の白画面対策）
    // 読み込み失敗時は null → 初期データ（ただし blocking の間は保存しない）
    return normalizePeriods(initialLoad.periods);
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
  
  const [loginInput, setLoginInput] = useState({ room: safeStorage.getItem('mg_room_id') || '', player: safeStorage.getItem('mg_player_id') || '', pin: '' });

  const navigate = useNavigate();

  // 同期ステータス表示用
  const [syncStatus, setSyncStatus] = useState(isOffline ? 'オフライン' : '未同期');

  // ヘッダーの相対時刻を更新するためのtick（表示専用）
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setNowMs(Date.now()), 0);
    return () => clearTimeout(t);
  }, [syncStatus]);

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
    // 読み込み失敗中は、初期データで壊れた元データを上書きしない
    if (storageIssue?.blocking) return;
    try {
      saveWithBackup(lsAdapter, 'mg_periods_data', JSON.stringify(periods));
    } catch (e) {
      console.error('[storage] 保存に失敗しました', e);
    }
  }, [periods, storageIssue]);

  // 保存データ復旧バナーの操作
  const handleStorageRestore = () => {
    const backup = findLatestValidBackup(lsAdapter, 'mg_periods_data');
    if (!backup) return;
    if (!storageIssue?.blocking && !window.confirm('壊れていない期も含め、予備のスナップショットの内容に置き換えます。よろしいですか？')) return;
    setPeriods(normalizePeriods(backup.periods));
    setStorageIssue(null);
  };
  const handleStorageDownload = () => {
    if (!storageIssue) return;
    const url = URL.createObjectURL(buildCorruptBlob(storageIssue));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mg_corrupt_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleStorageReset = () => {
    if (!window.confirm('保存データを初期化して最初から始めます。壊れたデータは退避済みですが、よろしいですか？')) return;
    setPeriods(normalizePeriods(null));
    setStorageIssue(null);
  };

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

  // 現在の期のデータを取得
  const currentData = periods[currentPeriod] || createDefaultPeriodData();

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
      savedAt: Date.now(),
      deletedIds: getTombstones()
    };
  };

  // 最新の state を同期処理から参照するための ref（古いクロージャの再送防止）
  const payloadFnsRef = useRef({ sync: generateSyncPayload, backup: generateBackupPayload });
  const stateRef = useRef({ periods, currentPeriod });
  useEffect(() => {
    payloadFnsRef.current = { sync: generateSyncPayload, backup: generateBackupPayload };
    stateRef.current = { periods, currentPeriod };
  });

  // 保存データ破損中（storageIssue.blocking）はサーバーへ push しない（pull は許可）
  useEffect(() => {
    setPushBlocked(!!storageIssue?.blocking);
  }, [storageIssue]);

  // 削除した取引を tombstone（削除済みID）として記録する。マージ時に「消したものが復活」しないため。
  const prevPeriodsRef = useRef(periods);
  const firstEditRunRef = useRef(true);
  const lastEditRef = useRef(Number(safeStorage.getItem('mg_last_local_edit')) || 0);
  useEffect(() => {
    if (!storageIssue?.blocking) {
      setTombstones(updateTombstones(prevPeriodsRef.current, periods, getTombstones()));
    }
    prevPeriodsRef.current = periods;
    if (firstEditRunRef.current) { firstEditRunRef.current = false; return; } // 読み込み直後は編集ではない
    lastEditRef.current = Date.now();
    safeStorage.setItem('mg_last_local_edit', String(lastEditRef.current));
  }, [periods, storageIssue]);

  // 競合（同じ取引が両側で別内容に変わった）の確認待ち
  const [mergeConflicts, setMergeConflicts] = useState(null);
  const conflictPendingRef = useRef(false);
  const conflictLoopRef = useRef(0);

  // サーバーの内容とこの端末の内容を自動マージする。戻り値: 'conflict' | 'changed' | 'unchanged'
  const mergeWithServer = (server) => {
    const cur = stateRef.current.periods;
    const sb = server?.backup;
    if (!sb || !sb.periods) {
      markSynced(roomId, playerId, server.version);
      return 'unchanged';
    }
    const r = mergePeriods({
      local: cur,
      remote: normalizePeriods(sb.periods),
      localDeleted: getTombstones(),
      remoteDeleted: sb.deletedIds || [],
      baseHashes: getBaseHashes(roomId, playerId),
      localTs: lastEditRef.current,
      remoteTs: Number(sb.savedAt) || Number(server.data?.lastUpdated) || 0
    });
    setTombstones(r.deletedIds);
    markSynced(roomId, playerId, server.version);
    if (r.conflicts.length > 0) {
      conflictPendingRef.current = true;
      setMergeConflicts({ conflicts: r.conflicts, periods: r.periods });
      setSyncStatus('競合の選択待ち');
      return 'conflict';
    }
    const merged = normalizePeriods(r.periods);
    if (stableStringify(merged) === stableStringify(cur)) return 'unchanged';
    setPeriods(merged); // 変更後の状態は次のデバウンス同期で送られる
    return 'changed';
  };

  const resolveConflicts = (choices) => {
    const pending = mergeConflicts;
    if (!pending) return;
    const resolved = normalizePeriods(applyConflictChoices(pending.periods, pending.conflicts, choices));
    conflictPendingRef.current = false;
    setMergeConflicts(null);
    setPeriods(resolved);
    setSyncStatus('同期中...');
  };

  // 自動リトライ付き同期（初回同期・デバウンス同期で共用）
  // 失敗時は 5秒→15秒→30秒 の最大3回まで自動再送。3回目も失敗したときだけ onFinalError を発火する。
  const RETRY_DELAYS = [5000, 15000, 30000];
  const syncWithRetry = (onFinalError) => {
    if (!roomId || !playerId) return;
    if (conflictPendingRef.current) return;

    const attempt = () => {
      setSyncStatus(retryCountRef.current > 0 ? `再試行中(${retryCountRef.current}/${RETRY_DELAYS.length})...` : '同期中...');
      const payload = payloadFnsRef.current.sync();
      const backup = payloadFnsRef.current.backup();
      const sentPeriods = stateRef.current.periods;
      pushPlayer(roomId, playerId, payload, backup)
        .then((result) => {
          retryCountRef.current = 0;
          retryTimerRef.current = null;
          if (result.conflict) {
            // 409: 他の端末が先に保存していた → 取引IDで突き合わせて自動マージ
            conflictLoopRef.current += 1;
            if (conflictLoopRef.current > 5) {
              conflictLoopRef.current = 0;
              setSyncStatus('同期エラー（競合が解消しません）');
              return;
            }
            const outcome = mergeWithServer(result.server);
            if (outcome === 'unchanged') attempt(); // 内容は変わらないので新しい版で即再送
            return;
          }
          conflictLoopRef.current = 0;
          markSynced(roomId, playerId, result.version, backup === undefined ? getBaseHashes(roomId, playerId) : buildBaseHashes(sentPeriods));
          // 最後にサーバーへ反映できた時刻を記録（ヘッダーのチップ表示に使う）
          safeStorage.setItem('mg_last_synced_at', String(payload.lastUpdated));
          setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
        })
        .catch((err) => {
          console.error('Sync error:', err);
          if (err instanceof PushBlockedError) {
            retryCountRef.current = 0;
            setSyncStatus('送信停止中（保存データを確認してください）');
            return;
          }
          const fatal = err && err.status >= 400 && err.status < 500 && err.status !== 429;
          if (!fatal && retryCountRef.current < RETRY_DELAYS.length) {
            const delay = RETRY_DELAYS[retryCountRef.current];
            retryCountRef.current += 1;
            setSyncStatus(`再試行中(${retryCountRef.current}/${RETRY_DELAYS.length})...`);
            retryTimerRef.current = setTimeout(attempt, delay);
          } else {
            retryCountRef.current = 0;
            retryTimerRef.current = null;
            setSyncStatus('同期エラー');
            if (onFinalError) onFinalError(err);
          }
        });
    };

    attempt();
  };

  // 初回接続時（またはリロード時）: まずサーバーの版を確認し、他端末の変更があれば自動マージしてから同期する
  useEffect(() => {
    if (!roomId || !playerId) return undefined;
    cancelRetry();
    initialCheckDoneRef.current = false; // 確認が終わるまでデバウンス同期のpushを止める
    let cancelled = false;

    (async () => {
      if (!hasDeviceToken(roomId, playerId)) {
        // 旧方式で参加済みの端末など、端末トークンが無い → PINで再参加してもらう
        setSyncStatus('再参加が必要です');
        setShowLogin(true);
        return;
      }
      try {
        setSyncStatus('サーバー確認中...');
        const record = await fetchPlayerRecord(roomId, playerId);
        if (cancelled) return;
        const stored = getStoredVersion(roomId, playerId);
        if (record.version !== stored) {
          initialCheckDoneRef.current = true;
          const outcome = mergeWithServer(record);
          if (outcome !== 'unchanged') return; // conflict=選択待ち / changed=変更後のデバウンス同期に任せる
        }
      } catch (err) {
        console.error('Initial fetchPlayerRecord failed, falling back to retry sync:', err);
      }
      if (cancelled) return;
      initialCheckDoneRef.current = true;
      syncWithRetry(null);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  // 2秒ディレイでデバウンス送信（通信量を抑える）
  useDebounce(
    () => {
      if (roomId && playerId) {
        if (!initialCheckDoneRef.current) return;
        cancelRetry();
        syncWithRetry((err) => {
          alert("データベース接続エラー（通信状況を確認してください）: " + err.message);
        });
      }
    },
    2000,
    [periods, currentPeriod, roomId, playerId]
  );

  // ［この端末の内容でサーバーを上書き］
  const overwriteServerWithLocal = async () => {
    if (!roomId || !playerId) { alert('ルームに参加していません'); return; }
    if (storageIssue?.blocking) { alert('保存データの確認が済むまで、サーバーへ送信できません。'); return; }
    if (!window.confirm('この端末の内容でサーバーを上書きします。\n他の端末だけにある入力はサーバーから消えます。よろしいですか？')) return;
    cancelRetry();
    setSyncStatus('同期中...');
    try {
      const payload = generateSyncPayload();
      const full = { periods, currentPeriod, savedAt: Date.now(), deletedIds: getTombstones() };
      const r = await overwriteServer(roomId, playerId, payload, full);
      if (r.conflict) { setSyncStatus('同期エラー'); alert('操作の直前にサーバーが更新されました。もう一度お試しください。'); return; }
      markSynced(roomId, playerId, r.version, buildBaseHashes(periods));
      safeStorage.setItem('mg_last_synced_at', String(payload.lastUpdated));
      setSyncStatus(`同期完了 (${new Date().toLocaleTimeString()})`);
      alert('この端末の内容でサーバーを上書きしました');
    } catch (err) {
      setSyncStatus('同期エラー');
      alert('エラー: ' + err.message);
    }
  };

  // ［サーバーの内容でこの端末を上書き］（pull なので保存データ破損中でも可能）
  const overwriteLocalWithServer = async () => {
    if (!roomId || !playerId) { alert('ルームに参加していません'); return; }
    if (!window.confirm('サーバーの内容でこの端末を上書きします。\nこの端末だけにある入力は消えます。よろしいですか？')) return;
    cancelRetry();
    setSyncStatus('サーバー確認中...');
    try {
      const record = await fetchPlayerRecord(roomId, playerId);
      const backup = record.backup;
      if (!backup || !backup.periods) {
        setSyncStatus('未同期');
        alert('サーバーに読み込める明細データがありませんでした。この端末は変更していません。');
        return;
      }
      const restored = normalizePeriods(backup.periods);
      prevPeriodsRef.current = restored; // 置き換えで消える分を tombstone にしない
      setTombstones(backup.deletedIds || []);
      setPeriods(restored);
      setCurrentPeriod(backup.currentPeriod || 1);
      safeStorage.setItem('mg_current_period', String(backup.currentPeriod || 1));
      markSynced(roomId, playerId, record.version, buildBaseHashes(restored));
      safeStorage.setItem('mg_last_synced_at', String(Number(record.data?.lastUpdated) || Date.now()));
      setSyncStatus(`サーバーから読み込み完了 (${new Date().toLocaleTimeString()})`);
      alert('サーバーの内容でこの端末を上書きしました');
    } catch (err) {
      setSyncStatus('同期エラー');
      alert('エラー: ' + err.message);
    }
  };

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
        freshData[i] = createDefaultPeriodData();
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
      setPeriods(normalizePeriods(parsed.periods));
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

    // B/S残高を引き継ぎ（未払給与 accruedLaborCost を含む全項目。仕様は constants.js 参照）
    const nextCarryover = buildNextCarryover(prevResults);

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
      <StorageRecoveryBanner
        issue={storageIssue}
        onRestore={handleStorageRestore}
        onDownload={handleStorageDownload}
        onReset={handleStorageReset}
        onDismiss={() => setStorageIssue(null)}
      />
      {/* アプリ共通ヘッダー */}
      <header className="app-header">
        <div className="app-header__content">
          <div className="app-header__title-row">
            <h1 className="app-title" style={{ fontSize: '1.2rem', margin: 0 }}>戦略MG</h1>
            <span className="badge badge-blue">第{currentPeriod}期</span>
            {(() => {
              // 表示専用：既存の syncStatus 文字列と mg_last_synced_at から状態を導出（同期ロジックは変更しない）
              let kind = 'idle';
              if (isOffline || syncStatus === 'オフライン') kind = 'offline';
              else if (syncStatus.includes('エラー')) kind = 'error';
              else if (/同期中|再試行|確認中/.test(syncStatus)) kind = 'syncing';
              else if (/同期完了|読み込み完了|同期スキップ/.test(syncStatus)) kind = 'ok';
              const ts = Number(safeStorage.getItem('mg_last_synced_at')) || 0;
              let rel = '';
              if (ts > 0) {
                const m = Math.max(0, Math.floor((nowMs - ts) / 60000));
                rel = m < 1 ? 'たった今' : m < 60 ? `${m}分前` : m < 1440 ? `${Math.floor(m / 60)}時間前` : `${Math.floor(m / 1440)}日前`;
              }
              const labels = { offline: 'オフライン', error: '同期エラー', syncing: '同期中', ok: rel ? `同期済 ${rel}` : '同期済', idle: '未同期' };
              const Icon = { offline: CloudOff, error: CloudAlert, syncing: RefreshCw, ok: CloudCheck, idle: CloudOff }[kind];
              const detail = isOffline ? 'オフラインモード（同期なし）' : `ルーム: ${roomId || '未参加'} / プレイヤー: ${playerId || '未設定'}`;
              return (
                <button
                  type="button"
                  className={`sync-chip sync-chip--${kind}`}
                  aria-live="polite"
                  title={`${syncStatus}\n${detail}`}
                  aria-label={`同期状態: ${labels[kind]}。${detail}。タップでネットワーク設定を開く`}
                  onClick={() => {
                    setActiveTab('settings');
                    setTimeout(() => document.getElementById('network-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                  }}
                >
                  <Icon size={14} aria-hidden="true" className={kind === 'syncing' ? 'sync-chip__spin' : undefined} />
                  <span className="sync-chip__label">{labels[kind]}</span>
                  {!isOffline && playerId && <span className="sync-chip__who">{playerId}</span>}
                </button>
              );
            })()}
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
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

              <div id="network-settings" className="glass-card" style={{ padding: '18px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.35 }}>ネットワーク設定</h3>
                </div>

                <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ padding: '10px 0', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>同期状態</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '800', color: syncStatus.includes('エラー') ? '#b91c1c' : 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {isOffline ? 'オフライン' : syncStatus}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ルームID</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.35 }}>{roomId || '未参加'}</div>
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>プレイヤー名</div>
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
                    onClick={overwriteServerWithLocal}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    この端末の内容でサーバーを上書き
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={overwriteLocalWithServer}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    サーバーの内容でこの端末を上書き
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
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

      {mergeConflicts && <MergeConflictModal conflicts={mergeConflicts.conflicts} onResolve={resolveConflicts} />}

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
              <label className="form-label">ルームPIN（講師から指定された6桁の数字）</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                className="form-input"
                value={loginInput.pin || ''}
                onChange={e => setLoginInput({...loginInput, pin: e.target.value.replace(/\D/g, '')})}
                placeholder="例: 123456"
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
                const cleanPin = (loginInput.pin || '').trim();
                if (!cleanRoom || !cleanPlayer || !/^\d{6}$/.test(cleanPin)) {
                  alert("ルームID・6桁のPIN・プレイヤー名を入力してください");
                  return;
                }

                // 過去のゲームデータ（仕訳、期首変更、2期以降の進捗など）が残っているかチェック
                const hasExistingData = Object.values(periods).some(p => p.ledger.length > 0) ||
                                        currentPeriod > 1 ||
                                        periods[1].carryover.capital !== 300 ||
                                        periods[1].carryover.loan !== 0;

                // 参加確定処理（localStorage＋stateへ反映してモーダルを閉じる）
                let finalName = cleanPlayer; // 同名の別人がいた場合、サーバーが「名前(2)」に変える
                const commitJoin = () => {
                  safeStorage.setItem('mg_room_id', cleanRoom);
                  safeStorage.setItem('mg_player_id', finalName);
                  safeStorage.setItem('mg_offline_mode', 'false');
                  setRoomId(cleanRoom);
                  setPlayerId(finalName);
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
                        freshData[i] = createDefaultPeriodData();
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

                // サーバーへ参加（PIN検証・端末トークン発行・同名なら名前を自動でずらす）
                let joined;
                try {
                  joined = await joinRoom(cleanRoom, cleanPlayer, cleanPin);
                } catch (err) {
                  if (err.status === 403) alert('ルームPINが正しくありません。');
                  else if (err.status === 404) alert('そのルームIDは見つかりません。講師にルームIDを確認してください。');
                  else if (err.status === 429) alert(err.message);
                  else alert('サーバーに接続できません（' + err.message + '）。通信を確認するか、「参加せずに一人でプレイする」を使ってください。');
                  return;
                }
                finalName = joined.player;
                if (joined.renamed) {
                  alert(`『${cleanPlayer}』は既に使われていたため、『${finalName}』という名前で参加しました。`);
                }
                safeStorage.setItem('mg_last_synced_at', '0');

                if (joined.created) {
                  // 新規登録: 版は0から。ローカルの既存データの扱いを従来どおり確認する
                  markSynced(cleanRoom, finalName, 0, {});
                  legacyJoinFlow();
                  return;
                }

                // 以前この端末で参加していた名前への再参加
                const backup = joined.record?.backup;
                if (!hasExistingData && backup && backup.periods) {
                  const restored = normalizePeriods(backup.periods);
                  setPeriods(restored);
                  setCurrentPeriod(backup.currentPeriod || 1);
                  safeStorage.setItem('mg_periods_data', JSON.stringify(restored));
                  safeStorage.setItem('mg_current_period', String(backup.currentPeriod || 1));
                  setTombstones(backup.deletedIds || []);
                  prevPeriodsRef.current = restored;
                  markSynced(cleanRoom, finalName, joined.record.version, buildBaseHashes(restored));
                  setActiveTab('ledger');
                }
                // ローカルにデータがある場合はそのまま参加し、初回同期で自動マージする
                commitJoin();
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
