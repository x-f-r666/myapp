/** 通用 UI 组件：图标、弹窗、提示、表单控件、空状态。全部返回字符串或操作 DOM。 */

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="M16 10.5 22 7v10l-6-3.5"/>',
  code: '<path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/>',
  briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M2.5 12.5h19"/>',
  dumbbell: '<path d="M4 9v6"/><path d="M7 7v10"/><path d="M17 7v10"/><path d="M20 9v6"/><path d="M7 12h10"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M7 21h10"/><path d="M9 7c0-1 1-1.5 1-2.5"/><path d="M14 7c0-1 1-1.5 1-2.5"/>',
  game: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11.5" r="1"/><circle cx="18.5" cy="14" r="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 3h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5v.5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-6.5 0-4.5-4.5-6-4.5-11.5-3 1.5-4.5 4-4.5 6 0 1.5-1 2-1.5 1.5C7 10 6 9 6 9c0 3-1 4.5-1 6.5C5 19.2 8 22 12 22Z"/>',
  star: '<path d="m12 3.5 2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.9-5.3 2.9 1-6L3.4 9.8l6-.9L12 3.5Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18.5 20a6.6 6.6 0 0 0-2.5-5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};

export function icon(name, size = 18, cls = '') {
  const path = ICONS[name] || ICONS.spark;
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* ------------------------------- 数字与文本 ------------------------------- */

export function fmtNum(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('zh-CN');
}

export function fmtCompact(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 100000000) return `${(v / 100000000).toFixed(1)}亿`;
  if (abs >= 10000) return `${(v / 10000).toFixed(abs >= 100000 ? 0 : 1)}万`;
  return fmtNum(v);
}

export function fmtMoney(n) {
  const v = Number(n) || 0;
  if (v >= 10000) return `¥${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}万`;
  return `¥${v.toLocaleString('zh-CN')}`;
}

export function fmtMinutes(min) {
  const m = Number(min) || 0;
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
}

export function fmtSize(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function truncate(s, n = 60) {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

/* ---------------------------------- 提示 ---------------------------------- */

export function toast(message, type = 'ok', ms = 2600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'check', 16)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/* ---------------------------------- 弹窗 ---------------------------------- */

let escHandler = null;
let closeCb = null;

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
  document.body.classList.remove('modal-open');
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  const cb = closeCb;
  closeCb = null;
  if (typeof cb === 'function') cb();
}

export function openModal({ title, subtitle = '', body = '', footer = '', size = 'md', onMount, onClose } = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return { close: closeModal, el: null };
  root.hidden = false;
  root.innerHTML = `<div class="modal-backdrop" data-close="1"></div>
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        <div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button class="btn btn-icon" type="button" data-close="1" aria-label="关闭">${icon('close', 18)}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  document.body.classList.add('modal-open');
  root.querySelectorAll('[data-close="1"]').forEach((el) => el.addEventListener('click', closeModal));
  escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);
  if (typeof onClose === 'function') closeCb = onClose;
  if (typeof onMount === 'function') onMount(root.querySelector('.modal'), closeModal);
  const firstInput = root.querySelector('input, textarea, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 30);
  return { close: closeModal, el: root.querySelector('.modal') };
}

export function confirmDialog({
  title = '确认操作',
  message = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  extra = '',
} = {}) {
  return new Promise((resolve) => {
    const { el } = openModal({
      title,
      body: `<p class="confirm-text">${esc(message)}</p>${extra}`,
      size: 'sm',
      footer: `<button class="btn btn-ghost" data-act="cancel" type="button">${esc(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok" type="button">${esc(confirmText)}</button>`,
      onClose: () => resolve(false),
      onMount: (node, close) => {
        const done = (val) => {
          resolve(val);
          close();
        };
        node.querySelector('[data-act="cancel"]').addEventListener('click', () => done(false));
        node.querySelector('[data-act="ok"]').addEventListener('click', () => {
          const checkbox = node.querySelector('[data-confirm-check]');
          done(checkbox ? checkbox.checked : true);
        });
      },
    });
    if (!el) resolve(false);
  });
}

