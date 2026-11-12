import { CATEGORIES } from './cashledger/constants';
import CompanyBoardMinimap from './CompanyBoardMinimap';
import { useState, useRef, useEffect } from 'react';
import { buildTransactionEntries, toSafeInt } from './cashledger/buildTransactionEntries';
import {
  entryToFormState,
  getEntryGroup,
  getGroupVoucherNos,
  removeEntryWithPositions,
  restoreRemovedEntries
} from './cashledger/editTransaction';
import AddTransactionModal from './cashledger/AddTransactionModal';
import TimelineList from './cashledger/TimelineList';
import Toast from './Toast';

function CashLedger({ carryover, ledger, onUpdateLedger, results, currentPeriod, transactionMode, setTransactionMode, enableCredit = true }) {
  const modalContentRef = useRef(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 「入力し直す」で削除した取引の情報。null なら通常の新規追加。
  // { voucherNo, voucherLabel, note }
  //   voucherNo … 元の伝票番号（次の登録1回に引き継ぎ、番号の付け替わりを防ぐ）
  //   note      … 元の値を完全には事前入力できなかったときの案内
  const [redoInfo, setRedoInfo] = useState(null);

  // 登録時の検証エラー（モーダル内の送信ボタン付近にインライン表示する）。
  // { message, key } … key は同じ文言が続いたときにも再スクロールさせるため。
  const [formError, setFormError] = useState(null);

  // 画面下部のトースト（削除の取り消し・自動計上のお知らせなど）
  const [toast, setToast] = useState(null);

  // 「元に戻す」は数秒後に押されるため、押した時点の最新 ledger / 期を参照する
  const ledgerRef = useRef(ledger);
  const periodRef = useRef(currentPeriod);
  useEffect(() => {
    ledgerRef.current = ledger;
    periodRef.current = currentPeriod;
  }, [ledger, currentPeriod]);

  const [selectedCategory, setSelectedCategory] = useState('キ'); // Default to現金売上
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [isFireSale, setIsFireSale] = useState(false);
  const [fireSaleQty, setFireSaleQty] = useState('');

  // 採用用のステート
  const [workersHired, setWorkersHired] = useState('');
  const [salesmenHired, setSalesmenHired] = useState('');
  const [hirePrice, setHirePrice] = useState(5);
  const [productionKo, setProductionKo] = useState('');
  const [productionSa, setProductionSa] = useState('');

  // 配置転換用のステート
  const [transferW2S, setTransferW2S] = useState(0); // ワーカー → セールスマン
  const [transferS2W, setTransferS2W] = useState(0); // セールスマン → ワーカー

  // 売掛割引と期首一括用のステート
  const [factoringAmount, setFactoringAmount] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');

  const [riskTab, setRiskTab] = useState('positive'); // positive, negative
  const [riskAction, setRiskAction] = useState('special_sale');
  const [riskQty, setRiskQty] = useState('');
  const [riskPrice, setRiskPrice] = useState('');
  const [riskMarket, setRiskMarket] = useState('sapporo');
  const [riskMonopolyAdQtys, setRiskMonopolyAdQtys] = useState({
    sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0
  });

  // 複数市場購入用のステート
  const [marketQuantities, setMarketQuantities] = useState({
    sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0
  });

  // 商品販売用のステート
  const [salesData, setSalesData] = useState({
    sapporo: { qty: 0, price: '' },
    sendai: { qty: 0, price: '' },
    tokyo: { qty: 0, price: '' },
    nagoya: { qty: 0, price: '' },
    osaka: { qty: 0, price: '' },
    fukuoka: { qty: 0, price: '' }
  });

  // 機械購入用のステート
  const [machineQuantities, setMachineQuantities] = useState({
    large: 0, small: 0, attachment: 0
  });

  // 機械売却(イ)用のステート
  const [machineSaleQuantities, setMachineSaleQuantities] = useState({
    large: 0, small: 0, attachment: 0
  });

  // 広告購入用のステート
  const [adQuantities, setAdQuantities] = useState({
    ad5: 0, ad10: 0, ad20: 0
  });

  // 研究開発用のステート
  const [rdPrice, setRdPrice] = useState(20);

  // 緑チップ用のステート
  const [greenChips, setGreenChips] = useState({
    pac: 0,
    md: 0,
    research: 0
  });

  // 電卓の状態
  const [calcInput, setCalcInput] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

  // フォームリセット関数
  const resetForm = () => {
    setQuantity('');
    setPrice('');
    setAmount('');
    setIsFireSale(false);
    setFireSaleQty('');
    setWorkersHired('');
    setSalesmenHired('');
    setHirePrice(5);
    setProductionKo('');
    setProductionSa('');
    setFactoringAmount('');
    setRepaymentAmount('');
    setRiskTab('positive');
    setRiskAction('special_sale');

    setRiskQty('');
    setRiskPrice('');
    setRiskMarket('sapporo');
    setRiskMonopolyAdQtys({ sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0 });
    setTransferW2S(0);
    setTransferS2W(0);
    setMarketQuantities({ sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0 });
    setMachineQuantities({ large: 0, small: 0, attachment: 0 });
    setMachineSaleQuantities({ large: 0, small: 0, attachment: 0 });
    setAdQuantities({ ad5: 0, ad10: 0, ad20: 0 });
    setSalesData({
      sapporo: { qty: 0, price: '' }, sendai: { qty: 0, price: '' }, tokyo: { qty: 0, price: '' },
      nagoya: { qty: 0, price: '' }, osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
    });
    setGreenChips({ pac: 0, md: 0, research: 0 });
    setCalcInput('');
  };

  // 新規取引の追加／編集の保存。
  // 中核ロジックは純粋関数（buildTransactionEntries / buildEditedLedger）に委譲し、ここでは
  // 「フォーム値の収集 → 純粋関数呼び出し → エラー表示・ledger 更新・後処理」だけを行う。
  const handleAddTransaction = (e) => {
    e.preventDefault();

    const form = {
      selectedCategory, quantity, price, amount, isFireSale, fireSaleQty,
      workersHired, salesmenHired, hirePrice, productionKo, productionSa,
      transferW2S, transferS2W, factoringAmount, repaymentAmount,
      riskTab, riskAction, riskQty, riskPrice, riskMonopolyAdQtys,
      marketQuantities, salesData, machineQuantities, machineSaleQuantities,
      adQuantities, rdPrice, greenChips
    };
    const ctx = { carryover, ledger, results, currentPeriod, transactionMode };

    // 販売数の上限（在庫・販売能力）を手入力にも適用する。MAX ボタンと同じ計算。
    const limitError = getSalesLimitError(form);
    if (limitError) {
      setFormError({ message: limitError, key: Date.now() });
      return;
    }

    const result = buildTransactionEntries(
      { ...ctx, redoVoucherNo: redoInfo?.voucherNo ?? null },
      form
    );

    if (result.error) {
      setFormError({ message: result.error, key: Date.now() });
      return;
    }
    setFormError(null);

    onUpdateLedger(result.ledger);

    // お知らせ（借入利息の自動計上など）は1つのトーストにまとめる。
    // 新しい登録があったら、直前の削除の「元に戻す」は無効にする
    // （戻すと新しい取引と伝票番号が重なりうるため）。
    const infos = result.infoAlerts || [];
    // 元番号の引き継ぎは1回だけ（2件目以降は通常の連番）
    if (redoInfo) setRedoInfo(null);
    setToast(infos.length > 0 ? { id: Date.now(), message: infos.join('\n'), duration: 6000 } : null);

    // フォームリセット
    resetForm();
    setGreenChips({ pac: 0, md: 0, research: 0 });
    setCalcInput('');
    // 期首処理はカテゴリを既定に戻す
    if (result.resetSelectedCategory) setSelectedCategory('キ');
    if (modalContentRef.current) modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // モーダルを閉じる。「入力し直す」を途中でやめた場合は、伝票番号の引き継ぎも破棄する
  // （別カテゴリの次の登録に元番号が誤って付くのを防ぐ）。
  const closeModal = () => {
    setRedoInfo(null);
    setFormError(null);
    setShowAddModal(false);
  };

  // 新規追加でモーダルを開く
  const openAddModal = (category) => {
    setRedoInfo(null);
    setFormError(null);
    setSelectedCategory(category);
    setShowAddModal(true);
  };

  // 取引の削除。確認ダイアログは出さず、代わりに「元に戻す」付きのトーストを出す。
  // 組（借入＋自動利息など）は組ごと削除し、元に戻すときも組ごと元の位置へ戻す。
  const handleDeleteTransaction = (id) => {
    const entryToDelete = ledger.find(t => t.id === id);
    if (!entryToDelete) return;

    const { ledger: nextLedger, removed } = removeEntryWithPositions(ledger, entryToDelete);
    onUpdateLedger(nextLedger);

    const nos = getGroupVoucherNos(removed.map(r => r.entry));
    const catMeta = CATEGORIES[entryToDelete.category];
    const name = entryToDelete.customName || catMeta?.actionName || catMeta?.label || entryToDelete.category;
    const what = nos.length > 0 ? nos.map(n => `#${n}`).join('・') : `「${name}」`;
    const periodAtDelete = currentPeriod;

    setToast({
      id: Date.now(),
      message: `${what} を削除しました`,
      actionLabel: '元に戻す',
      onAction: () => {
        // 期を切り替えた後に押された場合は、別の期の帳簿へ混ぜないよう何もしない
        if (periodRef.current !== periodAtDelete) return;
        onUpdateLedger(restoreRemovedEntries(ledgerRef.current, removed));
      }
    });
  };

  // 取引の「入力し直す」。
  //
  // 確認後に元取引を削除し、元の項目を選んだ状態で入力画面を開く（復元できる値は事前入力）。
  // 1回の登録で複数行になった取引（借入＋利息、独占販売の市場別行、生産のコ＋サ など）は
  // 全行まとめて削除し、一部が残って二重計上になるのを防ぐ。
  // 元の伝票番号は次の登録1回に引き継ぐ。
  const handleRedoTransaction = (id) => {
    const entry = ledger.find(t => t.id === id);
    if (!entry) return;

    const group = getEntryGroup(ledger, entry);
    const nos = getGroupVoucherNos(group);
    const label = nos.length > 0 ? nos.map(n => `#${n}`).join('・') : 'この取引';
    const extra = group.length > 1 ? `\n（同じ登録でできた${group.length}行をまとめて削除します）` : '';
    if (!window.confirm(`${label} を削除して、入力し直しますか？${extra}`)) return;

    const { form: restored, note } = entryToFormState(entry, group);
    const { ledger: nextLedger } = removeEntryWithPositions(ledger, entry);
    onUpdateLedger(nextLedger);
    // 削除済みの取引を「元に戻す」トーストが残っていると、引き継いだ番号と重なりうるため閉じる
    setToast(null);

    resetForm();
    // setSelectedCategory 直呼びではなく handleCategorySelect を通す。
    // コ=単価2・サ=単価1 などのプリセットが入らないと、単価欄が disabled かつ空のまま
    // 金額が常に0になるため。プリセットの後に復元値で上書きする。
    handleCategorySelect(restored.selectedCategory);
    applyRestoredForm(restored);

    setRedoInfo({ voucherNo: nos.length > 0 ? nos[0] : null, voucherLabel: nos.length > 0 ? label : '', note });
    setFormError(null);
    setShowCalculator(false);
    setShowAddModal(true);
    if (modalContentRef.current) modalContentRef.current.scrollTo({ top: 0, behavior: 'auto' });
  };

  // entryToFormState が返した値をフォーム state へ反映する（含まれないキーは初期値のまま）
  const applyRestoredForm = (restored) => {
    const setters = {
      quantity: setQuantity, price: setPrice, amount: setAmount,
      isFireSale: setIsFireSale, fireSaleQty: setFireSaleQty,
      workersHired: setWorkersHired, salesmenHired: setSalesmenHired, hirePrice: setHirePrice,
      productionKo: setProductionKo, productionSa: setProductionSa,
      transferW2S: setTransferW2S, transferS2W: setTransferS2W,
      factoringAmount: setFactoringAmount, repaymentAmount: setRepaymentAmount,
      riskTab: setRiskTab, riskAction: setRiskAction, riskQty: setRiskQty, riskPrice: setRiskPrice,
      riskMonopolyAdQtys: setRiskMonopolyAdQtys,
      marketQuantities: setMarketQuantities, salesData: setSalesData,
      machineQuantities: setMachineQuantities, machineSaleQuantities: setMachineSaleQuantities,
      adQuantities: setAdQuantities, rdPrice: setRdPrice, greenChips: setGreenChips
    };
    Object.entries(restored).forEach(([key, value]) => {
      if (setters[key]) setters[key](value);
    });
  };

  // 取引カテゴリ切り替え時の自動表示制御
  const handleCategorySelect = (symbol) => {
    setSelectedCategory(symbol);
    setFormError(null);
    setIsFireSale(false);
    setFireSaleQty('');
    // 数量が必要ない科目の場合は数量と単価をリセット
    const needsQty = ["キ", "ネ", "コ", "サ", "ツ", "ノ", "ケ", "セ", "チ", "保険", "MD", "リサーチ", "PAC", "配置転換"].includes(symbol);
    if (!needsQty) {
      setQuantity('');
      setPrice('');
      setProductionKo('');
      setProductionSa('');
    } else {
      if (symbol === "コ") setPrice('2');
      if (symbol === "サ") setPrice('1');
      if (symbol === "保険") setPrice('5');
    }
    // 事故の場合は専用の初期値をセット
    if (symbol === "製造ミス") setQuantity('1');
    if (symbol === "盗難") setQuantity('2');
    if (symbol === "火災") setQuantity('');
  };

  // 数量・単価変更時に金額を自動計算。
  // 入力途中の空文字は許容しつつ、値は0以上の整数に正規化する
  // （Infinity/NaN・小数個の混入を入口で防ぐ）。
  const handleQtyPriceChange = (type, val) => {
    const sanitized = val === '' ? '' : String(toSafeInt(val));
    if (type === 'qty') {
      setQuantity(sanitized);
      const q = Number(sanitized) || 0;
      const p = Number(price) || 0;
      setAmount((q * p).toString());
    } else {
      setPrice(sanitized);
      const q = Number(quantity) || 0;
      const p = Number(sanitized) || 0;
      setAmount((q * p).toString());
    }
  };

  // 電卓ボタンの処理
  const handleCalcBtnClick = (val) => {
    if (val === 'C') {
      setCalcInput('');
      setAmount('');
    } else if (val === '=') {
      try {
        // 安全な評価 (数値、小数点、四則演算記号のみ許容)
        if (/^[0-9.+\-*/\s()]+$/.test(calcInput)) {
          const evalResult = Function(`"use strict"; return (${calcInput})`)();
          // 1/0=Infinity や 0/0=NaN は金額に反映しない（保存されると
          // JSON化で null になりリロード時に画面が壊れるため、エラー表示で拒否する）
          if (!Number.isFinite(evalResult)) {
            setCalcInput('Error');
            return;
          }
          // 金額は整数万円がゲーム仕様のため、小数の計算結果は四捨五入して反映する
          // （丸めた値を電卓表示にも出し、入力欄との食い違いを見せない）。
          // 負の結果はそのまま通し、登録時の「マイナスの金額」ガードに説明させる。
          const rounded = Math.round(evalResult);
          setAmount(rounded.toString());
          setCalcInput(rounded.toString());
        } else {
          setCalcInput('Error');
        }
      } catch {
        setCalcInput('Error');
      }
    } else {
      setCalcInput(prev => prev + val);
    }
  };

  // カテゴリ別の電卓表示状態と数量必要チェック
  const currentCatMeta = CATEGORIES[selectedCategory] || {};
  const isQtyNeeded = ["キ", "ネ", "コ", "サ", "ツ", "ノ", "ケ"].includes(selectedCategory);

  const visibleLedger = ledger.filter(entry => entry.category !== '期首処理');


  // 単価情報 (P, V, M) の計算
  const salesQty = results?.prod?.salesCount || 0;
  const salesRev = results?.pl?.salesRevenue || 0;
  const varCost = results?.pl?.variableCost || 0;
  const marginRev = results?.pl?.margin || 0;

  const avgPrice = salesQty > 0 ? (salesRev / salesQty) : 0;
  const varPrice = salesQty > 0 ? (varCost / salesQty) : 0;
  const marginPrice = salesQty > 0 ? (marginRev / salesQty) : 0;

  const avgPriceDisplay = salesQty > 0 ? `¥${avgPrice.toFixed(1)}万` : '-';
  const varPriceDisplay = salesQty > 0 ? `¥${varPrice.toFixed(1)}万` : '-';
  const marginPriceDisplay = salesQty > 0 ? `¥${marginPrice.toFixed(1)}万` : '-';

  // モーダルへ渡すフォーム値・setter・派生値のバンドル
  const modalForm = {
    selectedCategory, quantity, price, amount, isFireSale, fireSaleQty,
    workersHired, salesmenHired, hirePrice, productionKo, productionSa,
    transferW2S, transferS2W, factoringAmount, repaymentAmount,
    riskTab, riskAction, riskQty, riskPrice, riskMarket, riskMonopolyAdQtys,
    marketQuantities, salesData, machineQuantities, machineSaleQuantities,
    adQuantities, rdPrice, greenChips, calcInput, showCalculator
  };
  const modalSet = {
    setQuantity, setAmount, setIsFireSale, setFireSaleQty,
    setWorkersHired, setSalesmenHired, setHirePrice, setProductionKo, setProductionSa,
    setTransferW2S, setTransferS2W, setFactoringAmount, setRepaymentAmount,
    setRiskTab, setRiskAction, setRiskQty, setRiskPrice, setRiskMonopolyAdQtys,
    setMarketQuantities, setSalesData, setMachineQuantities, setMachineSaleQuantities,
    setAdQuantities, setRdPrice, setGreenChips, setShowCalculator
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 財務サマリーカード */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          第 {visibleLedger.length > 0 ? (visibleLedger.length) : 0} 取引完了
        </span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>現在の手元現金残高</span>
          <span className="electric-number" style={{ fontSize: '2rem', color: results.bookEndingCash < 0 ? '#ef4444' : 'var(--text-primary)' }}>
            ¥ {results.bookEndingCash.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: '500' }}>万</span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>現在までの経常利益 (G)</span>
          <span className="electric-number" style={{ fontSize: '1.2rem', color: (results?.pl?.operatingProfit || 0) >= 0 ? 'var(--mg-pink)' : '#ef4444' }}>
            {(results?.pl?.operatingProfit || 0) >= 0 ? '+' : ''}¥ {results?.pl?.operatingProfit || 0} 万
          </span>
        </div>

        {/* 単価情報 (P, V, M) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border-glass)',
          paddingTop: '8px',
          marginTop: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>平均単価 (P)</div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{avgPriceDisplay}</strong>
          </div>
          <div style={{ width: '1px', height: '18px', background: 'var(--border-glass)' }}></div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>変動単価 (V)</div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{varPriceDisplay}</strong>
          </div>
          <div style={{ width: '1px', height: '18px', background: 'var(--border-glass)' }}></div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>粗利単価 (M)</div>
            <strong style={{ color: 'var(--mg-pink)', fontSize: '0.85rem' }}>{marginPriceDisplay}</strong>
          </div>
        </div>
      </div>

      {/* 会社盤ミニマップのアコーディオン */}
      <div style={{ margin: '8px 16px' }}>
        <button
          type="button"
          onClick={() => setShowMinimap(!showMinimap)}
          className="btn-premium btn-secondary"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '0.78rem',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(0, 176, 255, 0.2)',
            background: showMinimap ? 'rgba(0, 176, 255, 0.1)' : 'rgba(0, 0, 0, 0.02)',
            color: showMinimap ? '#00e676' : 'var(--text-secondary)'
          }}
        >
          {showMinimap ? "盤面ミニマップを非表示 ▽" : "🔮 リアルタイム会社盤ミニマップを表示 ▷"}
        </button>
        {showMinimap && (
          <div style={{ marginTop: '8px' }}>
            <CompanyBoardMinimap results={results} />
          </div>
        )}
      </div>

      {/* 掛け取引モードへの切り替えバナー */}
      {enableCredit && currentPeriod >= 2 && transactionMode === 'cash' && (
        <div style={{ margin: '8px 16px', padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.1) 0%, rgba(103, 58, 183, 0.1) 100%)', border: '1px solid rgba(156, 39, 176, 0.4)' }}>
          <h4 style={{ fontSize: '0.95rem', color: '#e040fb', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🚀</span> 掛け取引（売掛・買掛）が解禁されました！
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
            2期目以降は、会社の信用力があがり「掛け取引」での販売・仕入が可能になります。<br/>
            <span style={{ color: '#ff5252' }}>※ 一度「掛け取引」を開始すると以降はずっと掛け取引となり、現金取引（現金販売・現金仕入）には戻せません。</span>
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("これ以降すべての「商品販売」「材料仕入」が掛け取引（売掛・買掛）になります。本当によろしいですか？\n※元の現金取引には戻せません。")) {
                setTransactionMode('credit');
              }
            }}
            className="btn-premium"
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', borderRadius: '8px', background: 'linear-gradient(135deg, #9c27b0, #673ab7)', color: 'white', fontWeight: 'bold', border: 'none' }}
          >
            掛け取引モードを開始する
          </button>
        </div>
      )}

      {/* 期首の一括処理アラート/ボタン（第2期以降のみ表示かつ、未処理の場合） */}
      {currentPeriod > 1 && !ledger.some(entry => entry.category === '期首処理') && (
        <div style={{ margin: '0 16px 8px 16px' }}>
          <button
            type="button"
            onClick={() => openAddModal('期首処理')}
            className="btn-premium"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.85rem',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%)',
              border: '1px solid rgba(255, 193, 7, 0.5)',
              color: '#ffc107',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(255, 193, 7, 0.1)'
            }}
          >
            🌅 今期の「期首一括処理」を行う
          </button>
        </div>
      )}



      {/* 取引履歴タイムライン */}
      <TimelineList
        visibleLedger={visibleLedger}
        carryoverCash={carryover.cash}
        onDelete={handleDeleteTransaction}
        onRedo={handleRedoTransaction}
      />

      {/* 新規取引追加フローティングボタン(FAB) */}
      <button
        onClick={() => openAddModal(transactionMode === 'credit' ? 'ノ' : 'ツ')}
        className="fab-btn"
        style={{ position: 'absolute' }}
        aria-label="Add transaction"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* ワンタップ追加ボトムシート（モーダル） */}
      {showAddModal && (
        <AddTransactionModal
          carryover={carryover}
          ledger={ledger}
          results={results}
          currentPeriod={currentPeriod}
          transactionMode={transactionMode}
          enableCredit={enableCredit}
          currentCatMeta={currentCatMeta}
          isQtyNeeded={isQtyNeeded}
          modalContentRef={modalContentRef}
          form={modalForm}
          set={modalSet}
          handleAddTransaction={handleAddTransaction}
          handleCategorySelect={handleCategorySelect}
          handleQtyPriceChange={handleQtyPriceChange}
          handleCalcBtnClick={handleCalcBtnClick}
          redoInfo={redoInfo}
          formError={formError}
          setShowAddModal={(open) => {
            if (!open) closeModal();
            else setShowAddModal(true);
          }}
        />
      )}

      {/* 画面下部のトースト（削除の取り消し・自動計上のお知らせ） */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          duration={toast.duration ?? 5000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default CashLedger;
