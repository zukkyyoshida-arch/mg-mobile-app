// タイムラインの「入力し直す」と「削除の取り消し」を支える純粋関数群。
//
// 「入力し直す」は、確認後に元取引を削除してから入力画面を開く（受講者は古い取引を
// 消して入れ直す運用のため）。ただし次の2点を守る。
//   1. 1回の登録で複数行になった取引（借入＋利息、独占販売の市場別行、生産のコ＋サ など）は
//      全行まとめて削除する（一部だけ残って二重計上になるのを防ぐ）… getEntryGroup
//   2. 入力画面は元の項目を選んだ状態で開き、復元できる値は事前入力する … entryToFormState
// 削除後の「元に戻す」も組ごと元の位置へ戻す … removeEntryWithPositions / restoreRemovedEntries
// React に依存しないため、ここで単体テストできる。
import { MARKETS, ADS } from './constants';

const EMPTY_MARKET_QTYS = { sapporo: 0, sendai: 0, tokyo: 0, nagoya: 0, osaka: 0, fukuoka: 0 };

const toStr = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : String(Number(v)));
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 1回の登録で同時に作られた行の id は「<登録時刻>-<種類>」の形になる
// （例: 1700000000000-sale-tokyo / -ko / -sa / -pac-0 / -ar / -kisho）。
// groupId を持たない旧来の複数行登録は、この時刻部分の一致で同じ登録とみなす。
const SUBMISSION_ID = /^(\d+)-/;
function submissionKey(entry) {
  const m = String(entry?.id ?? '').match(SUBMISSION_ID);
  return m ? m[1] : null;
}

// 取引が属する組（同じ登録から生まれた全行）。組でなければ自分だけ。
//   - groupId があれば groupId が同じ行（借入＋自動利息、リスクカードの組など）
//   - groupId がなければ、id の登録時刻部分が同じ行（独占販売の市場別行、生産のコ＋サ など）
export function getEntryGroup(ledger, entry) {
  if (!entry) return [];
  const list = ledger || [];
  let group = [];
  if (entry.groupId) {
    group = list.filter(e => e.groupId === entry.groupId);
  } else {
    const key = submissionKey(entry);
    if (key) group = list.filter(e => !e.groupId && submissionKey(e) === key);
  }
  return group.length > 0 ? group : [entry];
}

