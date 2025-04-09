// utils/dateUtils.js

function parseStartDateBR(dateStr) {
  const parts = dateStr.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 1); // 00:00:01
}

function parseEndDateBR(dateStr) {
  const parts = dateStr.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59); // 23:59:59
}

function diffInDays(start, end) {
  const ONE_DAY = 1000 * 60 * 60 * 24;
  const diff = Math.abs(end - start);
  return Math.ceil(diff / ONE_DAY);
}

function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

module.exports = {
  parseStartDateBR,
  parseEndDateBR,
  diffInDays,
  isWeekend
};