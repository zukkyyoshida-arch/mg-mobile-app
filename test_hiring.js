const { calculateFinancials, DEFAULT_PERIOD_DATA } = require('./src/utils/calculations');

// 初期状態
const carryover = DEFAULT_PERIOD_DATA.carryover;

// 採用1人 (50,000円の支出) エントリ
const ledger = [
  {
    category: '採用',
    amount: -50000,
    quantity: 0,
    workersHired: 1,
    salesmenHired: 0,
    // other fields not needed
  }
];

const period = 1; // 1期目

const result = calculateFinancials(carryover, ledger, {}, period);

console.log('bookEndingCash:', result.bookEndingCash);
console.log('endingCash (B/S):', result.bs.cash);