/* ---------------------------------- 表单 ---------------------------------- */

export function field({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  hint = '',
  required = false,
  min,
  max,
  step,
  rows = 3,
  options = null,
  span = 1,
  autofocus = false,
} = {}) {
  const id = `f_${name}_${Math.random().toString(36).slice(2, 6)}`;
  let control;
  if (options) {
    const opts = options
      .map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
      })
      .join('');
    control = `<select id="${id}" name="${esc(name)}" class="control">${opts}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea id="${id}" name="${esc(name)}" class="control" rows="${rows}" placeholder="${esc(
      placeholder
    )}" ${required ? 'required' : ''}>${esc(value)}</textarea>`;
  } else {
    control = `<input id="${id}" name="${esc(name)}" class="control" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(
      placeholder
    )}" ${required ? 'required' : ''} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${
      step !== undefined ? `step="${step}"` : ''
    } ${autofocus ? 'autofocus' : ''}/>`;
  }
  return `<label class="field span-${span}" for="${id}">
    <span class="field-label">${esc(label)}${required ? '<em>*</em>' : ''}</span>
    ${control}
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </label>`;
}

export function formGrid(inner, cols = 2) {
  return `<div class="form-grid cols-${cols}">${inner}</div>`;
}

export function readForm(scope) {
  const out = {};
  scope.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value.trim ? el.value.trim() : el.value;
  });
  return out;
}

/* -------------------------------- 展示组件 -------------------------------- */

export function emptyState({ iconName = 'spark', title = '还没有内容', text = '', action = '' } = {}) {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName, 22)}</div>
    <h4>${esc(title)}</h4>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${action ? `<div class="empty-action">${action}</div>` : ''}
  </div>`;
}

export function badge(text, tone = 'neutral') {
  return `<span class="badge badge-${tone}">${esc(text)}</span>`;
}

export function dot(color) {
  return `<span class="dot" style="background:${esc(color)}"></span>`;
}

export function statBlock({ label, value, unit = '', foot = '', iconName = '' }) {
  return `<div class="stat">
    <div class="stat-label">${iconName ? icon(iconName, 12) : ''}${esc(label)}</div>
    <div class="stat-value">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
    ${foot ? `<div class="stat-foot">${esc(foot)}</div>` : ''}
  </div>`;
}

export function progressBar(pct, tone = 'accent', label = '') {  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  return `<div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
    <span class="bar-fill bar-${tone}" style="width:${p}%"></span>
  </div>${label ? `<span class="bar-label">${esc(label)}</span>` : ''}`;
}

export function tabs({ name, items, active }) {
  return `<div class="tabs" role="tablist" data-tabs="${esc(name)}">${items
    .map(
      (it) => `<button class="tab ${it.key === active ? 'on' : ''}" role="tab" type="button" data-tab-key="${esc(it.key)}" aria-selected="${
        it.key === active
      }">${esc(it.label)}${it.count !== undefined ? `<span class="tab-count">${it.count}</span>` : ''}</button>`
    )
    .join('')}</div>`;
}

export function stars(rating) {
  const r = Math.round(Number(rating) || 0);
  return `<span class="stars" aria-label="评分 ${r} / 5">${Array.from({ length: 5 }, (_, i) =>
    `<span class="star ${i < r ? 'on' : ''}">★</span>`
  ).join('')}</span>`;
}

export function priorityTag(p) {
  const map = { high: ['高', 'danger'], mid: ['中', 'warn'], low: ['低', 'neutral'] };
  const [label, tone] = map[p] || map.mid;
  return `<span class="prio prio-${tone}">${esc(label)}</span>`;
}

export function initials(name) {
  const s = String(name || '?').trim();
  return esc(s.slice(0, 2).toUpperCase());
}

export function avatar(name, color = '#2C6353') {
  return `<span class="avatar" style="background:${esc(color)}">${initials(name)}</span>`;
}

let idSeed = 0;
export function uid(prefix = 'id') {
  idSeed += 1;
  return `${prefix}_${Date.now().toString(36)}${idSeed}${Math.random().toString(36).slice(2, 5)}`;
}
