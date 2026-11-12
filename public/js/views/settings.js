/** 数据与设置：手动保存、备份恢复、导入导出、清空、偏好与数据概览。 */
import { MODULES, SCHEMA_VERSION, moduleCounts, todayISO } from '../core/model.js';
import { esc, icon, badge, openModal, confirmDialog, statBlock, fmtSize, toast } from '../components/ui.js';
import { api } from '../api.js';

let backups = [];
let backupsLoaded = false;
let fileSize = 0;

const CLEARABLE = [
  { key: 'today', label: '今日计划（任务 + 备忘）' },
  { key: 'content', label: '自媒体（选题 + 发布记录）' },
  { key: 'dev', label: '开发工作（项目 + 工作项 + 工时）' },
  { key: 'consulting', label: '咨询工作（客户 + 项目 + 沟通）' },
  { key: 'fitness', label: '健身计划（训练记录）' },
  { key: 'diet', label: '饮食计划（每日记录）' },
  { key: 'games', label: '游戏娱乐（清单 + 记录）' },
];

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind) {
  return kind === 'auto' ? '自动' : kind === 'pre-restore' ? '恢复前快照' : '手动';
}

async function refreshBackups(host) {
  host.innerHTML = `<p class="tiny muted">正在读取备份列表…</p>`;
  try {
    const res = await api.listBackups();
    backups = res.backups || [];
    backupsLoaded = true;
    host.innerHTML = backups.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>备份文件</th><th>类型</th><th class="num-cell">大小</th><th>时间</th><th></th></tr></thead>
          <tbody>${backups
            .slice(0, 20)
            .map(
              (b) => `<tr>
                <td class="tiny" style="font-family:var(--mono)">${esc(b.name)}</td>
                <td>${badge(kindLabel(b.kind), b.kind === 'auto' ? 'neutral' : b.kind === 'pre-restore' ? 'warn' : 'accent')}</td>
                <td class="num-cell">${fmtSize(b.size)}</td>
                <td class="tiny muted nowrap">${fmtTime(b.mtime)}</td>
                <td><div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-restore="${esc(b.name)}">恢复</button></div></td>
              </tr>`
            )
            .join('')}</tbody></table></div>
          <p class="tiny muted mt-8">自动备份每天一份，保留最近 30 份；手动备份不会自动清理。共 ${backups.length} 份。</p>`
      : `<p class="tiny muted">还没有备份。点「立即备份」生成第一份。</p>`;
  } catch (err) {
    host.innerHTML = `<p class="tiny" style="color:var(--danger)">读取备份列表失败：${esc(err.message)}</p>`;
  }
}

export default {
  render(state, ctx) {
    const counts = moduleCounts(state);
    const nickname = state.settings.nickname || '';
    const sizes = [
      ['今日计划', counts.tasks + counts.memos, '条'],
      ['自媒体', counts.ideas + counts.posts, '条'],
      ['开发工作', counts.projects + counts.devItems + counts.logs, '条'],
      ['咨询工作', counts.clients + counts.consultProjects + counts.sessions, '条'],
      ['健身', counts.workouts, '次训练'],
      ['饮食', counts.dietDays, '天记录'],
      ['游戏娱乐', counts.games + counts.playSessions, '条'],
    ];

    return `
    <div class="split-main">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('save', 15)}保存</div><div class="card-sub">改动会自动保存，也可以随时手动存一次</div></div>
          </div>
          <div class="card-body">
            <div class="between">
              <div>
                <div class="small">数据文件</div>
                <div class="tiny muted" style="font-family:var(--mono);word-break:break-all">${
      esc(state.meta?.dataFile || '') || 'data/app-data.json'
    }</div>
              </div>
              <button class="btn btn-primary" type="button" data-act="save-now">${icon('save', 15)}立即保存</button>
            </div>
            <div class="hint-box mt-12">${icon('spark', 15)}
              <span>修改后 700ms 自动写入磁盘；切换模块、关闭页面前也会保存。顶栏一直有手动保存按钮，快捷键 <b>Ctrl + S</b>。</span>
            </div>
            <div class="kv mt-12"><span>最近保存时间</span><b>${esc(state.meta?.updatedAt ? new Date(state.meta.updatedAt).toLocaleString('zh-CN') : '—')}</b></div>
            <div class="kv"><span>文件大小</span><b data-file-size>${fileSize ? fmtSize(fileSize) : '读取中…'}</b></div>
            <div class="kv"><span>数据结构版本</span><b>v${SCHEMA_VERSION}</b></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('database', 15)}备份与恢复</div><div class="card-sub">改坏了、删错了，都可以从备份回来</div></div>
            <div class="card-actions">
              <button class="btn btn-soft btn-sm" type="button" data-act="backup">${icon('download', 13)}立即备份</button>
            </div>
          </div>
          <div class="card-body">
            <div class="row" style="flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" type="button" data-act="export">${icon('download', 13)}导出全部数据（JSON）</button>
              <button class="btn btn-ghost btn-sm" type="button" data-act="import">${icon('upload', 13)}从 JSON 文件导入</button>
              <input type="file" accept="application/json,.json" data-import-file hidden />
            </div>
            <div class="divider"></div>
            <div data-backups><p class="tiny muted">正在读取备份列表…</p></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title" style="color:var(--danger)">${icon('alert', 15)}危险操作</div><div class="card-sub">清空后无法撤销，建议先备份</div></div></div>
          <div class="card-body">
            <div class="row" style="flex-wrap:wrap">
              <select class="inline-select" data-clear-target aria-label="选择要清空的模块">
                ${CLEARABLE.map((m) => `<option value="${m.key}">${m.label}</option>`).join('')}
              </select>
              <button class="btn btn-danger-ghost" type="button" data-act="clear">${icon('trash', 14)}清空这个模块</button>
            </div>
            <p class="tiny muted mt-8">只清空选定模块，其它模块数据不受影响；偏好设置也不会被清空。</p>
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('settings', 15)}个人偏好</div><div class="card-sub">影响首页与各模块的目标</div></div></div>
          <div class="card-body">
            <div class="form-grid cols-2">
              <label class="field span-2"><span class="field-label">怎么称呼你</span>
                <input class="control" data-setting="nickname" value="${esc(nickname)}" placeholder="写在首页问候里" maxlength="20" /></label>
              <label class="field"><span class="field-label">每周健身目标（次）</span>
                <input class="control" type="number" min="0" max="21" data-setting="fitnessWeeklyGoal" value="${state.settings.fitnessWeeklyGoal || 0}" /></label>
              <label class="field"><span class="field-label">每日热量目标（kcal）</span>
                <input class="control" type="number" min="0" step="50" data-setting="calorieTarget" value="${state.settings.calorieTarget || 0}" /></label>
              <label class="field"><span class="field-label">每日蛋白质（g）</span>
                <input class="control" type="number" min="0" step="5" data-setting="proteinTarget" value="${state.settings.proteinTarget || 0}" /></label>
              <label class="field"><span class="field-label">每日饮水（杯）</span>
                <input class="control" type="number" min="0" step="1" data-setting="waterTarget" value="${state.settings.waterTarget || 0}" /></label>
              <label class="field span-2"><span class="field-label">自媒体默认平台</span>
                <select class="control" data-setting="contentPlatformDefault">
                  ${state.content.platforms
                    .map((p) => `<option value="${esc(p)}" ${p === state.settings.contentPlatformDefault ? 'selected' : ''}>${esc(p)}</option>`)
                    .join('')}
                </select></label>
            </div>
            <p class="tiny muted mt-8">改完立即生效并自动保存。</p>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('database', 15)}数据概览</div><div class="card-sub">都在这个 JSON 文件里</div></div></div>
          <div class="card-body">
            ${sizes.map(([label, value, unit]) => `<div class="kv"><span>${label}</span><b>${value} ${unit}</b></div>`).join('')}
            <div class="kv"><span>客户</span><b>${counts.clients} 位</b></div>
            <div class="kv"><span>工作项</span><b>${counts.devItems} 条</b></div>
            <div class="kv"><span>发布作品</span><b>${counts.posts} 条</b></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('clock', 15)}关于</div><div class="card-sub">本机运行 · 无需联网</div></div></div>
          <div class="card-body">
            <div class="kv"><span>应用</span><b>个人工作生活台 v1.0</b></div>
            <div class="kv"><span>运行方式</span><b>本地服务 + 浏览器</b></div>
            <div class="kv"><span>数据位置</span><b class="tiny">${esc(state.meta?.dataFile || 'data/app-data.json')}</b></div>
            <div class="kv"><span>备份目录</span><b class="tiny">data/backups/</b></div>
            <div class="kv"><span>今天</span><b>${todayISO()}</b></div>
            <div class="hint-box mt-12">${icon('alert', 14)}<span>换电脑或重装系统前，先到上面「导出全部数据」，把 JSON 文件存到网盘或 U 盘。</span></div>
          </div>
        </section>
      </div>
    </div>`;
  },

  bind(root, ctx) {
    const host = root.querySelector('[data-backups]');
    if (host && !backupsLoaded) refreshBackups(host);

    api
      .getState()
      .then((res) => {
        fileSize = res.size || 0;
        const el = root.querySelector('[data-file-size]');
        if (el) el.textContent = fmtSize(fileSize);
      })
      .catch(() => {});

    root.addEventListener('click', async (e) => {
      if (e.target.closest('[data-act="save-now"]')) {
        await ctx.saveNow('manual');
        return;
      }

      if (e.target.closest('[data-act="backup"]')) {
        try {
          await ctx.saveNow('manual');
          const res = await api.backup(ctx.state);
          toast(`已备份：${res.name}`);
          if (host) await refreshBackups(host);
        } catch (err) {
          toast(`备份失败：${err.message}`, 'error');
        }
        return;
      }

      if (e.target.closest('[data-act="export"]')) {
        await ctx.saveNow('auto');
        window.location.href = api.exportUrl;
        toast('已开始下载数据文件');
        return;
      }

      if (e.target.closest('[data-act="import"]')) {
        root.querySelector('[data-import-file]')?.click();
        return;
      }

      const restore = e.target.closest('[data-restore]');
      if (restore) {
        const name = restore.dataset.restore;
        const ok = await confirmDialog({
          title: '从这个备份恢复？',
          message: `将用「${name}」覆盖当前所有数据。恢复前会自动把现在的数据存一份「恢复前快照」。`,
          confirmText: '恢复',
          danger: true,
        });
        if (!ok) return;
        try {
          await api.restore(name);
          await ctx.reload();
          backupsLoaded = false;
          if (host) await refreshBackups(host);
          toast('已从备份恢复');
        } catch (err) {
          toast(`恢复失败：${err.message}`, 'error', 5000);
        }
        return;
      }

      if (e.target.closest('[data-act="clear"]')) {
        const key = root.querySelector('[data-clear-target]').value;
        const label = CLEARABLE.find((m) => m.key === key)?.label || key;
        const ok = await confirmDialog({
          title: '清空这个模块？',
          message: `将删除「${label}」的全部数据，且无法撤销。建议先点「立即备份」。`,
          confirmText: '确认清空',
          danger: true,
        });
        if (!ok) return;
        ctx.update((st) => {
          if (key === 'today') {
            st.today.tasks = [];
            st.today.memos = [];
            st.today.focus = [];
          } else if (key === 'content') {
            st.content.ideas = [];
            st.content.posts = [];
          } else if (key === 'dev') {
            st.dev.projects = [];
            st.dev.items = [];
            st.dev.logs = [];
          } else if (key === 'consulting') {
            st.consulting.clients = [];
            st.consulting.projects = [];
            st.consulting.sessions = [];
          } else if (key === 'fitness') {
            st.fitness.sessions = [];
          } else if (key === 'diet') {
            st.diet.days = [];
          } else if (key === 'games') {
            st.games.items = [];
            st.games.sessions = [];
          }
        });
        toast('已清空该模块');
      }
    });

    root.addEventListener('change', async (e) => {
      const setting = e.target.dataset.setting;
      if (setting) {
        const raw = e.target.value;
        ctx.update((st) => {
          if (['fitnessWeeklyGoal', 'calorieTarget', 'proteinTarget', 'waterTarget'].includes(setting)) {
            st.settings[setting] = Number(raw) || 0;
          } else {
            st.settings[setting] = raw;
          }
        }, { rerender: false });
      }

      const fileInput = e.target.closest('[data-import-file]');
      if (fileInput && fileInput.files?.[0]) {
        const file = fileInput.files[0];
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const state = parsed.state && parsed.state.today ? parsed.state : parsed;
          await api.importState(state);
          await ctx.reload();
          backupsLoaded = false;
          toast('导入成功，数据已替换');
        } catch (err) {
          toast(`导入失败：${err.message}`, 'error', 5000);
        } finally {
          fileInput.value = '';
        }
      }
    });
  },
};