// 組の伝票番号（数値・昇順）。編集後もこの番号を引き継ぐ。
export function getGroupVoucherNos(group) {
  return group
    .map(t => Number.parseInt(t.voucherNo, 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

// 独占販売（広告）は市場ごとに1行ずつ登録される。組の全行から市場別の数量を戻す。
function monopolyAdQtys(group) {
  const qtys = { ...EMPTY_MARKET_QTYS };
  group.forEach(t => {
    const m = String(t.id ?? '').match(/-sale-([a-z]+)$/);
    if (m && Object.prototype.hasOwnProperty.call(qtys, m[1])) qtys[m[1]] += toNum(t.quantity);
  });
  return qtys;
}

// リスクカード由来の取引から、リスクカード画面の選択状態を復元する。
// 当てはまらなければ null。
function riskStateFromGroup(entry, group) {
  const has = (pred) => group.some(pred);
  const nameIs = (name) => (t) => t.customName === name;
  const id = String(entry.id ?? '');

  // ネガティブ（組で登録されるもの）
  if (has(t => t.category === '退職')) {
    const retire = group.find(t => t.category === '退職');
    const isSalesman = toNum(retire.salesmenResigned) > 0 || retire.customName === 'セールスマン退職';
    return { riskTab: 'negative', riskAction: isSalesman ? 'retire_salesman' : 'retire_worker' };
  }
  if (has(nameIs('クレーム処理費用'))) return { riskTab: 'negative', riskAction: 'claim' };
  if (has(nameIs('機械故障修理費用'))) return { riskTab: 'negative', riskAction: 'machine_break' };
  if (has(nameIs('デザイン設計変更'))) return { riskTab: 'negative', riskAction: 'design_trouble' };
  if (has(t => t.category === '研究開発失敗')) return { riskTab: 'negative', riskAction: 'rd_fail' };
  if (has(t => t.category === '盗難') && entry.groupId) return { riskTab: 'negative', riskAction: 'theft' };
  if (has(t => t.category === '火災') && entry.groupId) return { riskTab: 'negative', riskAction: 'fire' };
  if (has(t => t.category === '製造ミス') && entry.groupId) return { riskTab: 'negative', riskAction: 'miss' };

  // ポジティブ（単独で登録されるもの）
  if (entry.customName === '特別サービス(広告)の支払') {
    return { riskTab: 'positive', riskAction: 'special_ad', riskQty: toStr(entry.quantity), riskPrice: '5' };
  }
  if (['ツ', 'ノ'].includes(entry.category) && id.endsWith('-mat')) {
    const p = toNum(entry.price);
    if (p === 10 || p === 12) {
      return {
        riskTab: 'positive',
        riskAction: p === 10 ? 'special_mat' : 'common_mat',
        riskQty: toStr(entry.quantity),
        riskPrice: String(p)
      };
    }
  }
  if (['キ', 'ネ'].includes(entry.category) && entry.usedRD) {
    return { riskTab: 'positive', riskAction: 'rd_success', riskQty: toStr(entry.quantity), riskPrice: toStr(entry.price) };
  }
  if (['キ', 'ネ'].includes(entry.category) && entry.usedAd) {
    const m = id.match(/-sale-([a-z]+)$/);
    if (m && Object.prototype.hasOwnProperty.call(EMPTY_MARKET_QTYS, m[1])) {
      return {
        riskTab: 'positive',
        riskAction: 'monopoly_ad',
        riskMonopolyAdQtys: monopolyAdQtys(group)
      };
    }
  }
  if (['キ', 'ネ'].includes(entry.category) && id.endsWith('-sale') && !entry.salesDetails) {
    // 独占販売（Sマン）: usedRD を持たない「-sale」単独エントリ
    return { riskTab: 'positive', riskAction: 'monopoly_salesman', riskQty: toStr(entry.quantity), riskPrice: toStr(entry.price) };
  }
  return null;
}

// 取引（と組）から、入力モーダルのフォーム状態を復元する。
// 戻り値: { form: { selectedCategory, ...復元できた値 }, note?: string }
//   note は「完全には復元できなかった」ことを受講者に伝える一文（なければ undefined）。
// form に含まれないキーは呼び出し側で初期値のままにする。
export function entryToFormState(entry, group = [entry]) {
  if (!entry) return { form: { selectedCategory: 'キ' } };
  const cat = entry.category;

  // --- 組で登録された取引 ---
  if (entry.groupId) {
    const loan = group.find(t => t.category === 'オ');
    if (loan) {
      return { form: { selectedCategory: 'オ', amount: toStr(loan.amount) } };
    }
    const ar = group.find(t => t.category === 'ア');
    if (ar) {
      return { form: { selectedCategory: '売掛割引', factoringAmount: toStr(ar.amount) } };
    }
  }

  const risk = riskStateFromGroup(entry, group);
  if (risk) return { form: { selectedCategory: 'リスクカード', ...risk } };

  if (entry.groupId) {
    // 組だが種類を特定できない（想定外の旧データ）。必須属性のない裸のエントリを
    // 作らないよう、リスクカードの選択画面へ戻す。
    return {
      form: { selectedCategory: 'リスクカード' },
      note: '元の取引の種類を特定できなかったため、リスクカードの項目を選び直してください。'
    };
  }

  // --- groupId なしで同時登録された複数行 ---
  if (group.some(t => t.category === '期首処理')) {
    return {
      form: { selectedCategory: '期首処理' },
      note: '期首処理をまとめて削除しました。期首処理を登録し直してください。'
    };
  }

  // --- 単独の取引 ---
  if (cat === 'キ' || cat === 'ネ') {
    const details = entry.salesDetails;
    if (details?.fireSale) {
      return { form: { selectedCategory: cat, isFireSale: true, fireSaleQty: toStr(details.fireSale.qty) } };
    }
    if (details && Object.keys(details).length > 0) {
      const salesData = {};
      MARKETS.filter(m => m.id !== 'stocker').forEach(m => {
        const d = details[m.id];
        salesData[m.id] = d ? { qty: toNum(d.qty), price: toStr(d.price) } : { qty: 0, price: '' };
      });
      return { form: { selectedCategory: cat, salesData } };
    }
    return {
      form: { selectedCategory: cat },
      note: `市場ごとの内訳が記録されていないため、販売した市場・数量・単価を入れ直してください（元: 合計${toNum(entry.quantity)}個・¥${toNum(entry.amount)}万）。`
    };
  }

  if (cat === 'ツ' || cat === 'ノ') {
    return {
      form: { selectedCategory: cat },
      note: `材料を買った市場の内訳は記録されていないため、市場ごとの数量を入れ直してください（元: 合計${toNum(entry.quantity)}個・¥${toNum(entry.amount)}万）。`
    };
  }

  if (cat === 'ケ') {
    return {
      form: {
        selectedCategory: 'ケ',
        machineQuantities: {
          large: toNum(entry.largeMachines),
          small: toNum(entry.smallMachines),
          attachment: toNum(entry.attachments)
        }
      }
    };
  }

  if (cat === 'イ') {
    return {
      form: {
        selectedCategory: 'イ',
        machineSaleQuantities: {
          large: toNum(entry.soldLargeMachines),
          small: toNum(entry.soldSmallMachines),
          attachment: toNum(entry.soldAttachments)
        },
        amount: toStr(entry.amount)
      }
    };
  }

  if (cat === 'セ') {
    // 口数の内訳は保存されないが、1種類だけで買った場合は 金額 = 口数 × 単価 から特定できる
    const q = toNum(entry.quantity);
    const a = toNum(entry.amount);
    const ad = q > 0 ? ADS.find(x => x.basePrice * q === a) : null;
    if (ad) {
      return { form: { selectedCategory: 'セ', adQuantities: { ad5: 0, ad10: 0, ad20: 0, [ad.id]: q } } };
    }
    return {
      form: { selectedCategory: 'セ' },
      note: `広告の種類ごとの口数は記録されていないため、入れ直してください（元: 合計${q}口・¥${a}万）。`
    };
  }

  if (cat === 'チ') {
    return { form: { selectedCategory: 'チ', rdPrice: toNum(entry.amount) || 20 } };
  }

  if (cat === '採用') {
    const w = toNum(entry.workersHired);
    const s = toNum(entry.salesmenHired);
    const unit = (w + s) > 0 ? toNum(entry.amount) / (w + s) : 0;
    const form = { selectedCategory: '採用', workersHired: toStr(w), salesmenHired: toStr(s) };
    if (Number.isInteger(unit) && unit > 0) form.hirePrice = unit;
    return { form };
  }

  if (cat === '配置転換') {
    // 保存されるのは差し引き（ワーカー増減）だけ。片方向の移動なら完全に復元できる。
    const net = toNum(entry.workersHired);
    return {
      form: {
        selectedCategory: '配置転換',
        transferS2W: net > 0 ? net : 0,
        transferW2S: net < 0 ? -net : 0
      }
    };
  }

  if (cat === 'コ' || cat === 'サ') {
    // 生産はコ（完成投入）とサ（製造投入）が同時登録される。組の両方から戻す。
    const qtyOf = (c) => {
      const rows = group.filter(t => t.category === c);
      return rows.length > 0 ? toStr(rows.reduce((sum, t) => sum + toNum(t.quantity), 0)) : '';
    };
    return { form: { selectedCategory: '生産', productionKo: qtyOf('コ'), productionSa: qtyOf('サ') } };
  }

  if (cat === 'PAC' || cat === 'MD' || cat === 'リサーチ') {
    const count = (c) => group.filter(t => t.category === c).length;
    return {
      form: {
        selectedCategory: '緑チップ',
        greenChips: { pac: count('PAC'), md: count('MD'), research: count('リサーチ') }
      }
    };
  }

  if (cat === '保険') {
    return { form: { selectedCategory: '保険' } };
  }

  if (cat === '売掛割引') {
    // 旧データの売掛割引カテゴリ
    return { form: { selectedCategory: '売掛割引', factoringAmount: toStr(entry.amount) } };
  }

  // 既定: 金額を戻す（借入返済ナ・その他出金ス・期首仕訳 ア/ヌ/ニ/タ など）
  return { form: { selectedCategory: cat, amount: toStr(entry.amount) } };
}

// 削除: 取り除いた取引と元の位置を返す（「元に戻す」用）。
// 同じ登録から生まれた行（getEntryGroup）はまとめて取り除く。
export function removeEntryWithPositions(ledger, entry) {
  const list = ledger || [];
  if (!entry) return { ledger: list, removed: [] };
  const ids = new Set(getEntryGroup(list, entry).map(e => e.id));
  const removed = [];
  const kept = [];
  list.forEach((e, index) => {
    if (ids.has(e.id)) removed.push({ entry: e, index });
    else kept.push(e);
  });
  return { ledger: kept, removed };
}

// 「元に戻す」: 取り除いた取引を元の位置に差し戻す。
// 既に同じ id の取引がある場合は二重に戻さない。
export function restoreRemovedEntries(ledger, removed) {
  const result = [...(ledger || [])];
  const existing = new Set(result.map(e => e.id));
  [...(removed || [])]
    .sort((a, b) => a.index - b.index)
    .forEach(({ entry, index }) => {
      if (existing.has(entry.id)) return;
      const at = Math.min(Math.max(0, index), result.length);
      result.splice(at, 0, entry);
      existing.add(entry.id);
    });
  return result;
}
