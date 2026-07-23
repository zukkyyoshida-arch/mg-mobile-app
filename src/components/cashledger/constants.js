// CashLedger 関連の定数を集約したモジュール。
//
// CATEGORIES / SALARY_TABLE は元々 CashLedger.jsx が `../utils/calculations` から
// import していたもの。import 元をこのファイルに一本化するため、ここで再 export して
// 互換性を維持する（他ファイルからこのモジュール経由で参照しても同じ実体が得られる）。
export { CATEGORIES, SALARY_TABLE } from '../../utils/calculations';

// 市場マスタ（元 CashLedger.jsx 冒頭の MARKETS）
export const MARKETS = [
  { id: 'sapporo', name: '札幌', basePrice: 10, max: 3 },
  { id: 'sendai', name: '仙台', basePrice: 11, max: 4 },
  { id: 'tokyo', name: '東京', basePrice: 12, max: 6 },
  { id: 'nagoya', name: '名古屋', basePrice: 13, max: 9 },
  { id: 'osaka', name: '大阪', basePrice: 14, max: 13 },
  { id: 'fukuoka', name: '福岡', basePrice: 15, max: 20 },
  { id: 'stocker', name: 'ストッカー', basePrice: 16, max: 0 }
];

// 機械マスタ（元 CashLedger.jsx 冒頭の MACHINES）
export const MACHINES = [
  { id: 'large', name: '大型機械', basePrice: 200 },
  { id: 'small', name: '小型機械', basePrice: 100 },
  { id: 'attachment', name: 'アタッチメント', basePrice: 20 }
];

// 広告マスタ（元 CashLedger.jsx 冒頭の ADS）
export const ADS = [
  { id: 'ad5', name: '広告 (5)', basePrice: 5 },
  { id: 'ad10', name: '広告 (10)', basePrice: 10 },
  { id: 'ad20', name: '広告 (20)', basePrice: 20 }
];

// 商品販売の市場別上限単価（元 CashLedger.jsx 冒頭の MARKET_MAX_PRICES）
export const MARKET_MAX_PRICES = {
  sapporo: 40,
  sendai: 36,
  tokyo: 32,
  nagoya: 28,
  osaka: 24,
  fukuoka: 20
};
