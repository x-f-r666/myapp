/** 开发工作：项目 → 工作项 → 工时。新建工作项的入口在页面主按钮、项目行、空状态三处都有。 */
import { DEV_STATUS, DEV_TYPES, PRIORITIES, uid } from '../core/model.js';
import { devStats } from '../core/stats.js';
import { mdCN, relativeDay } from '../core/dates.js';
import {
  esc,
  icon,
  badge,
  emptyState,
  openModal,
  field,
  formGrid,
  readForm,
  confirmDialog,
  fmtCompact,
  statBlock,
} from '../components/ui.js';
import { barChart, donut, CHART_COLORS } from '../components/charts.js';
import { addToToday, isInToday, n } from './_helpers.js';

let statusFilter = 'all';
let projectFilter = 'all';

const PROJECT_COLORS = ['#2C6353', '#C07A45', '#3F6A8A', '#8A5F8F', '#7C8B4E', '#B0453A'];
const STATUS_TONE = { todo: 'neutral', doing: 'warn', done: 'accent' };
const TYPE_LABEL = Object.fromEntries(DEV_TYPES.map((t) => [t.key, t.label]));

function openProjectModal(project, ctx) {
  const isEdit = !!project;
  const d = project || { name: '', repo: '', stack: '', status: 'active', color: PROJECT_COLORS[0], note: '' };
  openModal({
    title: isEdit ? '编辑项目' : '新建项目',
    subtitle: '一个项目下可以挂很多工作项',
    body: formGrid(
      field({ label: '项目名', name: 'name', value: d.name, placeholder: '比如：个人记账 App', required: true, span: 2 }) +
        field({ label: '代码仓库', name: 'repo', value: d.repo || '', placeholder: 'github.com/you/repo（可不填）' }) +
        field({ label: '技术栈', name: 'stack', value: d.stack || '', placeholder: '例如 Vue + Node' }) +
        field({
          label: '状态',
          name: 'status',
          value: d.status,
          options: [
            { value: 'active', label: '进行中' },
            { value: 'paused', label: '暂停' },
            { value: 'done', label: '已完成' },
          ],
        }) +
        field({
          label: '主题色',
          name: 'color',
          value: d.color,
          options: PROJECT_COLORS.map((c, i) => ({ value: c, label: `颜色 ${i + 1}` })),
        }) +
        field({ label: '备注', name: 'note', type: 'textarea', value: d.note || '', placeholder: '目标、约束、上线时间…', span: 2, rows: 2 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '创建项目'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.name) return node.querySelector('[name="name"]').focus();
        ctx.update((st) => {
          if (isEdit) Object.assign(st.dev.projects.find((p) => p.id === project.id), raw);
          else
            st.dev.projects.unshift({
              id: uid('proj'),
              ...raw,
              createdAt: new Date().toISOString(),
            });
        });
        close();
        ctx.toast(isEdit ? '项目已更新' : '项目已创建');
      });
    },
  });
}

