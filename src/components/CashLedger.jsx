import { CATEGORIES, SALARY_TABLE } from '../utils/calculations';
import CompanyBoardMinimap from './CompanyBoardMinimap';
import { useState } from 'react';

const MARKETS = [
  { id: 'sapporo', name: '札幌', basePrice: 10 },
  { id: 'sendai', name: '仙台', basePrice: 11 },
  { id: 'tokyo', name: '東京', basePrice: 12 },
  { id: 'nagoya', name: '名古屋', basePrice: 13 },
  { id: 'osaka', name: '大阪', basePrice: 14 },
  { id: 'fukuoka', name: '福岡', basePrice: 15 },
  { id: 'stocker', name: 'ストッカー', basePrice: 16 }
];

const MACHINES = [
  { id: 'large', name: '大型機械', basePrice: 200 },
  { id: 'small', name: '小型機械', basePrice: 100 },
  { id: 'attachment', name: 'アタッチメント', basePrice: 20 }
];

const ADS = [
  { id: 'ad5', name: '広告 (5)', basePrice: 5 },
  { id: 'ad10', name: '広告 (10)', basePrice: 10 },
  { id: 'ad20', name: '広告 (20)', basePrice: 20 }
];

function CashLedger({ carryover, ledger, onUpdateLedger, results, currentPeriod }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [voucherNo, setVoucherNo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('キ'); // Default to現金売上
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  
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
  const [riskSaleType, setRiskSaleType] = useState('cash'); // cash(キ) or credit(ネ)
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

  // 期末処理モーダル用のステート
  const [showPeriodEndModal, setShowPeriodEndModal] = useState(false);
  const [periodEndWorkers, setPeriodEndWorkers] = useState('');
  const [periodEndSalesmen, setPeriodEndSalesmen] = useState('');

  // フォームリセット関数
  const resetForm = () => {
    setVoucherNo('');
    setQuantity('');
    setPrice('');
    setAmount('');
    setWorkersHired('');
    setSalesmenHired('');
    setHirePrice(5);
    setProductionKo('');
    setProductionSa('');
    setFactoringAmount('');
    setRepaymentAmount('');
    setRiskTab('positive');
    setRiskAction('special_sale');
    setRiskSaleType('cash');
    setRiskQty('');
    setRiskPrice('');
    setRiskMarket('sapporo');
    setRiskMonopolyAdQtys({ sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0 });
    setTransferW2S(0);
    setTransferS2W(0);
    setMarketQuantities({ sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0, stocker: 0 });
    setMachineQuantities({ large: 0, small: 0, attachment: 0 });
    setAdQuantities({ ad5: 0, ad10: 0, ad20: 0 });
    setSalesData({
      sapporo: { qty: 0, price: '' }, sendai: { qty: 0, price: '' }, tokyo: { qty: 0, price: '' },
      nagoya: { qty: 0, price: '' }, osaka: { qty: 0, price: '' }, fukuoka: { qty: 0, price: '' }
    });
    setGreenChips({ pac: 0, md: 0, research: 0 });
    setCalcInput('');
  };

  // 新規取引の追加
  const handleAddTransaction = (e) => {

    e.preventDefault();
    if (!selectedCategory) {
      alert("項目を選択してください");
      return;
    }
    
    let finalAmount = 0;
    let finalQuantity = 0;
    let finalPrice = 0;

    if (["キ", "ネ"].includes(selectedCategory)) {
      let totalQty = 0;
      let totalAmount = 0;
      let hasError = false;
      
      MARKETS.filter(m => m.id !== 'stocker').forEach(m => {
        const qty = salesData[m.id]?.qty || 0;
        const prc = Number(salesData[m.id]?.price) || 0;
        if (qty > 0) {
          if (prc <= 0) {
            alert(`${m.name}の販売単価を入力してください`);
            hasError = true;
          } else {
            totalQty += qty;
            totalAmount += qty * prc;
          }
        }
      });

      if (hasError) return;

      if (totalQty === 0) {
        alert("販売する数量と単価を入力してください");
        return;
      }

      finalQuantity = totalQty;
      finalAmount = totalAmount;
      finalPrice = 0;
    } else if (selectedCategory === "売掛割引") {
      const discountVal = Number(factoringAmount) || 0;
      if (discountVal <= 0) {
        alert("割引する売掛金の金額を入力してください");
        return;
      }
      const fee = Math.round(discountVal * 0.05);
      const newTransactions = [];
      newTransactions.push({
        id: Date.now().toString() + "-ar",
        category: "ア",
        quantity: 1,
        amount: discountVal,
        price: discountVal,
        timestamp: new Date().toISOString()
      });
      if (fee > 0) {
        newTransactions.push({
          id: Date.now().toString() + "-fee",
          category: "タ",
          quantity: 1,
          amount: fee,
          price: fee,
          timestamp: new Date().toISOString()
        });
      }
      onUpdateLedger([...ledger, ...newTransactions]);
      resetForm();
      setShowAddModal(false);
      return;
    } else if (selectedCategory === "リスクカード") {
      const newTransactions = [];
      const timestamp = new Date().toISOString();
      const q = Number(riskQty) || 0;
      const p = Number(riskPrice) || 0;
      
      if (riskTab === 'positive') {
        if (riskAction === 'monopoly_ad') {
          const adPrices = { sapporo: 40, sendai: 36, tokyo: 32, nagoya: 28, osaka: 24, fukuoka: 20 };
          const cat = riskSaleType === 'credit' ? 'ネ' : 'キ';
          let totalQ = 0;
          Object.entries(riskMonopolyAdQtys).forEach(([market, qty]) => {
            if (qty > 0) {
              totalQ += qty;
              newTransactions.push({ id: Date.now().toString() + "-sale-" + market, category: cat, quantity: qty, amount: qty * adPrices[market], price: adPrices[market], timestamp: new Date(Date.now() + Math.random()).toISOString() });
            }
          });
          if (totalQ <= 0) {
            alert("販売する数量を入力してください");
            return;
          }
        } else if (riskAction === 'monopoly_salesman' || riskAction === 'rd_success') {
          if (q <= 0 || p <= 0) {
            alert("販売する数量と単価を入力してください");
            return;
          }
          const cat = riskSaleType === 'credit' ? 'ネ' : 'キ';
          newTransactions.push({ id: Date.now().toString() + "-sale", category: cat, quantity: q, amount: q * p, price: p, timestamp });
        } else if (riskAction === 'special_mat' || riskAction === 'common_mat') {
          if (q <= 0) {
            alert("購入する数量を入力してください");
            return;
          }
          const price = riskAction === 'special_mat' ? 10 : 12;
          newTransactions.push({ id: Date.now().toString() + "-mat", category: "ツ", quantity: q, amount: q * price, price: price, timestamp });
        } else if (riskAction === 'special_ad') {
          if (q <= 0) {
            alert("購入する口数を入力してください");
            return;
          }
          newTransactions.push({ id: Date.now().toString() + "-ad", category: "セ", quantity: q, amount: q * 5, price: 5, timestamp });
        }
      } else {
        if (riskAction === 'retire_worker') {
          newTransactions.push({ id: Date.now().toString() + "-resw", category: "退職", workersResigned: 1, salesmenResigned: 0, amount: 0, quantity: 1, price: 0, timestamp });
          newTransactions.push({ id: Date.now().toString() + "-reswp", category: "ソ", amount: 5, quantity: 1, price: 5, timestamp: new Date(Date.now() + 1).toISOString() });
        } else if (riskAction === 'retire_salesman') {
          newTransactions.push({ id: Date.now().toString() + "-ress", category: "退職", workersResigned: 0, salesmenResigned: 1, amount: 0, quantity: 1, price: 0, timestamp });
          newTransactions.push({ id: Date.now().toString() + "-ressp", category: "ソ", amount: 5, quantity: 1, price: 5, timestamp: new Date(Date.now() + 1).toISOString() });
        } else if (riskAction === 'claim') {
          newTransactions.push({ id: Date.now().toString() + "-claim", category: "セ", amount: 5, quantity: 1, price: 5, timestamp });
        } else if (riskAction === 'machine_break' || riskAction === 'design_trouble') {
          newTransactions.push({ id: Date.now().toString() + "-trouble", category: "ス", amount: 5, quantity: 1, price: 5, timestamp });
        } else if (riskAction === 'rd_fail') {
          newTransactions.push({ id: Date.now().toString() + "-rdfail", category: "研究開発失敗", amount: 0, quantity: 1, price: 0, timestamp });
        } else if (riskAction === 'theft') {
          newTransactions.push({ id: Date.now().toString() + "-theft", category: "盗難", quantity: 1, amount: 0, price: 0, timestamp });
        } else if (riskAction === 'miss') {
          newTransactions.push({ id: Date.now().toString() + "-miss", category: "製造ミス", quantity: 1, amount: 0, price: 0, timestamp });
        } else if (riskAction === 'fire') {
          newTransactions.push({ id: Date.now().toString() + "-fire", category: "火災", quantity: 1, amount: 0, price: 0, timestamp });
        }
      }
      
      onUpdateLedger([...ledger, ...newTransactions]);
      resetForm();
      setShowAddModal(false);
      return;
    } else if (selectedCategory === "期首処理") {
      const newTransactions = [];
      const timestamp = new Date().toISOString();
      const a = results?.carryover?.receivables || 0;
      if (a > 0) {
        newTransactions.push({ id: Date.now().toString() + "-ar", category: "ア", quantity: 1, amount: a, price: a, timestamp });
      }
      const p = results?.carryover?.payables || 0;
      if (p > 0) {
        newTransactions.push({ id: Date.now().toString() + "-nu", category: "ヌ", quantity: 1, amount: p, price: p, timestamp });
      }
      const t = results?.carryover?.taxes || 0;
      if (t > 0) {
        newTransactions.push({ id: Date.now().toString() + "-ni", category: "ニ", quantity: 1, amount: t, price: t, timestamp });
      }
      const loan = results?.carryover?.loan || 0;
      if (loan > 0) {
        const rate = (currentPeriod >= 4) ? 0.05 : 0.10;
        const interest = Math.round(loan * rate);
        if (interest > 0) {
          newTransactions.push({ id: Date.now().toString() + "-ta", category: "タ", quantity: 1, amount: interest, price: interest, timestamp });
        }
      }
      const repay = Number(repaymentAmount) || 0;
      if (repay > 0) {
        newTransactions.push({ id: Date.now().toString() + "-na", category: "ナ", quantity: 1, amount: repay, price: repay, timestamp });
      }
      if (newTransactions.length === 0) {
        alert("決済する期首支払いがありません。");
        return;
      }
      onUpdateLedger([...ledger, ...newTransactions]);
      resetForm();
      // Reset to default category and close modal
      setSelectedCategory('キ');
      setShowAddModal(false);
      return;
    } else if (selectedCategory === "生産") {
      const koQty = Number(productionKo) || 0;
      const saQty = Number(productionSa) || 0;
      
      if (koQty === 0 && saQty === 0) {
        alert("投入または完成する数量を入力してください");
        return;
      }
      
      const newTransactions = [];
      if (saQty > 0) {
        newTransactions.push({
          id: Date.now().toString() + "-sa",
          category: "サ",
          quantity: saQty,
          amount: saQty * 1,
          price: 1,
          timestamp: new Date().toISOString()
        });
      }
      if (koQty > 0) {
        newTransactions.push({
          id: Date.now().toString() + "-ko",
          category: "コ",
          quantity: koQty,
          amount: koQty * 2,
          price: 2,
          timestamp: new Date().toISOString()
        });
      }
      
      onUpdateLedger([...ledger, ...newTransactions]);
      resetForm();
      return; // Skip normal add
    } else if (["ツ", "ノ"].includes(selectedCategory)) {
      const hasMD = ledger.some(e => e.category === "MD");
      let totalQty = 0;
      let totalAmount = 0;
      
      MARKETS.forEach(m => {
        const q = marketQuantities[m.id] || 0;
        if (q > 0) {
          totalQty += q;
          const discountedPrice = (hasMD && m.id !== 'stocker') ? m.basePrice - 2 : m.basePrice;
          totalAmount += q * discountedPrice;
        }
      });

      if (totalQty === 0) {
        alert("購入する数量を入力してください");
        return;
      }

      finalQuantity = totalQty;
      finalAmount = totalAmount;
      finalPrice = 0; 
    } else if (selectedCategory === "ケ") {
      let totalQty = 0;
      let totalAmount = 0;

      MACHINES.forEach(m => {
        const q = machineQuantities[m.id] || 0;
        if (q > 0) {
          totalQty += q;
          totalAmount += q * m.basePrice;
        }
      });

      if (totalQty === 0) {
        alert("購入する機械の数量を入力してください");
        return;
      }

      finalQuantity = totalQty;
      finalAmount = totalAmount;
      finalPrice = 0;
    } else if (selectedCategory === "セ") {
      let totalQty = 0;
      let totalAmount = 0;

      ADS.forEach(m => {
        const q = adQuantities[m.id] || 0;
        if (q > 0) {
          totalQty += q;
          totalAmount += q * m.basePrice;
        }
      });

      if (totalQty === 0) {
        alert("購入する広告の数量を入力してください");
        return;
      }

      finalQuantity = totalQty;
      finalAmount = totalAmount;
      finalPrice = 0;
    } else if (selectedCategory === "チ") {
      finalQuantity = 1;
      finalAmount = rdPrice;
      finalPrice = rdPrice;
    } else if (selectedCategory === "保険") {
      finalQuantity = 1;
      finalAmount = 5;
      finalPrice = 5;
    } else if (selectedCategory === "緑チップ") {
      const pacQty = greenChips.pac || 0;
      const mdQty = greenChips.md || 0;
      const researchQty = greenChips.research || 0;
      
      const totalAmount = (pacQty + mdQty + researchQty) * 10;
      if (totalAmount === 0) {
        alert("購入する緑チップの数量を入力してください");
        return;
      }
      
      let updatedLedger = [...ledger];
      
      for (let i = 0; i < pacQty; i++) {
        updatedLedger.push({
          id: Date.now().toString() + `-pac-${i}`,
          voucherNo: voucherNo || (updatedLedger.length + 1).toString(),
          category: 'PAC',
          quantity: 1,
          price: 10,
          amount: 10,
          workersHired: 0,
          salesmenHired: 0
        });
      }
      for (let i = 0; i < mdQty; i++) {
        updatedLedger.push({
          id: Date.now().toString() + `-md-${i}`,
          voucherNo: voucherNo || (updatedLedger.length + 1).toString(),
          category: 'MD',
          quantity: 1,
          price: 10,
          amount: 10,
          workersHired: 0,
          salesmenHired: 0
        });
      }
      for (let i = 0; i < researchQty; i++) {
        updatedLedger.push({
          id: Date.now().toString() + `-research-${i}`,
          voucherNo: voucherNo || (updatedLedger.length + 1).toString(),
          category: 'リサーチ',
          quantity: 1,
          price: 10,
          amount: 10,
          workersHired: 0,
          salesmenHired: 0
        });
      }
      
      onUpdateLedger(updatedLedger);
      
      resetForm();
      return;
    } else if (selectedCategory === '配置転換') {
      const w2s = Number(transferW2S) || 0;
      const s2w = Number(transferS2W) || 0;
      if (w2s === 0 && s2w === 0) {
        alert("移動する人数を選択してください");
        return;
      }
      if (w2s > (results?.workers || 0)) {
        alert("ワーカーの数が不足しています");
        return;
      }
      if (s2w > (results?.salesmen || 0)) {
        alert("セールスマンの数が不足しています");
        return;
      }
      finalQuantity = w2s + s2w;
      finalAmount = finalQuantity * 5; // 配置転換は1人あたり5万のコスト
      finalPrice = 5;
    } else {
      finalAmount = selectedCategory === '採用' 
        ? (Number(workersHired) || 0) * hirePrice + (Number(salesmenHired) || 0) * hirePrice 
        : (amount === '' ? 0 : Number(amount));
      finalQuantity = quantity === '' ? 0 : Number(quantity);
      finalPrice = price === '' ? 0 : Number(price);

      // 生産能力 (PAC) の上限バリデーション
      if (["コ", "サ"].includes(selectedCategory)) {
        if (finalQuantity > (results?.productionCapacity || 0)) {
          alert(`入力された数量 (${finalQuantity}個) が現在の生産能力（最大 ${results?.productionCapacity || 0}個）を超えています。`);
          return;
        }
      }
    }

    // 0円取引のブロック (非現金取引は除外)
    const isCashTransaction = CATEGORIES[selectedCategory]?.isCash !== false;
    const actualAmount = finalAmount || (finalQuantity * finalPrice);
    if (isCashTransaction && actualAmount <= 0 && !["火災", "製造ミス", "盗難"].includes(selectedCategory)) {
      alert("0万円の処理は登録できません。金額や数量を確認してください。");
      return;
    }

    const newEntry = {
      id: Date.now().toString(),
      voucherNo: voucherNo || (ledger.length + 1).toString(),
      category: selectedCategory,
      quantity: finalQuantity,
      price: finalPrice,
      amount: finalAmount || (finalQuantity * finalPrice),
      workersHired: selectedCategory === '採用' ? (Number(workersHired) || 0) : (selectedCategory === '配置転換' ? (Number(transferS2W) || 0) - (Number(transferW2S) || 0) : 0),
      salesmenHired: selectedCategory === '採用' ? (Number(salesmenHired) || 0) : (selectedCategory === '配置転換' ? (Number(transferW2S) || 0) - (Number(transferS2W) || 0) : 0),
      largeMachines: selectedCategory === 'ケ' ? (machineQuantities.large || 0) : 0,
      smallMachines: selectedCategory === 'ケ' ? (machineQuantities.small || 0) : 0,
      attachments: selectedCategory === 'ケ' ? (machineQuantities.attachment || 0) : 0,
      salesDetails: ["キ", "ネ"].includes(selectedCategory) ? (() => {
        const details = {};
        MARKETS.filter(m => m.id !== 'stocker').forEach(m => {
          const qty = salesData[m.id]?.qty || 0;
          const prc = Number(salesData[m.id]?.price) || 0;
          if (qty > 0 && prc > 0) details[m.id] = { qty, price: prc, name: m.name };
        });
        return details;
      })() : undefined
    };

    let updatedLedger = [...ledger, newEntry];

    // Q4. 借入時（オ）的自動利息（タ）計算と追加
    if (selectedCategory === 'オ' && finalAmount > 0) {
      // Determine max loan based on period and net assets
      const maxLoan = (currentPeriod <= 1)
        ? Number.MAX_SAFE_INTEGER
        : (currentPeriod <= 3 ? 2 : 3) * results.totalNetAssets;
      if (finalAmount > maxLoan) {
        alert(`借入金は上限 ${maxLoan} 万までです。`);
        return;
      }

      const interestRate = (currentPeriod <= 3) ? 0.10 : 0.05;
      const interestAmount = Math.floor(finalAmount * interestRate); // 通常MGでは小数点切り捨てまたはそのまま、ここでは単純に計算
      if (interestAmount > 0) {
        const interestEntry = {
          id: (Date.now() + 1).toString(),
          voucherNo: voucherNo || (ledger.length + 2).toString(),
          category: 'タ',
          quantity: 0,
          price: 0,
          amount: interestAmount,
          workersHired: 0,
          salesmenHired: 0
        };
        updatedLedger.push(interestEntry);
        // 通知を出すかアラートを出すか
        alert(`借入金 ¥${finalAmount}万に対し、${interestRate * 100}% の利息（¥${interestAmount}万）を自動で「営業外費用(タ)」として追加しました。`);
      }
    }

    onUpdateLedger(updatedLedger);
    
    // フォームリセット
    resetForm();
    setGreenChips({ pac: 0, md: 0, research: 0 });
    setCalcInput('');
    setShowAddModal(false);
  };

  // 期末処理の実行 (モーダル表示)
  const handlePeriodEnd = () => {
    // 現在の人数をデフォルトセット
    setPeriodEndWorkers((results?.workers || 0).toString());
    setPeriodEndSalesmen((results?.salesmen || 0).toString());
    setShowPeriodEndModal(true);
  };

  // 期末処理の確定
  const confirmPeriodEnd = () => {
    const newTransactions = [];
    const timestamp = new Date().toISOString();
    
    const wCount = Number(periodEndWorkers) || 0;
    const sCount = Number(periodEndSalesmen) || 0;
    const totalStaff = wCount + sCount;
    
    // 現在の期の単価を取得
    const periodKey = Math.min(5, Math.max(1, currentPeriod));
    const salaryUnit = SALARY_TABLE.normal[periodKey];
    const insuranceUnit = SALARY_TABLE.insurance[periodKey];
    
    const workerSal = wCount * salaryUnit;
    const salesmanSal = sCount * salaryUnit;
    const insurance = totalStaff * insuranceUnit;

    if (workerSal > 0) {
      newTransactions.push({ id: Date.now().toString() + "-w-sal", category: "シ", quantity: 1, amount: workerSal, price: workerSal, timestamp: new Date(Date.now() + 1).toISOString() });
    }
    if (salesmanSal > 0) {
      newTransactions.push({ id: Date.now().toString() + "-s-sal", category: "セ", quantity: 1, amount: salesmanSal, price: salesmanSal, timestamp: new Date(Date.now() + 2).toISOString() });
    }
    if (insurance > 0) {
      newTransactions.push({ id: Date.now().toString() + "-ins", category: "ソ", quantity: 1, amount: insurance, price: insurance, timestamp: new Date(Date.now() + 3).toISOString() });
    }

    const tax = results?.carryover?.taxes || 0;
    if (tax > 0) {
      newTransactions.push({ id: Date.now().toString() + "-ni", category: "ニ", quantity: 1, amount: tax, price: tax, timestamp: new Date(Date.now() + 4).toISOString() });
    }
    const loan = results?.carryover?.loan || 0;
    if (loan > 0) {
      newTransactions.push({ id: Date.now().toString() + "-na", category: "ナ", quantity: 1, amount: loan, price: loan, timestamp: new Date(Date.now() + 5).toISOString() });
    }

    if (newTransactions.length === 0) {
      alert("期末に処理する項目がありません。");
      setShowPeriodEndModal(false);
      return;
    }
    
    onUpdateLedger([...ledger, ...newTransactions]);
    setShowPeriodEndModal(false);
  };

  // 取引の削除
  const handleDeleteTransaction = (id) => {
    if (window.confirm("この取引データを削除してもよろしいですか？")) {
      const updated = ledger.filter(entry => entry.id !== id);
      onUpdateLedger(updated);
    }
  };

  // 取引カテゴリ切り替え時の自動表示制御
  const handleCategorySelect = (symbol) => {
    setSelectedCategory(symbol);
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

  // 数量・単価変更時に金額を自動計算
  const handleQtyPriceChange = (type, val) => {
    if (type === 'qty') {
      setQuantity(val);
      const q = Number(val) || 0;
      const p = Number(price) || 0;
      setAmount((q * p).toString());
    } else {
      setPrice(val);
      const q = Number(quantity) || 0;
      const p = Number(val) || 0;
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
          setAmount(evalResult.toString());
          setCalcInput(evalResult.toString());
        } else {
          setCalcInput('Error');
        }
      } catch (e) {
        setCalcInput('Error');
      }
    } else {
      setCalcInput(prev => prev + val);
    }
  };

  // カテゴリ別の電卓表示状態と数量必要チェック
  const currentCatMeta = CATEGORIES[selectedCategory] || {};
  const isQtyNeeded = ["キ", "ネ", "コ", "サ", "ツ", "ノ", "ケ"].includes(selectedCategory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 財務サマリーカード */}
      <div className="glass-card" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(30, 32, 45, 0.8) 0%, rgba(20, 22, 31, 0.9) 100%)', border: '1px solid rgba(255, 46, 147, 0.15)' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          第 {ledger.length > 0 ? (ledger.length) : 0} 取引完了
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
            background: showMinimap ? 'rgba(0, 176, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
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

      {/* 期首の一括処理アラート/ボタン（第2期以降のみ表示） */}
      {currentPeriod > 1 && (
        <div style={{ margin: '0 16px 8px 16px' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('期首処理');
              setShowAddModal(true);
            }}
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

      {/* 期末処理ボタン */}
      {currentPeriod > 1 && (
        <div style={{ margin: '0 16px 8px 16px' }}>
          <button
            type="button"
            onClick={handlePeriodEnd}
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
              background: 'linear-gradient(135deg, rgba(255, 99, 71, 0.2) 0%, rgba(255, 69, 0, 0.2) 100%)',
              border: '1px solid rgba(255, 99, 71, 0.5)',
              color: '#ff6347',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(255, 99, 71, 0.1)'
            }}
          >
            🏁 今期の「期末処理」を実行
          </button>
        </div>
      )}

      {/* 取引履歴タイムライン */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-secondary)', margin: '16px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          取引履歴タイムライン
          <span style={{ fontSize: '0.72rem', fontWeight: '500', color: 'var(--text-muted)' }}>
            期首現金: ¥{carryover.cash}万
          </span>
        </h3>
        
        {ledger.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', opacity: 0.5 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            取引データがありません。<br />
            右下の「＋」ボタンから最初の出納データを入力してください。
          </div>
        ) : (
          [...ledger].reverse().map((entry) => {
            const catMeta = CATEGORIES[entry.category] || { label: '未定義', color: 'pink' };
            const badgeClass = `badge badge-${catMeta.color}`;
            
            return (
              <div key={entry.id} className="glass-card" style={{ margin: '8px 16px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid var(--mg-${catMeta.color})` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={badgeClass} style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '800' }}>
                    {entry.category}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>{catMeta.label}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>#{entry.voucherNo}</span>
                    </div>
                    {["コ", "サ", "ツ", "ノ", "ケ"].includes(entry.category) && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        数量: {entry.quantity} 個 × 単価 ¥{entry.price} 万
                      </div>
                    )}
                    {["キ", "ネ"].includes(entry.category) && entry.salesDetails && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', flexDirection: 'column' }}>
                        {Object.values(entry.salesDetails).map((detail, i) => (
                          <span key={i}>{detail.name}: {detail.qty}個 × @¥{detail.price}万</span>
                        ))}
                      </div>
                    )}
                    {["キ", "ネ"].includes(entry.category) && !entry.salesDetails && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        数量: {entry.quantity} 個
                      </div>
                    )}
                    {entry.category === "採用" && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        ワーカー: {entry.workersHired}名 / セールスマン: {entry.salesmenHired}名
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="electric-number" style={{ fontSize: '1.05rem', fontWeight: '700', color: catMeta.type === 'inflow' ? 'var(--mg-pink)' : 'var(--text-primary)' }}>
                    {catMeta.type === 'inflow' ? '+' : '-'} ¥{entry.amount.toLocaleString()} 万
                  </span>
                  <button 
                    onClick={() => handleDeleteTransaction(entry.id)} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.4, cursor: 'pointer', padding: '4px' }}
                    aria-label="Delete transaction"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 新規取引追加フローティングボタン(FAB) */}
      <button 
        onClick={() => setShowAddModal(true)} 
        className="fab-btn" 
        style={{ position: 'absolute' }}
        aria-label="Add transaction"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* 期末処理モーダル */}
      {showPeriodEndModal && (
        <div className="modal-overlay" onClick={() => setShowPeriodEndModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">期末処理：人数の確定</h3>
              <button onClick={() => setShowPeriodEndModal(false)} className="modal-close">×</button>
            </div>
            <div className="form-group">
              <label className="form-label">期末のワーカー数</label>
              <input
                type="number"
                inputMode="numeric"
                className="form-input"
                value={periodEndWorkers}
                onChange={(e) => setPeriodEndWorkers(e.target.value)}
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">期末のセールスマン数</label>
              <input
                type="number"
                inputMode="numeric"
                className="form-input"
                value={periodEndSalesmen}
                onChange={(e) => setPeriodEndSalesmen(e.target.value)}
                min="0"
              />
            </div>
            
            {(() => {
              const wCount = Number(periodEndWorkers) || 0;
              const sCount = Number(periodEndSalesmen) || 0;
              const totalStaff = wCount + sCount;
              const periodKey = Math.min(5, Math.max(1, currentPeriod));
              const salaryUnit = SALARY_TABLE.normal[periodKey] || 0;
              const insuranceUnit = SALARY_TABLE.insurance[periodKey] || 0;
              const workerSal = wCount * salaryUnit;
              const salesmanSal = sCount * salaryUnit;
              const insurance = totalStaff * insuranceUnit;
              const totalAmount = workerSal + salesmanSal + insurance;
              
              return (
                <div style={{ background: 'rgba(0, 176, 255, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    第{currentPeriod}期の給与単価: {salaryUnit}万 / 保険単価: {insuranceUnit}万
                  </p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>労務費(シ): ¥{workerSal}万</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>販売費(セ): ¥{salesmanSal}万</p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>社会保険料(ソ): ¥{insurance}万</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    合計引落額: ¥{totalAmount}万
                  </p>
                </div>
              );
            })()}

            <button onClick={confirmPeriodEnd} className="btn-primary" style={{ width: '100%' }}>
              確定して処理を実行
            </button>
          </div>
        </div>
      )}

      {/* ワンタップ追加ボトムシート（モーダル） */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">出納データの追加</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 伝票番号 */}
              {selectedCategory !== '期首処理' && (
              <div className="form-group">
                <label className="form-label">伝票番号 (任意)</label>
                <input 
                  type="text" 
                  value={voucherNo} 
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder={`自動連番: ${(ledger.length + 1)}`}
                  className="form-input"
                />
              </div>
              )}

              {/* 項目の選択グリッド */}
              {selectedCategory !== '期首処理' && (
              <div>
                <label className="form-label" style={{ marginBottom: '12px', display: 'block', fontSize: '1rem', fontWeight: 'bold' }}>実行する項目を選択</label>
                
                {/* 🌟 ルールA (よく使う項目) */}
                <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.1rem' }}>⚡️</span> ルールA (メインの意思決定)
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                    {[
                      { action: "材料購入 (現金)", symbol: "ツ" },
                      { action: "材料購入 (買掛)", symbol: "ノ" },
                      { action: "設備投資", symbol: "ケ" },
                      { action: "投入・完成", symbol: "生産" },
                      { action: "採用", symbol: "採用", displaySymbol: "ソ" },
                      { action: "広告", symbol: "セ" },
                      { action: "研究開発", symbol: "チ" },
                      { action: "商品販売 (現金)", symbol: "キ" },
                      { action: "商品販売 (売掛)", symbol: "ネ" }
                    ].map(btn => (
                      <button
                        type="button"
                        key={btn.action}
                        onClick={() => handleCategorySelect(btn.symbol)}
                        className={`btn-premium ${selectedCategory === btn.symbol ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '10px 8px', fontSize: '0.85rem', borderRadius: '10px', borderColor: selectedCategory === btn.symbol ? 'var(--color-accent)' : `rgba(var(--color-${CATEGORIES[btn.symbol].color === 'blue' ? 'blue' : CATEGORIES[btn.symbol].color === 'yellow' ? 'yellow' : 'green'}), 0.15)` }}
                      >
                        {btn.action}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 📌 ルールB・その他 (決算・随時項目) */}
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>📌</span> ルールB・その他 (随時・決算処理)
                  </h4>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {[
                      { action: "期中 売掛割引(5%)", symbol: "売掛割引" },
                      { action: "保険", symbol: "保険" },
                      { action: "緑チップ購入", symbol: "緑チップ" },
                      { action: "配置転換", symbol: "配置転換" },
                      { action: "機械売却", symbol: "イ" },
                      { action: "銀行借入", symbol: "オ" },
                      { action: "最大借入", symbol: "MAX_Loan", onClick: () => setAmount(((currentPeriod <= 1) ? 0 : (currentPeriod <= 3 ? 2 : 3) * results.totalNetAssets).toString()) },
                      { action: "借入返済", symbol: "ナ" },
                      { action: "その他出金", symbol: "ス" }
                    ].map(btn => (
                      <button
                        type="button"
                        key={btn.action}
                        onClick={() => handleCategorySelect(btn.symbol)}
                        className={`btn-premium ${selectedCategory === btn.symbol ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px', opacity: selectedCategory === btn.symbol ? 1 : 0.8 }}
                      >
                        {btn.action}
                      </button>
                    ))}
                  </div>

                  {/* リスクカード */}
                  <span style={{ fontSize: '0.65rem', color: '#9c27b0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginTop: '16px', marginBottom: '6px' }}>🃏 リスクカード</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleCategorySelect("リスクカード")}
                      className={`btn-premium ${selectedCategory === "リスクカード" ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px', opacity: selectedCategory === "リスクカード" ? 1 : 0.8, borderColor: selectedCategory === "リスクカード" ? '#9c27b0' : 'rgba(156, 39, 176, 0.15)', backgroundColor: selectedCategory === "リスクカード" ? 'rgba(156, 39, 176, 0.2)' : undefined }}
                    >
                      🃏 リスクカード処理
                    </button>
                  </div>
                </div>
              </div>
              )}

              {/* カスタムUIブロック */}
              {selectedCategory !== '期首処理' && (
              <div className="glass-card" style={{ margin: '4px 0', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                  選択中: <span style={{ color: `var(--mg-${currentCatMeta.color})` }}>[{selectedCategory}] {currentCatMeta.label}</span>
                </span>
                <span className={`badge badge-${currentCatMeta.color}`}>
                  {currentCatMeta.type === 'inflow' ? '入金' : '出金'}
                </span>
              </div>
              )}

              {/* 採用専用UI */}
              {selectedCategory === '生産' ? (
                <div style={{ background: 'rgba(76, 175, 80, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-green)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-green)', margin: 0 }}>投入・完成一括処理</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const maxSa = Math.min(results?.wip?.endingCount || 0, results?.productionCapacity || 0);
                        const maxKo = Math.min(results?.mat?.endingCount || 0, results?.productionCapacity || 0);
                        setProductionSa(maxSa);
                        setProductionKo(maxKo);
                      }}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--mg-green)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
                    >
                      MAXセット
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                    <div>生産能力: <span style={{ color: 'white', fontWeight: 'bold' }}>{results?.productionCapacity || 0}</span></div>
                    <div>材料在庫: <span style={{ color: 'white', fontWeight: 'bold' }}>{results?.mat?.endingCount || 0}</span></div>
                    <div>仕掛在庫: <span style={{ color: 'white', fontWeight: 'bold' }}>{results?.wip?.endingCount || 0}</span></div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>投入 (コ)</span>
                        <span style={{ fontSize: '0.7rem', color: '#ff5252' }}>単価: 2万</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" onClick={() => setProductionKo(Math.max(0, (Number(productionKo) || 0) - 1))} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '6px' }}>-</button>
                        <input 
                          type="number" 
                          value={productionKo} 
                          onChange={(e) => setProductionKo(Math.min(Math.min(results?.mat?.endingCount || 0, results?.productionCapacity || 0), Math.max(0, Number(e.target.value) || 0)))}
                          placeholder="0"
                          className="form-input"
                          style={{ textAlign: 'center' }}
                        />
                        <button type="button" onClick={() => setProductionKo(Math.min(Math.min(results?.mat?.endingCount || 0, results?.productionCapacity || 0), (Number(productionKo) || 0) + 1))} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '6px' }}>+</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>完成 (サ)</span>
                        <span style={{ fontSize: '0.7rem', color: '#ff5252' }}>単価: 1万</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" onClick={() => setProductionSa(Math.max(0, (Number(productionSa) || 0) - 1))} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '6px' }}>-</button>
                        <input 
                          type="number" 
                          value={productionSa} 
                          onChange={(e) => setProductionSa(Math.min(Math.min(results?.wip?.endingCount || 0, results?.productionCapacity || 0), Math.max(0, Number(e.target.value) || 0)))}
                          placeholder="0"
                          className="form-input"
                          style={{ textAlign: 'center' }}
                        />
                        <button type="button" onClick={() => setProductionSa(Math.min(Math.min(results?.wip?.endingCount || 0, results?.productionCapacity || 0), (Number(productionSa) || 0) + 1))} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '6px' }}>+</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    合計出金: <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{((Number(productionSa) || 0) * 1) + ((Number(productionKo) || 0) * 2)}</span> 万
                  </div>
                </div>
              ) : selectedCategory === '保険' ? (
                <div style={{ background: 'rgba(255, 235, 59, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-yellow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-yellow)', margin: 0 }}>保険の購入</h4>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>5万</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>火災や盗難が発生した場合、被害額が自動補填されます。（保険チップは事故の発生時に失われます）</p>
                </div>
              ) : selectedCategory === '期首処理' ? (
                <div style={{ background: 'rgba(255, 193, 7, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-yellow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-yellow)', margin: 0 }}>🌅 期首一括処理</h4>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: 'var(--mg-pink)', fontWeight: 'bold' }}>前期売掛金回収 (ア)</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--mg-pink)' }}>+{results?.carryover?.receivables || 0} 万</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>買掛金支払 (ヌ)</span>
                      <span style={{ fontWeight: 'bold' }}>-{results?.carryover?.payables || 0} 万</span>
                    </div>
                    {currentPeriod > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>法人税等支払 (ニ)</span>
                        <span style={{ fontWeight: 'bold' }}>-{results?.carryover?.taxes || 0} 万</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>金利支払 (タ) <span style={{ fontSize: '0.7rem' }}>※借入残高 {results?.carryover?.loan || 0}万 の {(currentPeriod >= 4 ? 5 : 10)}%</span></span>
                      <span style={{ fontWeight: 'bold' }}>-{Math.round((results?.carryover?.loan || 0) * (currentPeriod >= 4 ? 0.05 : 0.10))} 万</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ color: 'var(--mg-yellow)' }}>[任意] 借入金返済 (ナ)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>-</span>
                        <input 
                          type="number" 
                          value={repaymentAmount} 
                          onChange={(e) => setRepaymentAmount(Math.min(results?.carryover?.loan || 0, Math.max(0, Number(e.target.value) || 0)))}
                          placeholder="0"
                          className="form-input"
                          style={{ width: '80px', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    合計出金: <span style={{ fontSize: '1.2rem', color: 'var(--mg-green)', marginRight: '8px' }}>
                      -{(results?.carryover?.payables || 0) + (currentPeriod > 1 ? (results?.carryover?.taxes || 0) : 0) + Math.round((results?.carryover?.loan || 0) * (currentPeriod >= 4 ? 0.05 : 0.10)) + (Number(repaymentAmount) || 0)}
                    </span> 万
                    <br/>
                    純増減額: <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {((results?.carryover?.receivables || 0) - ((results?.carryover?.payables || 0) + (currentPeriod > 1 ? (results?.carryover?.taxes || 0) : 0) + Math.round((results?.carryover?.loan || 0) * (currentPeriod >= 4 ? 0.05 : 0.10)) + (Number(repaymentAmount) || 0))) > 0 ? '+' : ''}{((results?.carryover?.receivables || 0) - ((results?.carryover?.payables || 0) + (currentPeriod > 1 ? (results?.carryover?.taxes || 0) : 0) + Math.round((results?.carryover?.loan || 0) * (currentPeriod >= 4 ? 0.05 : 0.10)) + (Number(repaymentAmount) || 0)))}
                    </span> 万
                  </div>

                </div>
              ) : selectedCategory === 'リスクカード' ? (
                <div style={{ background: 'rgba(156, 39, 176, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-purple)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--mg-purple)', marginBottom: '16px' }}>🃏 リスクカード</h4>
                  
                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button type="button" onClick={() => setRiskTab('positive')} className="btn-secondary" style={{ flex: 1, padding: '8px', borderRadius: '8px', background: riskTab === 'positive' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.05)', color: riskTab === 'positive' ? '#4caf50' : 'white', border: riskTab === 'positive' ? '1px solid #4caf50' : 'none' }}>ポジティブ</button>
                    <button type="button" onClick={() => setRiskTab('negative')} className="btn-secondary" style={{ flex: 1, padding: '8px', borderRadius: '8px', background: riskTab === 'negative' ? 'rgba(255, 82, 82, 0.3)' : 'rgba(255,255,255,0.05)', color: riskTab === 'negative' ? '#ff5252' : 'white', border: riskTab === 'negative' ? '1px solid #ff5252' : 'none' }}>ネガティブ</button>
                  </div>

                  {riskTab === 'positive' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '16px' }}>
                        {[
                          { id: 'special_mat', label: '特別サービス (材料)', desc: '材料購入 1個10万 5個まで' },
                          { id: 'special_ad', label: '特別サービス (広告)', desc: '広告購入 1口5万' },
                          { id: 'monopoly_salesman', label: '商品の独占販売 (Sマン)', desc: 'Sマン1名につき2個(32万)' },
                          { id: 'monopoly_ad', label: '商品の独占販売 (広告)', desc: '広告1枚につき2個(上限価格)' },
                          { id: 'rd_success', label: '研究開発成功', desc: '青チップ1枚につき2個(32万)' },
                          { id: 'common_mat', label: '各社共通', desc: '材料購入 1個12万 3個まで' }
                        ].map(btn => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => {
                              setRiskAction(btn.id);
                              setRiskQty('');
                              const maxPrices = { sapporo: 30, sendai: 32, tokyo: 38, nagoya: 36, osaka: 38, fukuoka: 34 };
                              setRiskPrice(btn.id === 'special_mat' ? 10 : btn.id === 'common_mat' ? 12 : btn.id === 'special_ad' ? 5 : (btn.id === 'monopoly_salesman' || btn.id === 'rd_success') ? 32 : btn.id === 'monopoly_ad' ? maxPrices[riskMarket] : '');
                            }}
                            className={`btn-premium ${riskAction === btn.id ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '8px', fontSize: '0.75rem', borderRadius: '8px', opacity: riskAction === btn.id ? 1 : 0.7, textAlign: 'left', display: 'flex', flexDirection: 'column' }}
                          >
                            <span style={{ fontWeight: 'bold', marginBottom: '4px', color: 'white' }}>{btn.label}</span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)' }}>{btn.desc}</span>
                          </button>
                        ))}
                      </div>

                      {(riskAction === 'monopoly_salesman' || riskAction === 'rd_success') && (
                        <div className="grid-2" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>販売数量</span>
                              <button type="button" onClick={() => {
                                const capacity = riskAction === 'monopoly_salesman' ? (results?.activeSalesmen || 0) * 2
                                  : (results?.activeRdChips || 0) * 2;
                                setRiskQty(Math.min(capacity, results?.prod?.endingCount || 0));
                              }} style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--color-accent)', border: 'none', borderRadius: '4px', color: 'black', fontWeight: 'bold' }}>MAX</button>
                            </label>
                            <input type="number" className="form-input" value={riskQty} onChange={e => setRiskQty(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">販売単価</label>
                            <input type="number" className="form-input" value={riskPrice} disabled />
                          </div>
                          <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">売上計上先</label>
                            <select className="form-input" value={riskSaleType} onChange={(e) => setRiskSaleType(e.target.value)}>
                              <option value="cash">現金 (キ)</option>
                              <option value="credit">売掛 (ネ)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {riskAction === 'monopoly_ad' && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            <span>各市場の販売数量 (上限価格固定)</span>
                            <span>販売可能: <strong style={{ color: 'white' }}>{Math.min((results?.activeAdChips || 0) * 2, results?.prod?.endingCount || 0)}個</strong></span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                            {[
                              { id: 'sapporo', name: '札幌', maxPrice: 40 },
                              { id: 'sendai', name: '仙台', maxPrice: 36 },
                              { id: 'tokyo', name: '東京', maxPrice: 32 },
                              { id: 'nagoya', name: '名古屋', maxPrice: 28 },
                              { id: 'osaka', name: '大阪', maxPrice: 24 },
                              { id: 'fukuoka', name: '福岡', maxPrice: 20 }
                            ].map(m => (
                              <div key={m.id} className="form-group" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span>{m.name}</span>
                                  <span style={{ color: 'var(--mg-pink)' }}>{m.maxPrice}万</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button type="button" onClick={() => setRiskMonopolyAdQtys(prev => ({ ...prev, [m.id]: Math.max(0, (prev[m.id] || 0) - 1) }))} className="btn-secondary" style={{ padding: '6px 12px' }}>-</button>
                                  <input type="number" className="form-input" style={{ textAlign: 'center' }} value={riskMonopolyAdQtys[m.id] || 0} onChange={e => setRiskMonopolyAdQtys(prev => ({ ...prev, [m.id]: Math.max(0, Number(e.target.value) || 0) }))} />
                                  <button type="button" onClick={() => setRiskMonopolyAdQtys(prev => ({ ...prev, [m.id]: (prev[m.id] || 0) + 1 }))} className="btn-secondary" style={{ padding: '6px 12px' }}>+</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="form-group">
                            <label className="form-label">売上計上先</label>
                            <select className="form-input" value={riskSaleType} onChange={(e) => setRiskSaleType(e.target.value)}>
                              <option value="cash">現金 (キ)</option>
                              <option value="credit">売掛 (ネ)</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>合計数量: <strong style={{ color: 'white', fontSize: '1rem' }}>{Object.values(riskMonopolyAdQtys).reduce((a, b) => a + b, 0)} 個</strong></span>
                            <span style={{ color: 'var(--text-secondary)' }}>合計金額: <strong style={{ color: 'var(--mg-pink)', fontSize: '1.1rem' }}>{Object.entries(riskMonopolyAdQtys).reduce((sum, [id, qty]) => sum + qty * { sapporo: 40, sendai: 36, tokyo: 32, nagoya: 28, osaka: 24, fukuoka: 20 }[id], 0)} 万</strong></span>
                          </div>
                        </div>
                      )}
                      {(riskAction === 'special_mat' || riskAction === 'common_mat') && (
                        <div className="grid-2" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>購入数量 (材料 ツ)</span>
                              <button type="button" onClick={() => setRiskQty(riskAction === 'special_mat' ? 5 : 3)} style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--color-accent)', border: 'none', borderRadius: '4px', color: 'black', fontWeight: 'bold' }}>MAX</button>
                            </label>
                            <input type="number" className="form-input" value={riskQty} onChange={e => setRiskQty(Math.min(riskAction === 'special_mat' ? 5 : 3, Math.max(0, Number(e.target.value) || 0)))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">単価 (1個)</label>
                            <input type="number" className="form-input" value={riskAction === 'special_mat' ? 10 : 12} disabled />
                          </div>
                        </div>
                      )}
                      {(riskAction === 'special_ad') && (
                        <div className="grid-2" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                          <div className="form-group">
                            <label className="form-label">購入口数 (広告 セ)</label>
                            <input type="number" className="form-input" value={riskQty} onChange={e => setRiskQty(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">単価 (1口)</label>
                            <input type="number" className="form-input" value={5} disabled />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '16px' }}>
                        {[
                          { id: 'retire_worker', label: 'ワーカー退職', desc: '退職金5(ソ) 1名減' },
                          { id: 'retire_salesman', label: 'セールスマン退職', desc: '退職金5(ソ) 1名減' },
                          { id: 'claim', label: 'クレーム発生', desc: '処理費5(セ)' },
                          { id: 'machine_break', label: '機械故障', desc: '修理費5(ス)' },
                          { id: 'design_trouble', label: '設計トラブル', desc: '改修費5(ス)' },
                          { id: 'rd_fail', label: '研究開発失敗', desc: '青チップ1枚喪失' },
                          { id: 'theft', label: '盗難発見', desc: '商品2個喪失' },
                          { id: 'miss', label: '製造ミス発見', desc: '仕掛品1個喪失' },
                          { id: 'fire', label: '倉庫火災', desc: '材料全喪失' }
                        ].map(btn => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setRiskAction(btn.id)}
                            className={`btn-premium ${riskAction === btn.id ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '8px', fontSize: '0.75rem', borderRadius: '8px', opacity: riskAction === btn.id ? 1 : 0.7, textAlign: 'left', display: 'flex', flexDirection: 'column' }}
                          >
                            <span style={{ fontWeight: 'bold', marginBottom: '4px', color: 'white' }}>{btn.label}</span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)' }}>{btn.desc}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : selectedCategory === '売掛割引' ? (
                <div style={{ background: 'rgba(233, 30, 99, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-pink)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-pink)', margin: 0 }}>期中 売掛割引（手数料5%）</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>売掛金残高: <strong style={{ color: 'white', fontSize: '1rem' }}>{results?.endingReceivables || 0}</strong>万</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">回収する売掛金額 (万)</label>
                    <input 
                      type="number" 
                      value={factoringAmount} 
                      onChange={(e) => setFactoringAmount(Math.min(Math.max(0, results?.endingReceivables || 0), Math.max(0, Number(e.target.value) || 0)))}
                      placeholder="0"
                      className="form-input"
                    />
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>割引手数料 (5%・タ):</span>
                      <span style={{ color: '#ff5252', fontWeight: 'bold' }}>{Math.round((Number(factoringAmount) || 0) * 0.05)} 万</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>現金手取額 (95%):</span>
                      <span style={{ color: 'var(--mg-pink)', fontWeight: 'bold', fontSize: '1.1rem' }}>{(Number(factoringAmount) || 0) - Math.round((Number(factoringAmount) || 0) * 0.05)} 万</span>
                    </div>
                  </div>
                </div>
              ) : selectedCategory === '採用' ? (
                <div style={{ background: 'rgba(15, 17, 26, 0.4)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-blue)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-blue)', margin: 0 }}>採用情報の入力</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>採用単価:</span>
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => setHirePrice(5)}
                          style={{ padding: '4px 12px', fontSize: '0.8rem', border: 'none', background: hirePrice === 5 ? 'var(--mg-blue)' : 'transparent', color: hirePrice === 5 ? 'white' : 'var(--text-secondary)' }}
                        >
                          5万
                        </button>
                        <button
                          type="button"
                          onClick={() => setHirePrice(10)}
                          style={{ padding: '4px 12px', fontSize: '0.8rem', border: 'none', background: hirePrice === 10 ? 'var(--mg-blue)' : 'transparent', color: hirePrice === 10 ? 'white' : 'var(--text-secondary)' }}
                        >
                          10万
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">ワーカー採用数 (人)</label>
                      <input 
                        type="number" 
                        value={workersHired} 
                        onChange={(e) => setWorkersHired(e.target.value)}
                        placeholder="0"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">セールスマン採用数 (人)</label>
                      <input 
                        type="number" 
                        value={salesmenHired} 
                        onChange={(e) => setSalesmenHired(e.target.value)}
                        placeholder="0"
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    合計採用費: <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{((Number(workersHired) || 0) + (Number(salesmenHired) || 0)) * hirePrice}</span> 万
                  </div>
                </div>
              ) : selectedCategory === '配置転換' ? (
                <div style={{ background: 'rgba(33, 150, 243, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-blue)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-blue)', marginBottom: '16px' }}>配置転換（人員の移動）</h4>
                  
                  <div className="grid-2">
                    {/* ワーカー → セールスマン */}
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>W → S へ移動</span>
                        <span style={{ color: 'var(--text-muted)' }}>MAX: {results?.workers || 0}人</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          type="button" 
                          onClick={() => setTransferW2S(Math.max(0, transferW2S - 1))}
                          className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '8px' }}
                        >-</button>
                        <input 
                          type="number" 
                          value={transferW2S} 
                          onChange={(e) => setTransferW2S(Math.min(results?.workers || 0, Math.max(0, Number(e.target.value) || 0)))}
                          className="form-input" 
                          style={{ textAlign: 'center' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => setTransferW2S(Math.min(results?.workers || 0, transferW2S + 1))}
                          className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '8px' }}
                        >+</button>
                      </div>
                    </div>

                    {/* セールスマン → ワーカー */}
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>S → W へ移動</span>
                        <span style={{ color: 'var(--text-muted)' }}>MAX: {results?.salesmen || 0}人</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          type="button" 
                          onClick={() => setTransferS2W(Math.max(0, transferS2W - 1))}
                          className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '8px' }}
                        >-</button>
                        <input 
                          type="number" 
                          value={transferS2W} 
                          onChange={(e) => setTransferS2W(Math.min(results?.salesmen || 0, Math.max(0, Number(e.target.value) || 0)))}
                          className="form-input"
                          style={{ textAlign: 'center' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => setTransferS2W(Math.min(results?.salesmen || 0, transferS2W + 1))}
                          className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '8px' }}
                        >+</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    合計配置転換費: <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{((Number(transferW2S) || 0) + (Number(transferS2W) || 0)) * 5}</span> 万
                  </div>
                </div>
              ) : selectedCategory === 'チ' ? (
                <div style={{ background: 'rgba(33, 150, 243, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--mg-blue)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-blue)', marginBottom: '16px' }}>研究開発費の選択</h4>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setRdPrice(20)}
                      style={{ flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', background: rdPrice === 20 ? 'var(--mg-blue)' : 'rgba(255,255,255,0.05)', color: rdPrice === 20 ? 'white' : 'var(--text-secondary)' }}
                    >
                      20万
                    </button>
                    <button
                      type="button"
                      onClick={() => setRdPrice(40)}
                      style={{ flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', background: rdPrice === 40 ? 'var(--mg-blue)' : 'rgba(255,255,255,0.05)', color: rdPrice === 40 ? 'white' : 'var(--text-secondary)' }}
                    >
                      40万
                    </button>
                  </div>
                  <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    合計研究開発費: <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{rdPrice}</span> 万
                  </div>
                </div>
              ) : ["火災", "製造ミス", "盗難"].includes(selectedCategory) ? (
                <div style={{ background: 'rgba(255, 82, 82, 0.1)', padding: '16px', borderRadius: '12px', border: '1px dashed #ff5252' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#ff5252', marginBottom: '12px' }}>⚠️ 事故・災害の記録</h4>
                  {selectedCategory === '火災' ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      材料倉庫にある全ての材料が失われます。（金額の入力は不要です）<br/>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>※保険チップを持っている場合は自動的に保険金が計算されます。</span>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">{selectedCategory === '製造ミス' ? '仕掛品のロス数量 (個)' : '製品の盗難数量 (個)'}</label>
                      <input 
                        type="number" 
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={selectedCategory === '製造ミス' ? '1' : '2'}
                        className="form-input"
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: '6px' }}>
                        {selectedCategory === '盗難' && '※保険チップを持っている場合は自動的に保険金が計算されます。'}
                        {selectedCategory === '製造ミス' && '※製造ミスのロスでは保険金は適用されません。'}
                      </span>
                    </div>
                  )}
                </div>
              ) : ["ツ", "ノ"].includes(selectedCategory) ? (
                (() => {
                  const hasMD = ledger.some(e => e.category === "MD");
                  
                  let totalQty = 0;
                  let totalAmount = 0;
                  MARKETS.forEach(m => {
                    const q = marketQuantities[m.id] || 0;
                    totalQty += q;
                    const discountedPrice = (hasMD && m.id !== 'stocker') ? m.basePrice - 2 : m.basePrice;
                    totalAmount += q * discountedPrice;
                  });
                  
                  return (
                    <div style={{ background: 'rgba(76, 175, 80, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-green)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>各市場の購入数量を入力</span>
                        {hasMD && <span className="badge badge-blue">MD割引適用中 (-2)</span>}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                        {MARKETS.map(m => {
                          const discountedPrice = (hasMD && m.id !== 'stocker') ? m.basePrice - 2 : m.basePrice;
                          const qty = marketQuantities[m.id] || 0;
                          
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--mg-green)' }}>単価: {discountedPrice}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                  type="button"
                                  onClick={() => setMarketQuantities(prev => ({ ...prev, [m.id]: Math.max(0, qty - 1) }))}
                                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >-</button>
                                <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>{qty}</span>
                                <button 
                                  type="button"
                                  onClick={() => setMarketQuantities(prev => ({ ...prev, [m.id]: qty + 1 }))}
                                  style={{ background: 'rgba(76, 175, 80, 0.3)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計数量: <strong style={{ color: 'white', fontSize: '1rem' }}>{totalQty}個</strong></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計金額: <strong style={{ color: 'var(--mg-green)', fontSize: '1.1rem' }}>{totalAmount}万</strong></span>
                      </div>
                    </div>
                  );
                })()
              ) : selectedCategory === '緑チップ' ? (
                <div style={{ background: 'rgba(76, 175, 80, 0.15)', padding: '16px', borderRadius: '12px', border: '1px dashed #4caf50' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#81c784', marginBottom: '16px' }}>緑チップの購入 (各10万/枚)</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const alreadyBought = {
                        pac: ledger.some(e => e.category === 'PAC'),
                        md: ledger.some(e => e.category === 'MD'),
                        research: ledger.some(e => e.category === 'リサーチ')
                      };
                      
                      return [
                        { id: 'pac', name: 'PAC生産性', desc: '生産能力+1' },
                        { id: 'md', name: 'マーチャンダイザー', desc: '材料仕入-2万' },
                        { id: 'research', name: 'マーケットリサーチ', desc: '販売力アップ' }
                      ].map(chip => {
                        const isBought = alreadyBought[chip.id];
                        const qty = isBought ? 0 : (greenChips[chip.id] || 0);
                        
                        return (
                          <div key={chip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', opacity: isBought ? 0.6 : 1 }}>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {chip.name}
                                {isBought && <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px' }}>購入済</span>}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{chip.desc}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button 
                                type="button"
                                disabled={isBought}
                                onClick={() => setGreenChips(prev => ({ ...prev, [chip.id]: Math.max(0, qty - 1) }))}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isBought ? 0.5 : 1 }}
                              >-</button>
                              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', width: '24px', textAlign: 'center' }}>{qty}</span>
                              <button 
                                type="button"
                                disabled={isBought || qty >= 1}
                                onClick={() => setGreenChips(prev => ({ ...prev, [chip.id]: Math.min(1, qty + 1) }))}
                                style={{ background: isBought || qty >= 1 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.3)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isBought || qty >= 1 ? 0.5 : 1 }}
                              >+</button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    合計金額: <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{((greenChips.pac + greenChips.md + greenChips.research) * 10)}</span> 万
                  </div>
                </div>
              ) : selectedCategory === "ケ" ? (
                (() => {
                  let totalQty = 0;
                  let totalAmount = 0;
                  MACHINES.forEach(m => {
                    const q = machineQuantities[m.id] || 0;
                    totalQty += q;
                    totalAmount += q * m.basePrice;
                  });
                  
                  return (
                    <div style={{ background: 'rgba(156, 39, 176, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(156, 39, 176, 0.3)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-purple)', marginBottom: '12px' }}>
                        購入する機械の数量を入力
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                        {MACHINES.map(m => {
                          const qty = machineQuantities[m.id] || 0;
                          
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--mg-purple)' }}>単価: {m.basePrice}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                  type="button"
                                  onClick={() => setMachineQuantities(prev => ({ ...prev, [m.id]: Math.max(0, qty - 1) }))}
                                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >-</button>
                                <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>{qty}</span>
                                <button 
                                  type="button"
                                  onClick={() => setMachineQuantities(prev => ({ ...prev, [m.id]: qty + 1 }))}
                                  style={{ background: 'rgba(156, 39, 176, 0.3)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計数量: <strong style={{ color: 'white', fontSize: '1rem' }}>{totalQty}個</strong></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計金額: <strong style={{ color: 'var(--mg-purple)', fontSize: '1.1rem' }}>{totalAmount}万</strong></span>
                      </div>
                    </div>
                  );
                })()
              ) : selectedCategory === "セ" ? (
                (() => {
                  let totalQty = 0;
                  let totalAmount = 0;
                  ADS.forEach(m => {
                    const q = adQuantities[m.id] || 0;
                    totalQty += q;
                    totalAmount += q * m.basePrice;
                  });
                  
                  return (
                    <div style={{ background: 'rgba(33, 150, 243, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-blue)', marginBottom: '12px' }}>
                        購入する広告の数量を入力
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                        {ADS.map(m => {
                          const qty = adQuantities[m.id] || 0;
                          
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--mg-blue)' }}>単価: {m.basePrice}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                  type="button"
                                  onClick={() => setAdQuantities(prev => ({ ...prev, [m.id]: Math.max(0, qty - 1) }))}
                                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >-</button>
                                <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>{qty}</span>
                                <button 
                                  type="button"
                                  onClick={() => setAdQuantities(prev => ({ ...prev, [m.id]: qty + 1 }))}
                                  style={{ background: 'rgba(33, 150, 243, 0.3)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計数量: <strong style={{ color: 'white', fontSize: '1rem' }}>{totalQty}個</strong></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計金額: <strong style={{ color: 'var(--mg-blue)', fontSize: '1.1rem' }}>{totalAmount}万</strong></span>
                      </div>
                    </div>
                  );
                })()
              ) : ["キ", "ネ"].includes(selectedCategory) ? (
                (() => {
                  let totalQty = 0;
                  let totalAmount = 0;
                  MARKETS.filter(m => m.id !== 'stocker').forEach(m => {
                    const qty = salesData[m.id]?.qty || 0;
                    const prc = Number(salesData[m.id]?.price) || 0;
                    totalQty += qty;
                    totalAmount += qty * prc;
                  });
                  
                  return (
                    <div style={{ background: 'rgba(233, 30, 99, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(233, 30, 99, 0.3)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--mg-pink)', marginBottom: '12px' }}>
                        販売する市場・数量・単価を入力
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                        {MARKETS.filter(m => m.id !== 'stocker').map(m => {
                          const qty = salesData[m.id]?.qty || 0;
                          const prc = salesData[m.id]?.price || '';
                          
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@</span>
                                  <input 
                                    type="number"
                                    placeholder="単価"
                                    value={prc}
                                    onChange={(e) => setSalesData(prev => ({ ...prev, [m.id]: { ...prev[m.id], price: e.target.value } }))}
                                    style={{ width: '80px', padding: '8px 8px', fontSize: '1.1rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', color: 'white', textAlign: 'center' }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                  type="button"
                                  onClick={() => setSalesData(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: Math.max(0, qty - 1) } }))}
                                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >-</button>
                                <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>{qty}</span>
                                <button 
                                  type="button"
                                  onClick={() => setSalesData(prev => ({ ...prev, [m.id]: { ...prev[m.id], qty: qty + 1 } }))}
                                  style={{ background: 'rgba(233, 30, 99, 0.3)', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計数量: <strong style={{ color: 'white', fontSize: '1rem' }}>{totalQty}個</strong></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>合計金額: <strong style={{ color: 'var(--mg-pink)', fontSize: '1.1rem' }}>{totalAmount}万</strong></span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <>

              {/* 数量・単価入力（対応する勘定科目のみ） */}
              {isQtyNeeded && !["キ", "ネ", "ツ", "ノ", "ケ", "セ", "緑チップ", "生産", "期首処理", "売掛割引"].includes(selectedCategory) && (
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      数量 (個数)
                    </label>
                    <input 
                      type="number" 
                      value={quantity} 
                      onChange={(e) => handleQtyPriceChange('qty', e.target.value)}
                      placeholder="0"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">単価 (万/個)</label>
                    <input 
                      type="number" 
                      value={price} 
                      onChange={(e) => handleQtyPriceChange('price', e.target.value)}
                      placeholder="0"
                      className="form-input"
                      disabled={["保険", "コ", "サ"].includes(selectedCategory)}
                    />
                  </div>
                </div>
              )}

              {/* 金額入力 ＆ 内蔵電卓への切り替え */}
              <div className="form-group" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">合計金額 (万)</label>
                  <button 
                    type="button" 
                    onClick={() => setShowCalculator(!showCalculator)} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {showCalculator ? "キーボード入力を使う" : "🧮 簡単電卓を使う"}
                  </button>
                </div>
                
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="金額を入力"
                  className="form-input"
                  style={{ fontSize: '1.25rem', fontWeight: '700' }}
                  disabled={showCalculator || ["保険", "コ", "サ"].includes(selectedCategory)}
                />

                {/* 電卓ポップアップ */}
                {showCalculator && (
                  <div className="glass-card" style={{ padding: '10px', marginTop: '8px', border: '1px solid var(--border-glass-focused)', background: 'var(--bg-glass-heavy)' }}>
                    {/* 電卓用インプット表示 */}
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', textAlign: 'right', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: '700', marginBottom: '8px', height: '38px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {calcInput || '0'}
                    </div>
                    {/* 電卓キーパッド */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {['7', '8', '9', '/'].map(k => <button type="button" key={k} onClick={() => handleCalcBtnClick(k)} className="btn-premium btn-secondary" style={{ padding: '8px 0', fontSize: '1rem', borderRadius: '8px' }}>{k}</button>)}
                      {['4', '5', '6', '*'].map(k => <button type="button" key={k} onClick={() => handleCalcBtnClick(k)} className="btn-premium btn-secondary" style={{ padding: '8px 0', fontSize: '1rem', borderRadius: '8px' }}>{k}</button>)}
                      {['1', '2', '3', '-'].map(k => <button type="button" key={k} onClick={() => handleCalcBtnClick(k)} className="btn-premium btn-secondary" style={{ padding: '8px 0', fontSize: '1rem', borderRadius: '8px' }}>{k}</button>)}
                      {['0', '.', 'C', '+'].map(k => <button type="button" key={k} onClick={() => handleCalcBtnClick(k)} className="btn-premium btn-secondary" style={{ padding: '8px 0', fontSize: '1rem', borderRadius: '8px', backgroundColor: k === 'C' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: k === 'C' ? '#ef4444' : 'inherit' }}>{k}</button>)}
                    </div>
                    <button type="button" onClick={() => handleCalcBtnClick('=')} className="btn-premium btn-primary" style={{ width: '100%', padding: '10px', marginTop: '6px', fontSize: '1rem', borderRadius: '8px' }}>
                      ＝ 決定して金額へ反映
                    </button>
                  </div>
                )}
              </div>
              </>
              )}

              {/* 決定ボタン */}
              <button 
                type="submit" 
                className="btn-premium btn-primary" 
                style={{ width: '100%', padding: '14px', fontSize: '1.05rem', marginTop: '8px' }}
              >
                取引を追加する
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashLedger;
