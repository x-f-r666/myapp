/** 月历组件：42 格固定 6 行，周一为第一列，格子内容由调用方决定。 */
import { monthMatrix, todayISO } from '../core/dates.js';
import { esc } from './ui.js';

export const WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'];

export function calendarHead(year, month) {
  return `<div class="cal-head">
    <div class="cal-title"><span class="cal-year">${year}</span><span class="cal-month">${month + 1} 月</span></div>
    <div class="cal-nav">
      <button class="btn btn-icon" type="button" data-cal="prev" aria-label="上个月">‹</button>
      <button class="btn btn-ghost btn-sm" type="button" data-cal="today">回到今天</button>
      <button class="btn btn-icon" type="button" data-cal="next" aria-label="下个月">›</button>
    </div>
  </div>`;
}

/**
 * @param {object} opts
 * @param {number} opts.year
 * @param {number} opts.month 0-11
 * @param {(cell:{iso:string,day:number,inMonth:boolean}) => string} opts.dayHtml 格子内部 HTML
 * @param {string} [opts.selected] 选中日期
 * @param {string} [opts.today]
 */
export function monthCalendar({ year, month, dayHtml, selected = '', today = todayISO() }) {
  const cells = monthMatrix(year, month);
  const grid = cells
    .map((cell) => {
      const cls = [
        'cal-cell',
        cell.inMonth ? '' : 'outside',
        cell.iso === today ? 'today' : '',
        cell.iso === selected ? 'selected' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<button class="${cls}" type="button" data-date="${esc(cell.iso)}" aria-label="${esc(cell.iso)}">
        <span class="cal-day">${cell.day}</span>
        <span class="cal-body">${cell.inMonth ? dayHtml(cell) : ''}</span>
      </button>`;
    })
    .join('');

  return `<div class="cal">
    <div class="cal-week">${WEEK_HEADS.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${grid}</div>
  </div>`;
}
