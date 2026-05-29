import { calculateFinancials, DEFAULT_PERIOD_DATA } from './src/utils/calculations.js';

// Test simple case: just period 1, no transactions
let res = calculateFinancials(DEFAULT_PERIOD_DATA.carryover, [], {}, 1);
console.log("No transactions diff:", res.bs.difference);

// Test with 1 period end processing (1 worker, 1 salesman)
res = calculateFinancials(DEFAULT_PERIOD_DATA.carryover, [
  { category: "シ", amount: 18 },
  { category: "セ", amount: 18 },
  { category: "ソ", amount: 24 }, // 12 * 2
], {}, 1);
console.log("With Period End diff:", res.bs.difference);

