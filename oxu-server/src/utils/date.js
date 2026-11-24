const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const todayKey = () => keyOf(new Date());

const addDaysKey = (key, days) => {
  const [y, m, d] = key.split('-').map(Number);
  return keyOf(new Date(y, m - 1, d + days));
};

module.exports = { todayKey, addDaysKey };