function openItemModal(item, ctx, presetProjectId = '') {
  const isEdit = !!item;
  const projects = ctx.state.dev.projects;
  if (projects.length === 0) {
    openModal({
      title: '先建一个项目',
      body: `<p class="confirm-text">工作项必须挂在某个项目下面。你还没有项目，先花 10 秒建一个，比如「个人博客」。</p>
        <div class="hint-box mt-12">${icon('folder', 15)}<span>项目是容器，工作项是具体要做的事。一个项目通常会有很多条工作项。</span></div>`,
      footer: `<button class="btn btn-primary" type="button" data-new-proj="1">去建项目</button>`,
      onMount: (node, close) => {
        node.querySelector('[data-new-proj]').addEventListener('click', () => {
          close();
          openProjectModal(null, ctx);
        });
      },
    });
    return;
  }
  const d = item || {
    projectId: presetProjectId || projects[0].id,
    title: '',
    type: 'feature',
    priority: 'mid',
    status: 'todo',
    estimateH: '',
    spentH: 0,
    note: '',
  };
  openModal({
    title: isEdit ? '编辑工作项' : '新建工作项',
    subtitle: isEdit ? d.title : '写清楚「做什么」，不要写成「搞一下 XX」',
    body: formGrid(
      field({ label: '工作项标题', name: 'title', value: d.title, placeholder: '比如：登录页支持手机号验证码', required: true, span: 2 }) +
        field({
          label: '所属项目',
          name: 'projectId',
          value: d.projectId,
          options: projects.map((p) => ({ value: p.id, label: p.name })),
        }) +
        field({ label: '类型', name: 'type', value: d.type, options: DEV_TYPES.map((t) => ({ value: t.key, label: t.label })) }) +
        field({ label: '优先级', name: 'priority', value: d.priority, options: PRIORITIES.map((p) => ({ value: p.key, label: p.label })) }) +
        field({ label: '状态', name: 'status', value: d.status, options: DEV_STATUS.map((s) => ({ value: s.key, label: s.label })) }) +
        field({ label: '预估工时', name: 'estimateH', type: 'number', min: 0, step: 0.5, value: d.estimateH === 0 ? '' : d.estimateH, placeholder: '小时，可不填' }) +
        field({ label: '已用工时', name: 'spentH', type: 'number', min: 0, step: 0.5, value: d.spentH || 0 }) +
        field({ label: '备注', name: 'note', type: 'textarea', value: d.note || '', placeholder: '验收标准、复现步骤、参考链接…', span: 2, rows: 2 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '创建工作项'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.title) return node.querySelector('[name="title"]').focus();
        const data = { ...raw, estimateH: n(raw.estimateH), spentH: n(raw.spentH) };
        ctx.update((st) => {
          if (isEdit) {
            const target = st.dev.items.find((i) => i.id === item.id);
            Object.assign(target, data);
            if (data.status === 'done' && !target.doneAt) target.doneAt = new Date().toISOString();
            if (data.status !== 'done') target.doneAt = null;
          } else {
            st.dev.items.unshift({
              id: uid('item'),
              ...data,
              doneAt: data.status === 'done' ? new Date().toISOString() : null,
              createdAt: new Date().toISOString(),
            });
          }
        });
        close();
        ctx.toast(isEdit ? '工作项已更新' : '工作项已创建');
      });
    },
  });
}

function openLogModal(ctx, presetProjectId = '') {
  const projects = ctx.state.dev.projects;
  if (projects.length === 0) {
    ctx.toast('先建一个项目再记工时', 'warn');
    return;
  }
  openModal({
    title: '记一笔工时',
    subtitle: '写完一段就记一下，周末回看很值',
    body: formGrid(
      field({
        label: '项目',
        name: 'projectId',
        value: presetProjectId || projects[0].id,
        options: projects.map((p) => ({ value: p.id, label: p.name })),
      }) +
        field({ label: '日期', name: 'date', type: 'date', value: ctx.today }) +
        field({ label: '时长（小时）', name: 'hours', type: 'number', min: 0.25, step: 0.25, value: 1, required: true }) +
        field({ label: '做了什么', name: 'content', value: '', placeholder: '一句话：修好了登录态丢失的问题', span: 2 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">记录</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        const hours = n(raw.hours);
        if (hours <= 0) return ctx.toast('时长要大于 0', 'warn');
        ctx.update((st) => {
          st.dev.logs.unshift({
            id: uid('log'),
            projectId: raw.projectId,
            date: raw.date || ctx.today,
            hours,
            content: raw.content || '',
          });
        });
        close();
        ctx.toast('工时已记录');
      });
    },
  });
}

