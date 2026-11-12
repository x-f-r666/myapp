/** 日期工具：全部基于本地时区，避免 UTC 造成「早上记到昨天」。 */

const pad = (n) => String(n).padStart(2, '0');

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(date = new Date()) {
  return toISO(date);
}

/** 解析 YYYY-MM-DD 为本地日期（中午 12 点，规避夏令时边界） */
export function parseISO(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** 周一为一周起点 */
export function startOfWeek(iso) {
  const d = parseISO(iso);
  if (!d) return null;
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toISO(d);
}

/** 以 iso 结尾的最近 n 天（含当天），升序 */
export function lastNDays(n, endISO = todayISO()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDays(endISO, -i));
  return out;
}

/**
 * 月历矩阵：恒定 42 格（6 行 × 7 列），周一为第一列。
 * 返回 [{ iso, day, inMonth }]
 */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset, 12);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    cells.push({
      iso: toISO(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return cells;
}

/** 11月12日 */
export function formatCN(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 2026/11/12 */
export function shortCN(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 11/12 */
export function mdCN(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function weekdayCN(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
}

/** 2026年11月 */
export function monthLabel(year, month) {
  return `${year}年${month + 1}月`;
}

/** 今天 / 明天 / 昨天 / 11月12日 */
export function relativeDay(iso, today = todayISO()) {
  if (iso === today) return '今天';
  if (iso === addDays(today, 1)) return '明天';
  if (iso === addDays(today, -1)) return '昨天';
  return formatCN(iso);
}

/** 两个日期相差天数（a - b） */
export function diffDays(a, b) {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

export function isWeekend(iso) {
  const d = parseISO(iso);
  if (!d) return false;
  return d.getDay() === 0 || d.getDay() === 6;
}

/** 当前时间问候语 */
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return '凌晨好';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export { pad };
