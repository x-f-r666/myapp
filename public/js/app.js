/** 应用入口：加载数据、路由、状态变更、自动/手动保存、整体外壳渲染。 */
import { MODULES, SCHEMA_VERSION } from './core/model.js';
import { todayISO, formatCN, weekdayCN } from './core/dates.js';
import { dashboardSummary } from './core/stats.js';
import { icon, esc, toast } from './components/ui.js';
import { api, beaconSave } from './api.js';

import dashboardView from './views/dashboard.js';
import todayView from './views/today.js';
import contentView from './views/content.js';
import devView from './views/dev.js';
import consultingView from './views/consulting.js';
import fitnessView from './views/fitness.js';
import dietView from './views/diet.js';
import gamesView from './views/games.js';
import settingsView from './views/settings.js';

const VIEWS = {
  dashboard: dashboardView,
  today: todayView,
  content: contentView,
  dev: devView,
  consulting: consultingView,
  fitness: fitnessView,
  diet: dietView,
  games: gamesView,
  settings: settingsView,
};

const DEFAULT_ROUTE = 'dashboard';

let state = null;
let meta = { dataFile: '', backupDir: '', schemaVersion: SCHEMA_VERSION };
let currentKey = DEFAULT_ROUTE;
let lastSavedAt = null;
let dirty = false;
let saving = false;
let pendingSave = false;
let saveTimer = null;
let status = { kind: 'loading', message: '' };

/* -------------------------------- 保存逻辑 -------------------------------- */

function setStatus(kind, message = '') {
  status = { kind, message };
  renderSavePill();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow('auto');
  }, 700);
}

async function saveNow(reason = 'manual') {
  if (!state) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (saving) {
    pendingSave = true;
    return;
  }
  saving = true;
  setStatus('saving');
  try {
    const res = await api.saveState(state);
    lastSavedAt = res.savedAt || new Date().toISOString();
    dirty = false;
    setStatus('saved');
    renderStatusbar();
    if (reason === 'manual') toast('已保存到电脑上的数据文件');
  } catch (err) {
    setStatus('error', err.message);
    toast(`保存失败：${err.message}`, 'error', 4200);
  } finally {
    saving = false;
    if (pendingSave) {
      pendingSave = false;
      scheduleSave();
    }
  }
}

/* -------------------------------- 路由逻辑 -------------------------------- */

function parseRoute() {
  const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return VIEWS[raw] ? raw : DEFAULT_ROUTE;
}

function navigate(key) {
  if (!VIEWS[key]) return;
  if (dirty) saveNow('route');
  location.hash = `#/${key}`;
}

function currentModule() {
  return MODULES.find((m) => m.key === currentKey) || MODULES[0];
}

/* --------------------------------- 上下文 --------------------------------- */

const ctx = {
  get state() {
    return state;
  },
  get route() {
    return currentKey;
  },
  get today() {
    return todayISO();
  },
  navigate,
  summary: () => dashboardSummary(state),
  update(fn, { rerender = true } = {}) {
    if (!state) return;
    fn(state);
    dirty = true;
    setStatus('dirty');
    scheduleSave();
    if (rerender) render();
  },
  /** 只重绘界面（切换筛选、翻月等纯 UI 状态），不算数据改动 */
  rerender() {
    render();
  },
  saveNow,
  reload: async () => {
    const res = await api.getState();
    state = res.state;
    lastSavedAt = res.savedAt;
    dirty = false;
    setStatus('saved');
    render();
    renderStatusbar();
  },
  toast,
};

/* --------------------------------- 渲染 ---------------------------------- */

function renderSidebar() {
  const el = document.getElementById('sidebar');
  if (!el) return;
  const openTasks = state ? state.today.tasks.filter((t) => t.date === todayISO() && !t.done).length : 0;
  const summary = state ? dashboardSummary(state) : null;
  const dueFollow = summary ? summary.followUps.length : 0;

  const counts = {
    today: openTasks,
    consulting: dueFollow,
    content: state ? state.content.ideas.filter((i) => (i.stage || 'idea') !== 'published').length : 0,
    dev: state ? state.dev.items.filter((i) => i.status === 'doing').length : 0,
  };

  const navItem = (m) => {
    const badge = counts[m.key];
    return `<button class="nav-item ${m.key === currentKey ? 'on' : ''}" type="button" data-go="${m.key}" title="${esc(
      m.label
    )}">${icon(m.icon, 17)}<span>${esc(m.label)}</span>${
      badge ? `<span class="nav-count">${badge > 99 ? '99+' : badge}</span>` : ''
    }</button>`;
  };
  const group = (slice) => slice.map(navItem).join('');

  el.innerHTML = `<div class="brand">
      <div class="brand-mark">生</div>
      <div class="brand-text"><span class="brand-name">个人工作生活台</span><span class="brand-sub">Life Console</span></div>
    </div>
    <nav class="nav" aria-label="模块导航">
      <div class="nav-label">总览</div>
      ${group(MODULES.slice(0, 2))}
      <div class="nav-label">工作</div>
      ${group(MODULES.slice(2, 5))}
      <div class="nav-label">生活</div>
      ${group(MODULES.slice(5, 8))}
      <div class="nav-label">系统</div>
      ${group(MODULES.slice(8))}
    </nav>
    <div class="sidebar-foot">
      <div>数据保存在<strong>本机</strong></div>
      <div>v1.0 · 无需联网</div>
    </div>`;
}

