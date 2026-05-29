import { calculateFinancials, DEFAULT_PERIOD_DATA } from './src/utils/calculations.js';

const ledger = [
  { category: "ケ", amount: 200, quantity: 1 },
  { category: "ツ", amount: 30, quantity: 3 },
  { category: "採用", amount: 10, workersHired: 1, salesmenHired: 1 },
  { category: "コ", amount: 6, quantity: 3 },
  { category: "サ", amount: 3, quantity: 3 },
  { category: "キ", amount: 120, quantity: 3 },
  { category: "PAC", amount: 10 },
  { category: "MD", amount: 10 },
  { category: "ツ", amount: 120, quantity: 13 },
  { category: "コ", amount: 10, quantity: 5 },
  { category: "サ", amount: 5, quantity: 5 },
  { category: "コ", amount: 10, quantity: 5 },
  { category: "キ", amount: 192, quantity: 5 },
  { category: "シ", amount: 18 },
  { category: "セ", amount: 18 },
  { category: "ソ", amount: 24 },
];

let res = calculateFinancials(DEFAULT_PERIOD_DATA.carryover, ledger, {}, 1);
console.log("Full ledger diff:", res.bs.difference);
console.log("Total Assets:", res.bs.totalAssets);
console.log("Total Liab & Equity:", res.bs.totalLiabilitiesAndNetAssets);
