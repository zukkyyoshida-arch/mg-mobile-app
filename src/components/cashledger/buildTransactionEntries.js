// handleAddTransaction の中核ロジックを純粋関数群として抽出したモジュール。
//
// 設計方針:
// - 各関数は「入力（カテゴリ・フォーム値・ledger・results 等）」を受け取り、
//   次のいずれかの結果オブジェクトを返す純粋関数とする。
//     { error: string }                          … 検証エラー。呼び出し側で alert する
//     { ledger: Array, infoAlerts?: string[],    … 追加後の「完成した新 ledger 全体」。
//       resetSelectedCategory?: boolean }             infoAlerts は成功時に表示する通知、
//                                                     resetSelectedCategory は期首処理で使う
// - alert() は一切呼ばない。エラー・通知はすべて返り値で表現する。
// - 非決定的な値（Date.now / Math.random）は ctx.now / ctx.rand として注入し、
//   元コードと同じ計算式でタイムスタンプ・id を生成する（挙動を1ミリも変えない）。
//
// ctx（コンテキスト）は次のフィールドを持つ:
//   carryover, ledger, results, currentPeriod, transactionMode, now, rand
//   now:  数値（既定 Date.now()）。元コードの Date.now() 相当
//   rand: () => number（既定 Math.random）。monopoly_ad のタイムスタンプ生成で使用

import { MARKETS, MACHINES, ADS, CATEGORIES } from './constants';