function savePillHTML() {
  const map = {
    loading: ['is-saving', '正在读取数据'],
    dirty: ['is-dirty', '有未保存修改'],
    saving: ['is-saving', '保存中…'],
    saved: ['is-saved', lastSavedAt ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '已保存'],
    error: ['is-error', `保存失败${status.message ? `：${status.message}` : ''}`],
  };
  const [cls, text] = map[status.kind] || map.saved;
  return `<span class="save-pill ${cls}" data-save-pill><span class="pip"></span>${esc(text)}</span>`;
}

function renderSavePill() {
  const host = document.querySelector('[data-save-host]');
  if (!host) return;
  host.innerHTML = `${savePillHTML()}<button class="btn btn-primary btn-sm" type="button" data-act="save">${icon(
    'save',
    14
  )}保存</button>`;
}

function renderTopbar() {
  const el = document.getElementById('topbar');
  if (!el) return;
  const mod = currentModule();
  const today = todayISO();
  el.innerHTML = `<div class="topbar-title">
      <h1>${esc(mod.label)}</h1>
      <p>${esc(mod.desc)}</p>
    </div>
    <div class="topbar-actions">
      <span class="icon-text nowrap" title="今天是 ${today}">${icon('calendar', 14)}${formatCN(today)} ${weekdayCN(today)}</span>
      <div class="save-wrap" data-save-host>${savePillHTML()}<button class="btn btn-primary btn-sm" type="button" data-act="save">${icon(
    'save',
    14
  )}保存</button></div>
    </div>`;
}

function renderStatusbar() {
  const el = document.getElementById('statusbar');
  if (!el) return;
  el.innerHTML = `<span class="icon-text">${icon('database', 13)}<span class="path" title="${esc(
    meta.dataFile || ''
  )}">${esc(meta.dataFile || 'data/app-data.json')}</span></span>
    <span class="icon-text">${icon('clock', 13)}${lastSavedAt ? `最后保存 ${new Date(lastSavedAt).toLocaleString('zh-CN')}` : '尚未保存'}</span>
    <span class="spacer"></span>
    <span>自动保存已开启 · Ctrl+S 手动保存 · Schema v${SCHEMA_VERSION}</span>`;
}

function render() {
  if (!state) return;
  const view = VIEWS[currentKey] || VIEWS[DEFAULT_ROUTE];
  renderSidebar();
  renderTopbar();
  renderStatusbar();
  const main = document.getElementById('view');
  if (!main) return;
  const scrollY = window.scrollY;
  let html;
  try {
    html = view.render(state, ctx);
  } catch (err) {
    console.error(err);
    html = `<div class="card pad"><h3>这个页面渲染出错了</h3><p class="muted small mt-8">${esc(
      err.message
    )}</p><p class="muted small mt-8">数据没有丢失，可以切换到其它模块，或刷新页面重试。</p></div>`;
  }
  main.innerHTML = html;
  if (typeof view.bind === 'function') {
    try {
      view.bind(main, ctx);
    } catch (err) {
      console.error(err);
      toast(`页面交互初始化失败：${err.message}`, 'error');
    }
  }
  window.scrollTo({ top: scrollY });
}

/* -------------------------------- 全局事件 -------------------------------- */

function bindGlobal() {
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) {
      e.preventDefault();
      navigate(go.dataset.go);
      return;
    }
    if (e.target.closest('[data-act="save"]')) {
      e.preventDefault();
      saveNow('manual');
    }
  });

  window.addEventListener('hashchange', () => {
    const next = parseRoute();
    if (next === currentKey) return;
    currentKey = next;
    render();
    document.getElementById('view')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveNow('manual');
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    beaconSave(state);
    e.preventDefault();
    e.returnValue = '';
  });

  window.addEventListener('pagehide', () => {
    if (dirty) beaconSave(state);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) saveNow('hidden');
  });
}

/* ---------------------------------- 启动 --------------------------------- */

async function boot() {
  const app = document.getElementById('app');
  if (app) app.setAttribute('aria-busy', 'true');
  bindGlobal();
  currentKey = parseRoute();
  try {
    const res = await api.getState();
    state = res.state;
    lastSavedAt = res.savedAt;
    if (res.dataFile) meta.dataFile = res.dataFile;
    if (res.backupDir) meta.backupDir = res.backupDir;
    dirty = false;
    setStatus('saved');
    render();
    if (res.recovered) {
      toast(`原来的数据文件损坏，已备份为 ${res.corruptFile}，本次以空数据启动`, 'warn', 6000);
    }
    if (!state.settings.nickname) {
      setTimeout(() => toast('第一次使用：先去「数据与设置」写下你的昵称和每日目标', 'ok', 4200), 800);
    }
  } catch (err) {
    const main = document.getElementById('view');
    if (main) {
      main.innerHTML = `<div class="card pad">
        <h2>打不开数据</h2>
        <p class="muted small mt-8">${esc(err.message)}</p>
        <div class="hint-box mt-16">${icon('alert', 15)}<span>请确认启动窗口还开着。如果窗口已关闭，双击项目里的 <b>start.bat</b> 重新启动，然后刷新本页。</span></div>
        <button class="btn btn-primary mt-16" type="button" onclick="location.reload()">重新加载</button>
      </div>`;
    }
    setStatus('error', err.message);
  } finally {
    if (app) app.removeAttribute('aria-busy');
  }
}

boot();

// 供调试使用
window.__APP__ = { get state() { return state; }, ctx, saveNow };
