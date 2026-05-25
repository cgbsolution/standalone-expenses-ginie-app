const { formatDateTime } = require('./utils/dateUtils.js');

const testDates = [
  '2026-01-31 21:33',
  '2026-01-31 09:33',
  '2026-01-31 00:00',
  '2026-01-31 12:00',
  new Date(2026, 0, 31, 21, 33),
  new Date(2026, 0, 31, 9, 33),
  new Date(2026, 0, 31, 0, 0),
  new Date(2026, 0, 31, 12, 0),
];

console.log('Testing formatDateTime:');
testDates.forEach(date => {
  console.log(`${date} -> ${formatDateTime(date)}`);
});
