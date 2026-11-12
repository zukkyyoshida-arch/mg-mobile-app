// 販売数の上限（入力画面の MAX ボタンと、登録時の上限チェックで共通に使う）。
//
// 以前は上限が MAX ボタンの中にしかなく、数量を手で打ち込むと
// 「Sマン1名につき2個」などを超えた数でも登録できてしまった。
// 上限の計算をここに集め、ボタンと登録時チェックで同じ値を使う。
// React に依存しないため単体テストできる。
import { MARKETS } from './constants';

const toInt = (v) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// 販売能力（1単位につき2個）の根拠。リスクカードの販売系だけが持つ。
const CAPACITY_RULES = {
  monopoly_salesman: { key: 'activeSalesmen', unit: 'セールスマン', counter: '名', label: '商品の独占販売 (Sマン)' },
  monopoly_ad: { key: 'activeAdChips', unit: '広告チップ', counter: '枚', label: '商品の独占販売 (広告)' },
  rd_success: { key: 'activeRdChips', unit: '研究開発チップ', counter: '枚', label: '研究開発成功' }
};

// リスクカードの販売系アクションの上限。
// 戻り値: { limit, inventory, capacity, units, rule } … limit = min(在庫, 単位数×2)
export function getRiskSaleLimit(riskAction, results) {
  const rule = CAPACITY_RULES[riskAction];
  if (!rule) return null;
  const inventory = toInt(results?.prod?.endingCount);
  const units = toInt(results?.[rule.key]);
  const capacity = units * 2;
  return { limit: Math.min(inventory, capacity), inventory, capacity, units, rule };
}

// 上限の内訳を説明する一文（例: 「手持在庫 5個・セールスマン 1名×2個＝2個」）
export function describeRiskSaleLimit(info) {
  if (!info) return '';
  const { inventory, capacity, units, rule } = info;
  return `手持在庫 ${inventory}個・${rule.unit} ${units}${rule.counter}×2個＝${capacity}個`;
}

// フォームの販売数量が上限を超えていればエラー文、超えていなければ null。
// 対象: キ/ネ（通常販売・投げ売り）とリスクカードの販売系（独占販売・研究開発成功）。
export function getSalesLimitError(form, results) {
  if (!form) return null;
  const inventory = toInt(results?.prod?.endingCount);

  if (form.selectedCategory === 'リスクカード' && form.riskTab === 'positive') {
    const info = getRiskSaleLimit(form.riskAction, results);
    if (!info) return null;
    const qty = form.riskAction === 'monopoly_ad'
      ? Object.values(form.riskMonopolyAdQtys || {}).reduce((sum, q) => sum + toInt(q), 0)
      : toInt(form.riskQty);
    if (qty <= info.limit) return null;
    const reason = info.inventory < info.capacity
      ? `手持在庫が ${info.inventory}個のため`
      : `${info.rule.unit}1${info.rule.counter}につき2個まで（${info.rule.unit} ${info.units}${info.rule.counter}）のため`;
    return `${info.rule.label}で販売できるのは ${info.limit}個までです（入力: ${qty}個）。\n${reason}、${info.limit}個を超える数量は登録できません。\n内訳: ${describeRiskSaleLimit(info)}`;
  }

  if (form.selectedCategory === 'キ' || form.selectedCategory === 'ネ') {
    if (form.isFireSale) {
      const qty = toInt(form.fireSaleQty);
      if (qty > inventory) {
        return `投げ売りで販売できるのは手持在庫の ${inventory}個までです（入力: ${qty}個）。`;
      }
      return null;
    }
    const salesData = form.salesData || {};
    let total = 0;
    for (const m of MARKETS) {
      if (m.id === 'stocker') continue;
      const qty = toInt(salesData[m.id]?.qty);
      total += qty;
      if (m.max != null && qty > m.max) {
        return `${m.name}で販売できるのは ${m.max}個までです（入力: ${qty}個）。`;
      }
    }
    if (total > inventory) {
      return `販売できるのは手持在庫の ${inventory}個までです（入力: 合計${total}個）。`;
    }
  }
  return null;
}