// 伝票番号の自動採番（既存の最大番号+1。削除があっても重複しない）。
// 元 CashLedger.jsx の getNextVoucherNo と同一実装。
export function getNextVoucherNo(list) {
  const maxNo = list.reduce((max, item) => {
    const n = parseInt(item.voucherNo, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return maxNo + 1;
}

// 販売系（キ / ネ）: 通常販売 or 投げ売り。
// finalQuantity / finalAmount / finalPrice と salesDetails を返す（共通エントリ生成側で使う）。
function buildSalesFinal(ctx, form) {
  const { results } = ctx;
  const { isFireSale, fireSaleQty, salesData } = form;

  if (isFireSale) {
    const qty = Number(fireSaleQty) || 0;
    if (qty <= 0) {
      return { error: '投げ売りする数量を入力してください' };
    }
    const maxInventory = results?.prod?.endingCount || 0;
    if (qty > maxInventory) {
      return { error: `手持在庫 (${maxInventory}個) を超える数量は販売できません` };
    }
    return { finalQuantity: qty, finalAmount: qty * 18, finalPrice: 18 };
  }

  let totalQty = 0;
  let totalAmount = 0;
  let error = null;

  MARKETS.filter(m => m.id !== 'stocker').forEach(m => {
    const qty = salesData[m.id]?.qty || 0;
    const prc = Number(salesData[m.id]?.price) || 0;
    if (qty > 0) {
      if (prc <= 0) {
        // 元コードは最初に見つかったエラーメッセージを alert し hasError=true
        if (!error) error = `${m.name}の販売単価を入力してください`;
      } else {
        totalQty += qty;
        totalAmount += qty * prc;
      }
    }
  });

  if (error) return { error };

  if (totalQty === 0) {
    return { error: '販売する数量と単価を入力してください' };
  }

  return { finalQuantity: totalQty, finalAmount: totalAmount, finalPrice: 0 };
}

// 売掛割引（早期リターン枝）
function buildFactoring(ctx, form) {
  const { ledger, now } = ctx;
  const discountVal = Number(form.factoringAmount) || 0;
  if (discountVal <= 0) {
    return { error: '割引する売掛金の金額を入力してください' };
  }
  const fee = Math.round(discountVal * 0.05);
  const newTransactions = [];
  newTransactions.push({
    id: now.toString() + '-ar',
    category: 'ア',
    quantity: 1,
    amount: discountVal,
    price: discountVal,
    timestamp: new Date(now).toISOString()
  });
  if (fee > 0) {
    newTransactions.push({
      id: now.toString() + '-fee',
      category: 'タ',
      quantity: 1,
      amount: fee,
      price: fee,
      timestamp: new Date(now).toISOString()
    });
  }
  return { ledger: [...ledger, ...newTransactions] };
}

// リスクカード（早期リターン枝）
function buildRiskCard(ctx, form) {
  const { ledger, results, transactionMode, now, rand } = ctx;
  const { riskTab, riskAction, riskQty, riskPrice, riskMonopolyAdQtys } = form;

  const newTransactions = [];
  const timestamp = new Date(now).toISOString();
  const tsGroup = now.toString();
  const q = Number(riskQty) || 0;
  const p = Number(riskPrice) || 0;

  if (riskTab === 'positive') {
    if (riskAction === 'monopoly_ad') {
      const adPrices = { sapporo: 40, sendai: 36, tokyo: 32, nagoya: 28, osaka: 24, fukuoka: 20 };
      const cat = transactionMode === 'credit' ? 'ネ' : 'キ';
      let totalQ = 0;
      Object.entries(riskMonopolyAdQtys).forEach(([market, qty]) => {
        if (qty > 0) {
          totalQ += qty;
          newTransactions.push({ id: now.toString() + '-sale-' + market, category: cat, quantity: qty, amount: qty * adPrices[market], price: adPrices[market], timestamp: new Date(now + rand()).toISOString(), usedAd: true });
        }
      });
      if (totalQ <= 0) {
        return { error: '販売する数量を入力してください' };
      }
    } else if (riskAction === 'monopoly_salesman' || riskAction === 'rd_success') {
      if (q <= 0 || p <= 0) {
        return { error: '販売する数量と単価を入力してください' };
      }
      const cat = transactionMode === 'credit' ? 'ネ' : 'キ';
      newTransactions.push({ id: now.toString() + '-sale', category: cat, quantity: q, amount: q * p, price: p, timestamp, usedRD: riskAction === 'rd_success' });
    } else if (riskAction === 'special_mat' || riskAction === 'common_mat') {
      if (q <= 0) {
        return { error: '購入する数量を入力してください' };
      }
      const price = riskAction === 'special_mat' ? 10 : 12;
      const cat = transactionMode === 'credit' ? 'ノ' : 'ツ';
      newTransactions.push({ id: now.toString() + '-mat', category: cat, quantity: q, amount: q * price, price: price, timestamp });
    } else if (riskAction === 'special_ad') {
      if (q <= 0) {
        return { error: '購入する口数を入力してください' };
      }
      newTransactions.push({ id: now.toString() + '-ad', category: 'セ', quantity: q, amount: q * 5, price: 5, timestamp, customName: '特別サービス(広告)の支払', customShortName: '広告' });
    }
  } else {
    if (riskAction === 'retire_worker') {
      newTransactions.push({ id: tsGroup + '-resw', groupId: tsGroup, category: '退職', workersResigned: 1, salesmenResigned: 0, amount: 0, quantity: 1, price: 0, timestamp, customName: 'ワーカー退職', customShortName: '退職' });
      newTransactions.push({ id: tsGroup + '-reswp', groupId: tsGroup, category: 'ソ', amount: 5, quantity: 1, price: 5, timestamp: new Date(now + 1).toISOString(), customName: '退職費用 (ワーカー)', customShortName: '退職' });
    } else if (riskAction === 'retire_salesman') {
      newTransactions.push({ id: tsGroup + '-ress', groupId: tsGroup, category: '退職', workersResigned: 0, salesmenResigned: 1, amount: 0, quantity: 1, price: 0, timestamp, customName: 'セールスマン退職', customShortName: '退職' });
      newTransactions.push({ id: tsGroup + '-ressp', groupId: tsGroup, category: 'ソ', amount: 5, quantity: 1, price: 5, timestamp: new Date(now + 1).toISOString(), customName: '退職費用 (セールスマン)', customShortName: '退職' });
    } else if (riskAction === 'claim') {
      newTransactions.push({ id: tsGroup + '-claim', groupId: tsGroup, category: 'セ', amount: 5, quantity: 1, price: 5, timestamp, customName: 'クレーム処理費用', customShortName: '苦情' });
    } else if (riskAction === 'machine_break' || riskAction === 'design_trouble') {
      newTransactions.push({ id: tsGroup + '-trouble', groupId: tsGroup, category: 'ス', amount: 5, quantity: 1, price: 5, timestamp, customName: riskAction === 'machine_break' ? '機械故障修理費用' : 'デザイン設計変更', customShortName: '修理' });
    } else if (riskAction === 'rd_fail') {
      newTransactions.push({ id: tsGroup + '-rdfail', groupId: tsGroup, category: '研究開発失敗', amount: 0, quantity: 1, price: 0, timestamp, customName: '研究開発の失敗', customShortName: '失敗' });
    } else if (riskAction === 'theft') {
      const qtyToLose = Math.min(2, results?.prod?.endingCount || 0);
      newTransactions.push({ id: tsGroup + '-theft', groupId: tsGroup, category: '盗難', quantity: qtyToLose, amount: 0, price: 0, timestamp, customName: '盗難による製品ロス', customShortName: '盗難' });

      const purchasedIns = ledger.filter(tx => tx.category === '保険').reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);
      const usedIns = ledger.filter(tx => tx.category === '特別利益' && tx.customName?.includes('保険金')).length;
      if (purchasedIns > usedIns && qtyToLose > 0) {
        const payout = qtyToLose * 10;
        newTransactions.push({ id: tsGroup + '-theft-ins', groupId: tsGroup, category: '特別利益', quantity: 1, amount: payout, price: payout, timestamp: new Date(now + 1).toISOString(), customName: '盗難保険金収入', customShortName: '保険金' });
      }
    } else if (riskAction === 'miss') {
      newTransactions.push({ id: tsGroup + '-miss', groupId: tsGroup, category: '製造ミス', quantity: 1, amount: 0, price: 0, timestamp, customName: '製造ミスによる仕掛品ロス', customShortName: 'ミス' });
    } else if (riskAction === 'fire') {
      const qtyToLose = results?.mat?.endingCount || 0;
      newTransactions.push({ id: tsGroup + '-fire', groupId: tsGroup, category: '火災', quantity: qtyToLose, amount: 0, price: 0, timestamp, customName: '火災による材料ロス', customShortName: '火災' });

      const purchasedIns = ledger.filter(tx => tx.category === '保険').reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);
      const usedIns = ledger.filter(tx => tx.category === '特別利益' && tx.customName?.includes('保険金')).length;
      if (purchasedIns > usedIns && qtyToLose > 0) {
        const payout = qtyToLose * 8;
        newTransactions.push({ id: tsGroup + '-fire-ins', groupId: tsGroup, category: '特別利益', quantity: 1, amount: payout, price: payout, timestamp: new Date(now + 1).toISOString(), customName: '火災保険金収入', customShortName: '保険金' });
      }
    }
  }

  return { ledger: [...ledger, ...newTransactions] };
}

// 期首処理（早期リターン枝）
function buildPeriodOpening(ctx, form) {
  const { carryover, ledger, currentPeriod, now } = ctx;
  const newTransactions = [];
  const timestamp = new Date(now).toISOString();
  const a = carryover?.receivables || 0;
  if (a > 0) {
    newTransactions.push({ id: now.toString() + '-ar', category: 'ア', quantity: 1, amount: a, price: a, timestamp });
  }
  const p = carryover?.payables || 0;
  if (p > 0) {
    newTransactions.push({ id: now.toString() + '-nu', category: 'ヌ', quantity: 1, amount: p, price: p, timestamp });
  }
  const t = carryover?.taxes || 0;
  if (t > 0) {
    newTransactions.push({ id: now.toString() + '-ni', category: 'ニ', quantity: 1, amount: t, price: t, timestamp });
  }
  const loan = carryover?.loan || 0;
  if (loan > 0) {
    const rate = (currentPeriod >= 4) ? 0.05 : 0.10;
    const interest = Math.round(loan * rate);
    if (interest > 0) {
      newTransactions.push({ id: now.toString() + '-ta', category: 'タ', quantity: 1, amount: interest, price: interest, timestamp });
    }
  }
  const repay = Number(form.repaymentAmount) || 0;
  if (repay > 0) {
    newTransactions.push({ id: now.toString() + '-na', category: 'ナ', quantity: 1, amount: repay, price: repay, timestamp });
  }

  // ボタンを消すためのマーカーとして「期首処理」を追加
  newTransactions.push({ id: now.toString() + '-kisho', category: '期首処理', quantity: 0, amount: 0, price: 0, timestamp });

  return { ledger: [...ledger, ...newTransactions], resetSelectedCategory: true };
}

// 生産（投入コ・完成サ）（早期リターン枝）
function buildProduction(ctx, form) {
  const { ledger, now } = ctx;
  const koQty = Number(form.productionKo) || 0;
  const saQty = Number(form.productionSa) || 0;

  if (koQty === 0 && saQty === 0) {
    return { error: '投入または完成する数量を入力してください' };
  }

  const newTransactions = [];
  if (saQty > 0) {
    newTransactions.push({
      id: now.toString() + '-sa',
      category: 'サ',
      quantity: saQty,
      amount: saQty * 1,
      price: 1,
      timestamp: new Date(now).toISOString()
    });
  }
  if (koQty > 0) {
    newTransactions.push({
      id: now.toString() + '-ko',
      category: 'コ',
      quantity: koQty,
      amount: koQty * 2,
      price: 2,
      timestamp: new Date(now).toISOString()
    });
  }

  return { ledger: [...ledger, ...newTransactions] };
}

// 緑チップ（早期リターン枝・伝票連番あり）
function buildGreenChips(ctx, form) {
  const { ledger, now } = ctx;
  const pacQty = form.greenChips.pac || 0;
  const mdQty = form.greenChips.md || 0;
  const researchQty = form.greenChips.research || 0;

  const totalAmount = (pacQty + mdQty + researchQty) * 10;
  if (totalAmount === 0) {
    return { error: '購入する緑チップの数量を入力してください' };
  }

  const updatedLedger = [...ledger];

  for (let i = 0; i < pacQty; i++) {
    updatedLedger.push({
      id: now.toString() + `-pac-${i}`,
      voucherNo: getNextVoucherNo(updatedLedger).toString(),
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
      id: now.toString() + `-md-${i}`,
      voucherNo: getNextVoucherNo(updatedLedger).toString(),
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
      id: now.toString() + `-research-${i}`,
      voucherNo: getNextVoucherNo(updatedLedger).toString(),
      category: 'リサーチ',
      quantity: 1,
      price: 10,
      amount: 10,
      workersHired: 0,
      salesmenHired: 0
    });
  }

  return { ledger: updatedLedger };
}

// 材料仕入（ツ / ノ）: 複数市場合算。fall-through 用の final を返す
function buildMaterialPurchaseFinal(ctx, form) {
  const { ledger } = ctx;
  const hasMD = ledger.some(e => e.category === 'MD');
  let totalQty = 0;
  let totalAmount = 0;

  MARKETS.forEach(m => {
    const q = form.marketQuantities[m.id] || 0;
    if (q > 0) {
      totalQty += q;
      const discountedPrice = (hasMD && m.id !== 'stocker') ? m.basePrice - 2 : m.basePrice;
      totalAmount += q * discountedPrice;
    }
  });

  if (totalQty === 0) {
    return { error: '購入する数量を入力してください' };
  }

  return { finalQuantity: totalQty, finalAmount: totalAmount, finalPrice: 0 };
}

// 設備投資（ケ）: 機械購入。fall-through 用の final を返す
function buildMachinePurchaseFinal(ctx, form) {
  let totalQty = 0;
  let totalAmount = 0;

  MACHINES.forEach(m => {
    const q = form.machineQuantities[m.id] || 0;
    if (q > 0) {
      totalQty += q;
      totalAmount += q * m.basePrice;
    }
  });

  if (totalQty === 0) {
    return { error: '購入する機械の数量を入力してください' };
  }

  return { finalQuantity: totalQty, finalAmount: totalAmount, finalPrice: 0 };
}

// 広告（セ）: 複数口合算。fall-through 用の final を返す
function buildAdPurchaseFinal(ctx, form) {
  let totalQty = 0;
  let totalAmount = 0;

  ADS.forEach(m => {
    const q = form.adQuantities[m.id] || 0;
    if (q > 0) {
      totalQty += q;
      totalAmount += q * m.basePrice;
    }
  });

  if (totalQty === 0) {
    return { error: '購入する広告の数量を入力してください' };
  }

  return { finalQuantity: totalQty, finalAmount: totalAmount, finalPrice: 0 };
}

// 保険: fall-through 用の final を返す（保有上限チェックあり）
function buildInsuranceFinal(ctx) {
  const currentInsurance = ctx.results?.activeInsuranceChips || 0;
  if (currentInsurance >= 1) {
    return { error: '⚠️ 保険は同時に1つしか保有できません。' };
  }
  return { finalQuantity: 1, finalAmount: 5, finalPrice: 5 };
}

// 機械売却（イ）: fall-through 用の final を返す（保有超過・売却額チェックあり）
function buildMachineSaleFinal(ctx, form) {
  const { results } = ctx;
  const { machineSaleQuantities, amount } = form;
  const soldLarge = Number(machineSaleQuantities.large) || 0;
  const soldSmall = Number(machineSaleQuantities.small) || 0;
  const soldAttach = Number(machineSaleQuantities.attachment) || 0;
  const totalSold = soldLarge + soldSmall + soldAttach;

  if (totalSold === 0) {
    return { error: '売却する機械の台数を入力してください' };
  }

  const heldLarge = results?.largeMachines || 0;
  const heldSmall = results?.smallMachines || 0;
  const heldAttach = results?.attachments || 0;
  if (soldLarge > heldLarge || soldSmall > heldSmall || soldAttach > heldAttach) {
    return { error: `保有台数を超える売却はできません。\n（保有 大型:${heldLarge} 小型:${heldSmall} アタッチ:${heldAttach} / 売却 大型:${soldLarge} 小型:${soldSmall} アタッチ:${soldAttach}）` };
  }

  const saleAmount = amount === '' ? 0 : Number(amount);
  if (saleAmount <= 0) {
    return { error: '売却額（入金額）を入力してください' };
  }

  return { finalQuantity: totalSold, finalAmount: saleAmount, finalPrice: 0 };
}

// 配置転換: fall-through 用の final を返す
function buildTransferFinal(ctx, form) {
  const { results } = ctx;
  const w2s = Number(form.transferW2S) || 0;
  const s2w = Number(form.transferS2W) || 0;
  if (w2s === 0 && s2w === 0) {
    return { error: '移動する人数を選択してください' };
  }
  if (w2s > (results?.workers || 0)) {
    return { error: 'ワーカーの数が不足しています' };
  }
  if (s2w > (results?.salesmen || 0)) {
    return { error: 'セールスマンの数が不足しています' };
  }
  const finalQuantity = w2s + s2w;
  return { finalQuantity, finalAmount: finalQuantity * 5, finalPrice: 5 };
}

// 採用 / その他（既定枝）: fall-through 用の final を返す
function buildDefaultFinal(ctx, form) {
  const { results } = ctx;
  const { selectedCategory, workersHired, salesmenHired, hirePrice, amount, quantity, price } = form;

  const finalAmount = selectedCategory === '採用'
    ? (Number(workersHired) || 0) * hirePrice + (Number(salesmenHired) || 0) * hirePrice
    : (amount === '' ? 0 : Number(amount));
  const finalQuantity = quantity === '' ? 0 : Number(quantity);
  const finalPrice = price === '' ? 0 : Number(price);

  // 生産能力 (PAC) の上限バリデーション
  if (['コ', 'サ'].includes(selectedCategory)) {
    if (finalQuantity > (results?.productionCapacity || 0)) {
      return { error: `入力された数量 (${finalQuantity}個) が現在の生産能力（最大 ${results?.productionCapacity || 0}個）を超えています。` };
    }
  }

  return { finalAmount, finalQuantity, finalPrice };
}

// fall-through 系の共通処理: final（finalQuantity/finalAmount/finalPrice）から
// 共通エントリを生成し、0円ブロック・借入(オ)の自動利息(タ)まで面倒を見る。
// 元 handleAddTransaction の後半（newEntry 構築以降）と完全に同一。
function finalizeCommonEntry(ctx, form, final) {
  const { carryover, ledger, currentPeriod, now } = ctx;
  const { selectedCategory, isFireSale, workersHired, salesmenHired, transferS2W, transferW2S, machineQuantities, machineSaleQuantities, salesData, fireSaleQty } = form;
  const { finalQuantity, finalPrice } = final;
  let { finalAmount } = final;

  // 0円取引のブロック (非現金取引は除外)
  const isCashTransaction = CATEGORIES[selectedCategory]?.isCash !== false;
  const actualAmount = finalAmount || (finalQuantity * finalPrice);
  if (isCashTransaction && actualAmount <= 0 && !['火災', '製造ミス', '盗難'].includes(selectedCategory)) {
    return { error: '0万円の処理は登録できません。金額や数量を確認してください。' };
  }

  const newEntry = {
    id: now.toString(),
    voucherNo: getNextVoucherNo(ledger).toString(),
    category: selectedCategory,
    quantity: finalQuantity,
    price: finalPrice,
    amount: finalAmount || (finalQuantity * finalPrice),
    customName: isFireSale
      ? '製品投げ売り'
      : (selectedCategory === 'セ' ? '広告費の支払' : undefined),
    customShortName: isFireSale
      ? '投売'
      : (selectedCategory === 'セ' ? '広告' : undefined),
    workersHired: selectedCategory === '採用' ? (Number(workersHired) || 0) : (selectedCategory === '配置転換' ? (Number(transferS2W) || 0) - (Number(transferW2S) || 0) : 0),
    salesmenHired: selectedCategory === '採用' ? (Number(salesmenHired) || 0) : (selectedCategory === '配置転換' ? (Number(transferW2S) || 0) - (Number(transferS2W) || 0) : 0),
    largeMachines: selectedCategory === 'ケ' ? (machineQuantities.large || 0) : 0,
    smallMachines: selectedCategory === 'ケ' ? (machineQuantities.small || 0) : 0,
    attachments: selectedCategory === 'ケ' ? (machineQuantities.attachment || 0) : 0,
    soldLargeMachines: selectedCategory === 'イ' ? (machineSaleQuantities.large || 0) : 0,
    soldSmallMachines: selectedCategory === 'イ' ? (machineSaleQuantities.small || 0) : 0,
    soldAttachments: selectedCategory === 'イ' ? (machineSaleQuantities.attachment || 0) : 0,
    salesDetails: ['キ', 'ネ'].includes(selectedCategory) ? (() => {
      if (isFireSale) {
        return {
          fireSale: { qty: finalQuantity, price: 18, name: '投げ売り' }
        };
      }
      const details = {};
      MARKETS.filter(m => m.id !== 'stocker').forEach(m => {
        const qty = salesData[m.id]?.qty || 0;
        const prc = Number(salesData[m.id]?.price) || 0;
        if (qty > 0 && prc > 0) details[m.id] = { qty, price: prc, name: m.name };
      });
      return details;
    })() : undefined
  };
  // fireSaleQty は元コードの newEntry 内では未使用だが、分割整合のため form から受け取っている
  void fireSaleQty;

  const updatedLedger = [...ledger, newEntry];
  const infoAlerts = [];

  const actualCategory = selectedCategory === 'MAX_Loan' ? 'オ' : selectedCategory;

  // Q4. 借入時（オ）的自動利息（タ）計算と追加
  if (actualCategory === 'オ' && finalAmount > 0) {
    newEntry.category = 'オ'; // Override the saved category
    // Determine max loan based on beginning net assets and current period
    const ratio = currentPeriod <= 3 ? 2 : 3;
    const beginningNetAssets = (carryover?.capital || 300) + (carryover?.retainedEarnings || 0);
    const limit = ratio * beginningNetAssets;

    const currentLedgerLoan = ledger.reduce((sum, item) => {
      if (item.category === 'オ') return sum + Number(item.amount || 0);
      if (item.category === 'ナ') return sum - Number(item.amount || 0);
      return sum;
    }, 0);
    const totalCurrentLoan = (carryover?.loan || 0) + currentLedgerLoan;

    if (totalCurrentLoan + finalAmount > limit) {
      const borrowable = Math.max(0, limit - totalCurrentLoan);
      return { error: `借入金残高の上限（${limit}万）を超過します。追加で借入可能な額は ${borrowable} 万までです。` };
    }

    const interestRate = (currentPeriod <= 3) ? 0.10 : 0.05;
    const interestAmount = Math.floor(finalAmount * interestRate); // 通常MGでは小数点切り捨てまたはそのまま、ここでは単純に計算
    if (interestAmount > 0) {
      const interestEntry = {
        id: (now + 1).toString(),
        voucherNo: getNextVoucherNo(updatedLedger).toString(),
        category: 'タ',
        quantity: 0,
        price: 0,
        amount: interestAmount,
        workersHired: 0,
        salesmenHired: 0
      };
      updatedLedger.push(interestEntry);
      // 通知（元コードは alert）
      infoAlerts.push(`借入金 ¥${finalAmount}万に対し、${interestRate * 100}% の利息（¥${interestAmount}万）を自動で「営業外費用(タ)」として追加しました。`);
    }
  }

  return { ledger: updatedLedger, infoAlerts };
}

// エントリの唯一の入口。元 handleAddTransaction の分岐構造をそのまま再現する。
// form には CashLedger のフォーム系 state（selectedCategory を含む）を渡す。
export function buildTransactionEntries(ctx, form) {
  const {
    now = Date.now(),
    rand = Math.random,
    ...rest
  } = ctx;
  const fullCtx = { ...rest, now, rand };

  const { selectedCategory } = form;

  if (!selectedCategory) {
    return { error: '項目を選択してください' };
  }

  // --- 早期リターン枝（独自にエントリを組み立てて確定する） ---
  if (selectedCategory === '売掛割引') return buildFactoring(fullCtx, form);
  if (selectedCategory === 'リスクカード') return buildRiskCard(fullCtx, form);
  if (selectedCategory === '期首処理') return buildPeriodOpening(fullCtx, form);
  if (selectedCategory === '生産') return buildProduction(fullCtx, form);
  if (selectedCategory === '緑チップ') return buildGreenChips(fullCtx, form);

  // --- fall-through 枝（final を作って共通エントリ生成へ） ---
  let final;
  if (['キ', 'ネ'].includes(selectedCategory)) {
    final = buildSalesFinal(fullCtx, form);
  } else if (['ツ', 'ノ'].includes(selectedCategory)) {
    final = buildMaterialPurchaseFinal(fullCtx, form);
  } else if (selectedCategory === 'ケ') {
    final = buildMachinePurchaseFinal(fullCtx, form);
  } else if (selectedCategory === 'セ') {
    final = buildAdPurchaseFinal(fullCtx, form);
  } else if (selectedCategory === 'チ') {
    final = { finalQuantity: 1, finalAmount: form.rdPrice, finalPrice: form.rdPrice };
  } else if (selectedCategory === '保険') {
    final = buildInsuranceFinal(fullCtx);
  } else if (selectedCategory === 'イ') {
    final = buildMachineSaleFinal(fullCtx, form);
  } else if (selectedCategory === '配置転換') {
    final = buildTransferFinal(fullCtx, form);
  } else {
    final = buildDefaultFinal(fullCtx, form);
  }

  if (final.error) return { error: final.error };

  return finalizeCommonEntry(fullCtx, form, final);
}