export default {
  render(state, ctx) {
    const stats = devStats(state, ctx.today);
    const projects = stats.byProject;
    const items = stats.items.filter((i) => {
      if (statusFilter !== 'all' && (i.status || 'todo') !== statusFilter) return false;
      if (projectFilter !== 'all' && i.projectId !== projectFilter) return false;
      return true;
    });
    const projectName = (id) => projects.find((p) => p.id === id)?.name || '未归属';
    const doneCount = stats.items.filter((i) => i.status === 'done').length;
    const donePct = stats.items.length ? Math.round((doneCount / stats.items.length) * 100) : 0;

    return `
    <div class="kpi-grid" style="margin-bottom:16px">
      ${statBlock({ label: '本周工时', value: `${stats.weekHours}`, unit: '小时', foot: `累计 ${stats.totalHours} 小时`, iconName: 'clock' })}
      ${statBlock({ label: '进行中工作项', value: `${stats.doingItems.length}`, unit: '个', foot: `待办 ${stats.todoItems.length} 个`, iconName: 'code' })}
      ${statBlock({ label: '进行中项目', value: `${stats.activeProjects}`, unit: '个', foot: `共 ${projects.length} 个项目`, iconName: 'folder' })}
      ${statBlock({ label: '工作项完成率', value: `${donePct}%`, foot: `已完成 ${doneCount} / ${stats.items.length}`, iconName: 'check' })}
    </div>

    <div class="toolbar">
      <div class="pill-row">
        <button class="chip ${statusFilter === 'all' ? 'on' : ''}" type="button" data-status="all">全部 ${stats.items.length}</button>
        ${DEV_STATUS.map(
          (s) => `<button class="chip ${statusFilter === s.key ? 'on' : ''}" type="button" data-status="${s.key}">${s.label} ${
            stats.items.filter((i) => (i.status || 'todo') === s.key).length
          }</button>`
        ).join('')}
      </div>
      <select class="inline-select" data-project-filter aria-label="按项目筛选">
        <option value="all">所有项目</option>
        ${projects.map((p) => `<option value="${p.id}" ${projectFilter === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-act="new-project">${icon('folder', 14)}新建项目</button>
      <button class="btn btn-primary" type="button" data-act="new-item">${icon('plus', 14)}新建工作项</button>
    </div>

    <div class="split-main">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('code', 15)}工作项</div><div class="card-sub">${items.length} 条${
      statusFilter !== 'all' || projectFilter !== 'all' ? '（已筛选）' : ''
    }</div></div>
            <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="new-item">${icon('plus', 13)}新增</button></div>
          </div>
          <div class="card-body ${
            items.length ? 'tight' : ''
          }">
            ${
              items.length
                ? `<div class="table-wrap"><table class="table">
                  <thead><tr><th>工作项</th><th>项目</th><th>类型</th><th>状态</th><th class="num-cell">工时</th><th></th></tr></thead>
                  <tbody>${items
                    .map((i) => {
                      const added = isInToday(state, i.id, 'dev');
                      return `<tr>
                        <td>
                          <div class="row" style="gap:6px">
                            ${i.priority === 'high' ? `<span class="prio prio-danger">高</span>` : ''}
                            <span class="truncate" style="max-width:34ch" title="${esc(i.title)}">${esc(i.title)}</span>
                          </div>
                          ${i.note ? `<div class="tiny muted truncate" style="max-width:44ch">${esc(i.note)}</div>` : ''}
                        </td>
                        <td class="nowrap">${esc(projectName(i.projectId))}</td>
                        <td>${badge(TYPE_LABEL[i.type] || '功能', i.type === 'bug' ? 'danger' : 'neutral')}</td>
                        <td>
                          <select class="inline-select" data-item-status="${esc(i.id)}" aria-label="状态">
                            ${DEV_STATUS.map((s) => `<option value="${s.key}" ${(i.status || 'todo') === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
                          </select>
                        </td>
                        <td class="num-cell nowrap">${n(i.spentH)} / ${i.estimateH ? `${n(i.estimateH)}` : '—'} h</td>
                        <td><div class="actions">
                          <button class="btn btn-ghost btn-sm" type="button" data-add-today="${esc(i.id)}" ${added ? 'disabled' : ''}>${
                          added ? '已加入' : '加入今日'
                        }</button>
                          <button class="btn btn-icon" type="button" data-log="${esc(i.id)}" title="记工时">${icon('clock', 13)}</button>
                          <button class="btn btn-icon" type="button" data-edit-item="${esc(i.id)}" title="编辑">${icon('edit', 13)}</button>
                          <button class="btn btn-icon" type="button" data-del-item="${esc(i.id)}" title="删除">${icon('trash', 13)}</button>
                        </div></td>
                      </tr>`;
                    })
                    .join('')}</tbody></table></div>`
                : emptyState({
                    iconName: 'code',
                    title: projects.length ? '这个筛选下没有工作项' : '还没有工作项',
                    text: projects.length
                      ? '换个筛选条件，或者新建一条工作项。'
                      : '先建项目，再往里加具体要做的事。',
                    action: projects.length
                      ? `<button class="btn btn-primary btn-sm" type="button" data-act="new-item">${icon('plus', 13)}新建工作项</button>`
                      : `<button class="btn btn-primary btn-sm" type="button" data-act="new-project">${icon('folder', 13)}新建项目</button>`,
                  })
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('clock', 15)}本周工时日志</div><div class="card-sub">周一开始算，共 ${stats.weekHours} 小时</div></div>
            <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="log-time">${icon('plus', 13)}记工时</button></div>
          </div>
          <div class="card-body">
            ${
              stats.weekLogs.length
                ? stats.weekLogs
                    .map(
                      (l) => `<div class="list-item">
                        <span class="badge badge-neutral">${mdCN(l.date)}</span>
                        <div class="list-main">
                          <div class="list-title">${esc(l.content || '（没有写内容）')}</div>
                          <div class="list-sub">${esc(projectName(l.projectId))}</div>
                        </div>
                        <span class="num small">${n(l.hours)} h</span>
                      </div>`
                    )
                    .join('')
                : `<p class="tiny muted">本周还没有记录工时。写完一段就顺手记一下。</p>`
            }
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('folder', 15)}项目</div><div class="card-sub">点项目上的 + 直接给它加工作项</div></div>
            <div class="card-actions"><button class="btn btn-icon" type="button" data-act="new-project" title="新建项目">${icon('plus', 15)}</button></div>
          </div>
          <div class="card-body">
            ${
              projects.length
                ? projects
                    .map(
                      (p) => `<div class="list-item">
                        <span class="dot" style="background:${esc(p.color)};width:9px;height:9px"></span>
                        <div class="list-main">
                          <div class="list-title">${esc(p.name)}
                            ${p.status === 'active' ? badge('进行中', 'warn') : p.status === 'done' ? badge('已完成', 'accent') : badge('暂停', 'neutral')}
                          </div>
                          <div class="list-sub">
                            <span>${p.openCount} 个未完成</span>
                            <span>${p.hours} h / 本周</span>
                            ${p.stack ? `<span class="truncate" style="max-width:14ch">${esc(p.stack)}</span>` : ''}
                          </div>
                        </div>
                        <div class="list-actions">
                          <button class="btn btn-icon" type="button" data-add-item="${esc(p.id)}" title="给这个项目加工作项">${icon('plus', 14)}</button>
                          <button class="btn btn-icon" type="button" data-edit-project="${esc(p.id)}" title="编辑">${icon('edit', 13)}</button>
                          <button class="btn btn-icon" type="button" data-del-project="${esc(p.id)}" title="删除">${icon('trash', 13)}</button>
                        </div>
                      </div>`
                    )
                    .join('')
                : `<p class="tiny muted">还没有项目。</p>`
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('target', 15)}本周工时分布</div><div class="card-sub">时间花在哪，一眼看到</div></div></div>
          <div class="card-body">${
            stats.byProject.some((p) => p.hours > 0)
              ? barChart({
                  labels: stats.byProject.map((p) => p.name),
                  values: stats.byProject.map((p) => p.hours),
                  horizontal: true,
                  width: 340,
                  height: 150,
                  valueFormat: (v) => `${v}h`,
                })
              : `<p class="tiny muted">本周还没记工时。</p>`
          }</div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('check', 15)}工作项状态</div><div class="card-sub">共 ${stats.items.length} 条</div></div></div>
          <div class="card-body">${donut({
            items: stats.statusCounts.map((s, i) => ({
              label: s.label,
              value: s.count,
              color: [CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[2]][i],
            })),
            size: 128,
            centerValue: String(stats.items.length),
            centerLabel: '工作项',
          })}</div>
        </section>
      </div>
    </div>`;
  },

  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="new-project"]')) return openProjectModal(null, ctx);
      if (e.target.closest('[data-act="new-item"]')) return openItemModal(null, ctx);
      if (e.target.closest('[data-act="log-time"]')) return openLogModal(ctx);

      const chip = e.target.closest('[data-status]');
      if (chip) {
        statusFilter = chip.dataset.status;
        ctx.rerender();
        return;
      }

      const addItem = e.target.closest('[data-add-item]');
      if (addItem) return openItemModal(null, ctx, addItem.dataset.addItem);

      const editProject = e.target.closest('[data-edit-project]');
      if (editProject) {
        const p = ctx.state.dev.projects.find((x) => x.id === editProject.dataset.editProject);
        if (p) openProjectModal(p, ctx);
        return;
      }

      const delProject = e.target.closest('[data-del-project]');
      if (delProject) {
        const p = ctx.state.dev.projects.find((x) => x.id === delProject.dataset.delProject);
        const count = ctx.state.dev.items.filter((i) => i.projectId === p?.id).length;
        confirmDialog({
          title: '删除这个项目？',
          message: `「${p?.name || ''}」以及它下面的 ${count} 条工作项、相关工时记录都会被一起删除，无法恢复。`,
          confirmText: '删除项目',
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          ctx.update((st) => {
            st.dev.projects = st.dev.projects.filter((x) => x.id !== p.id);
            st.dev.items = st.dev.items.filter((i) => i.projectId !== p.id);
            st.dev.logs = st.dev.logs.filter((l) => l.projectId !== p.id);
          });
          ctx.toast('项目已删除');
        });
        return;
      }

      const editItem = e.target.closest('[data-edit-item]');
      if (editItem) {
        const i = ctx.state.dev.items.find((x) => x.id === editItem.dataset.editItem);
        if (i) openItemModal(i, ctx);
        return;
      }

      const delItem = e.target.closest('[data-del-item]');
      if (delItem) {
        confirmDialog({ title: '删除这条工作项？', message: '删除后无法恢复。', confirmText: '删除', danger: true }).then((ok) => {
          if (!ok) return;
          ctx.update((st) => {
            st.dev.items = st.dev.items.filter((x) => x.id !== delItem.dataset.delItem);
          });
          ctx.toast('工作项已删除');
        });
        return;
      }

      const logBtn = e.target.closest('[data-log]');
      if (logBtn) {
        const item = ctx.state.dev.items.find((x) => x.id === logBtn.dataset.log);
        if (item) openLogModal(ctx, item.projectId);
        return;
      }

      const addToday = e.target.closest('[data-add-today]');
      if (addToday) {
        const item = ctx.state.dev.items.find((x) => x.id === addToday.dataset.addToday);
        if (!item) return;
        let created = false;
        ctx.update((st) => {
          created = addToToday(st, {
            title: `[${projectNameOf(st, item.projectId)}] ${item.title}`,
            module: 'dev',
            refId: item.id,
            priority: item.priority,
          }).created;
        });
        ctx.toast(created ? '已加入今日计划' : '已经在今日计划里了');
      }
    });

    root.addEventListener('change', (e) => {
      const statusSel = e.target.closest('[data-item-status]');
      if (statusSel) {
        const val = statusSel.value;
        ctx.update((st) => {
          const item = st.dev.items.find((x) => x.id === statusSel.dataset.itemStatus);
          if (!item) return;
          item.status = val;
          item.doneAt = val === 'done' ? new Date().toISOString() : null;
        });
        ctx.toast(`状态已改为「${DEV_STATUS.find((s) => s.key === val)?.label}」`);
        return;
      }
      if (e.target.matches('[data-project-filter]')) {
        projectFilter = e.target.value;
        ctx.rerender();
      }
    });
  },
};

function projectNameOf(state, id) {
  return state.dev.projects.find((p) => p.id === id)?.name || '项目';
}
