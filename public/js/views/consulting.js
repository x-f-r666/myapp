/** 咨询工作：客户（可增删改）→ 项目 → 沟通纪要 → 跟进。 */
import { CLIENT_STAGES, WORK_STATUS, uid } from '../core/model.js';
import { consultingStats } from '../core/stats.js';
import { formatCN, mdCN, relativeDay } from '../core/dates.js';
import {
  esc,
  icon,
  badge,
  emptyState,
  openModal,
  field,
  formGrid,
  readForm,
  tabs,
  fmtCompact,
  fmtMoney,
  fmtMinutes,
  statBlock,
  avatar,
  confirmDialog,
} from '../components/ui.js';
import { barChart, donut, CHART_COLORS } from '../components/charts.js';
import { addToToday, isInToday } from './_helpers.js';

let tab = 'clients';
let expanded = null;

const STAGE_TONE = {
  lead: 'neutral',
  talking: 'warn',
  signed: 'info',
  delivering: 'accent',
  done: 'accent',
  lost: 'danger',
};
const STAGE_LABEL = Object.fromEntries(CLIENT_STAGES.map((s) => [s.key, s.label]));
const WORK_LABEL = Object.fromEntries(WORK_STATUS.map((s) => [s.key, s.label]));

function openClientModal(client, ctx) {
  const isEdit = !!client;
  const d = client || { name: '', company: '', contact: '', stage: 'lead', tags: [], note: '' };
  openModal({
    title: isEdit ? '编辑客户' : '新增客户',
    subtitle: '客户是咨询工作的起点，尽量把联系方式写全',
    body: formGrid(
      field({ label: '客户称呼', name: 'name', value: d.name, placeholder: '王总 / 李姐', required: true }) +
        field({ label: '公司 / 机构', name: 'company', value: d.company || '', placeholder: 'XX 科技' }) +
        field({ label: '联系方式', name: 'contact', value: d.contact || '', placeholder: '微信 / 手机 / 邮箱' }) +
        field({
          label: '阶段',
          name: 'stage',
          value: d.stage,
          options: CLIENT_STAGES.map((s) => ({ value: s.key, label: s.label })),
        }) +
        field({ label: '标签', name: 'tags', value: (d.tags || []).join(', '), placeholder: '用逗号分隔，例如：长期, 高客单', span: 2 }) +
        field({ label: '备注', name: 'note', type: 'textarea', value: d.note || '', placeholder: '背景、决策人、忌讳…', span: 2, rows: 2 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '添加客户'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.name) return node.querySelector('[name="name"]').focus();
        const data = {
          ...raw,
          tags: String(raw.tags || '')
            .split(/[,，\s]+/)
            .map((t) => t.trim())
            .filter(Boolean),
        };
        ctx.update((st) => {
          if (isEdit) Object.assign(st.consulting.clients.find((c) => c.id === client.id), data);
          else
            st.consulting.clients.unshift({
              id: uid('client'),
              ...data,
              createdAt: new Date().toISOString(),
            });
        });
        close();
        ctx.toast(isEdit ? '客户信息已更新' : '客户已添加');
      });
    },
  });
}

function deleteClient(client, ctx) {
  const projectCount = ctx.state.consulting.projects.filter((p) => p.clientId === client.id).length;
  const sessionCount = ctx.state.consulting.sessions.filter((s) => s.clientId === client.id).length;
  openModal({
    title: '删除客户',
    size: 'sm',
    body: `<p class="confirm-text">确定删除「${esc(client.name)}」吗？</p>
      <div class="modal-note">
        该客户名下还有 <b>${projectCount}</b> 个项目、<b>${sessionCount}</b> 条沟通记录。
      </div>
      <label class="check mt-12"><input type="checkbox" data-cascade checked /> 同时删除这些项目与沟通记录</label>
      <p class="tiny muted mt-8">不勾选则只删除客户本身，项目和记录会保留但不再关联客户。</p>`,
    footer: `<button class="btn btn-ghost" type="button" data-cancel="1">取消</button>
      <button class="btn btn-danger" type="button" data-confirm="1">确认删除</button>`,
    onMount: (node, close) => {
      node.querySelector('[data-cancel]').addEventListener('click', close);
      node.querySelector('[data-confirm]').addEventListener('click', () => {
        const cascade = node.querySelector('[data-cascade]').checked;
        ctx.update((st) => {
          st.consulting.clients = st.consulting.clients.filter((c) => c.id !== client.id);
          if (cascade) {
            st.consulting.projects = st.consulting.projects.filter((p) => p.clientId !== client.id);
            st.consulting.sessions = st.consulting.sessions.filter((s) => s.clientId !== client.id);
          } else {
            st.consulting.sessions.forEach((s) => {
              if (s.clientId === client.id) s.clientId = '';
            });
          }
        });
        close();
        ctx.toast(cascade ? '客户及关联数据已删除' : '客户已删除，关联记录已保留');
      });
    },
  });
}

function openProjectModal(project, ctx) {
  const clients = ctx.state.consulting.clients;
  if (clients.length === 0) {
    ctx.toast('先添加一个客户，项目要挂在客户下面', 'warn');
    openClientModal(null, ctx);
    return;
  }
  const isEdit = !!project;
  const d = project || {
    clientId: clients[0].id,
    name: '',
    scope: '',
    amount: '',
    startDate: ctx.today,
    endDate: '',
    status: 'planning',
  };
  openModal({
    title: isEdit ? '编辑项目' : '新建咨询项目',
    body: formGrid(
      field({
        label: '客户',
        name: 'clientId',
        value: d.clientId,
        options: clients.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ` · ${c.company}` : ''}` })),
      }) +
        field({ label: '项目名称', name: 'name', value: d.name, placeholder: '年度顾问 / 内训 / 诊断', required: true }) +
        field({ label: '范围 / 交付物', name: 'scope', type: 'textarea', value: d.scope || '', placeholder: '做什么、交付什么', span: 2, rows: 2 }) +
        field({ label: '金额（元）', name: 'amount', type: 'number', min: 0, step: 100, value: d.amount || '' }) +
        field({ label: '状态', name: 'status', value: d.status, options: WORK_STATUS.map((s) => ({ value: s.key, label: s.label })) }) +
        field({ label: '开始日期', name: 'startDate', type: 'date', value: d.startDate || '' }) +
        field({ label: '结束日期', name: 'endDate', type: 'date', value: d.endDate || '' }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '创建项目'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.name) return node.querySelector('[name="name"]').focus();
        const data = { ...raw, amount: Number(raw.amount) || 0 };
        ctx.update((st) => {
          if (isEdit) Object.assign(st.consulting.projects.find((p) => p.id === project.id), data);
          else
            st.consulting.projects.unshift({
              id: uid('cproj'),
              ...data,
              createdAt: new Date().toISOString(),
            });
        });
        close();
        ctx.toast(isEdit ? '项目已更新' : '项目已创建');
      });
    },
  });
}

function openSessionModal(session, ctx, presetClientId = '') {
  const clients = ctx.state.consulting.clients;
  if (clients.length === 0) {
    ctx.toast('先添加客户，再记沟通', 'warn');
    openClientModal(null, ctx);
    return;
  }
  const isEdit = !!session;
  const d = session || {
    clientId: presetClientId || clients[0].id,
    projectId: '',
    date: ctx.today,
    minutes: 60,
    summary: '',
    nextStep: '',
    followUpDate: '',
  };
  const projects = ctx.state.consulting.projects;
  openModal({
    title: isEdit ? '编辑沟通记录' : '记一次沟通',
    subtitle: '纪要比记忆可靠，尤其是三周以后',
    body: formGrid(
      field({
        label: '客户',
        name: 'clientId',
        value: d.clientId,
        options: clients.map((c) => ({ value: c.id, label: c.name })),
      }) +
        field({
          label: '关联项目（可不选）',
          name: 'projectId',
          value: d.projectId || '',
          options: [{ value: '', label: '不关联' }, ...projects.map((p) => ({ value: p.id, label: p.name }))],
        }) +
        field({ label: '日期', name: 'date', type: 'date', value: d.date }) +
        field({ label: '时长（分钟）', name: 'minutes', type: 'number', min: 0, step: 10, value: d.minutes }) +
        field({ label: '沟通纪要', name: 'summary', type: 'textarea', value: d.summary || '', placeholder: '对方关心什么、卡在哪、承诺了什么', span: 2, rows: 3 }) +
        field({ label: '下一步', name: 'nextStep', value: d.nextStep || '', placeholder: '我下一步做什么', span: 2 }) +
        field({ label: '下次跟进日期', name: 'followUpDate', type: 'date', value: d.followUpDate || '', hint: '到期会出现在首页' }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '保存记录'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        const data = { ...raw, minutes: Number(raw.minutes) || 0 };
        ctx.update((st) => {
          if (isEdit) Object.assign(st.consulting.sessions.find((s) => s.id === session.id), data);
          else
            st.consulting.sessions.unshift({
              id: uid('sess'),
              ...data,
              followedUp: false,
              createdAt: new Date().toISOString(),
            });
        });
        close();
        ctx.toast(isEdit ? '记录已更新' : '沟通已记录');
      });
    },
  });
}

export default {
  render(state, ctx, opts = {}) {
    const activeTab = opts.tab || tab;
    const stats = consultingStats(state, ctx.today);
    const clientName = (id) => state.consulting.clients.find((c) => c.id === id)?.name || '未关联';
    const clients = [...state.consulting.clients];
    const projects = [...state.consulting.projects].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const sessions = [...state.consulting.sessions].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const header = `<div class="toolbar">
      ${tabs({
        name: 'consulting',
        active: activeTab,
        items: [
          { key: 'clients', label: '客户', count: clients.length },
          { key: 'projects', label: '项目', count: projects.length },
          { key: 'sessions', label: '沟通与跟进', count: sessions.length },
        ],
      })}
      <span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-act="new-client">${icon('plus', 14)}新增客户</button>
      <button class="btn btn-primary" type="button" data-act="new-session">${icon('users', 14)}记一次沟通</button>
    </div>`;

    const kpis = `<div class="kpi-grid" style="margin-bottom:16px">
      ${statBlock({ label: '在跟进客户', value: `${stats.activeClients}`, unit: '位', foot: `共 ${clients.length} 位` })}
      ${statBlock({ label: '在谈金额', value: fmtMoney(stats.pipelineValue), foot: '进行中与筹备中的项目' })}
      ${statBlock({ label: '已成交金额', value: fmtMoney(stats.wonValue), foot: '已交付 / 已结项' })}
      ${statBlock({ label: '近 30 天沟通', value: fmtMinutes(stats.minutes30), foot: `待跟进 ${stats.dueFollowUps.length} 项` })}
    </div>`;

    const charts = `<div class="split-even mt-16">
      <section class="card">
        <div class="card-head"><div><div class="card-title">${icon('target', 15)}客户阶段分布</div><div class="card-sub">谁在谈、谁在交付、谁丢了</div></div></div>
        <div class="card-body">${donut({
          items: stats.clientStageCounts.map((s) => ({ label: s.label, value: s.count })),
          size: 132,
          centerValue: String(clients.length),
          centerLabel: '位客户',
        })}</div>
      </section>
      <section class="card">
        <div class="card-head"><div><div class="card-title">${icon('briefcase', 15)}月度成交金额</div><div class="card-sub">按项目结束月份归集</div></div></div>
        <div class="card-body">${barChart({
          labels: stats.monthlyRevenue.map((m) => m.label),
          values: stats.monthlyRevenue.map((m) => m.amount),
          height: 170,
          width: 560,
          color: CHART_COLORS[2],
          yFormat: (v) => fmtCompact(v),
          valueFormat: (v) => fmtMoney(v),
        })}</div>
      </section>
    </div>`;

    if (activeTab === 'projects') {
      return `${header}${kpis}
      <section class="card">
        <div class="card-head">
          <div><div class="card-title">${icon('briefcase', 15)}咨询项目</div><div class="card-sub">金额、周期与状态</div></div>
          <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="new-project">${icon('plus', 13)}新建项目</button></div>
        </div>
        <div class="card-body ${projects.length ? 'tight' : ''}">
          ${
            projects.length
              ? `<div class="table-wrap"><table class="table">
                <thead><tr><th>项目</th><th>客户</th><th class="num-cell">金额</th><th>周期</th><th>状态</th><th></th></tr></thead>
                <tbody>${projects
                  .map(
                    (p) => `<tr>
                      <td><div class="truncate" style="max-width:28ch">${esc(p.name)}</div>
                        ${p.scope ? `<div class="tiny muted truncate" style="max-width:36ch">${esc(p.scope)}</div>` : ''}</td>
                      <td class="nowrap">${esc(clientName(p.clientId))}</td>
                      <td class="num-cell nowrap">${p.amount ? fmtMoney(p.amount) : '—'}</td>
                      <td class="tiny muted nowrap">${p.startDate ? mdCN(p.startDate) : '—'} → ${p.endDate ? mdCN(p.endDate) : '进行中'}</td>
                      <td>${badge(WORK_LABEL[p.status] || '筹备', p.status === 'active' ? 'warn' : p.status === 'closed' || p.status === 'delivered' ? 'accent' : 'neutral')}</td>
                      <td><div class="actions">
                        <button class="btn btn-icon" type="button" data-edit-cproj="${esc(p.id)}" title="编辑">${icon('edit', 13)}</button>
                        <button class="btn btn-icon" type="button" data-del-cproj="${esc(p.id)}" title="删除">${icon('trash', 13)}</button>
                      </div></td>
                    </tr>`
                  )
                  .join('')}</tbody></table></div>`
              : emptyState({
                  iconName: 'briefcase',
                  title: '还没有咨询项目',
                  text: '先建一个项目，把金额和周期写下来，收入统计才有数据。',
                  action: `<button class="btn btn-primary btn-sm" type="button" data-act="new-project">${icon('plus', 13)}新建项目</button>`,
                })
          }
        </div>
      </section>
      ${charts}`;
    }

    if (activeTab === 'sessions') {
      return `${header}${kpis}
      <div class="split-main">
        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('users', 15)}沟通记录</div><div class="card-sub">最近 ${sessions.length} 条</div></div>
            <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="new-session">${icon('plus', 13)}记一次</button></div></div>
          <div class="card-body">
            ${
              sessions.length
                ? sessions
                    .map(
                      (s) => `<div class="list-item">
                        <div class="list-main">
                          <div class="list-title">${esc(clientName(s.clientId))}
                            ${s.followedUp ? badge('已跟进', 'accent') : s.followUpDate ? badge(`跟进 ${relativeDay(s.followUpDate)}`, s.followUpDate <= ctx.today ? 'danger' : 'warn') : ''}
                          </div>
                          <div class="list-sub">${mdCN(s.date)} · ${s.minutes || 0} 分钟${s.nextStep ? ` · 下一步：${esc(s.nextStep)}` : ''}</div>
                          ${s.summary ? `<div class="tiny muted mt-8">${esc(s.summary)}</div>` : ''}
                        </div>
                        <div class="list-actions">
                          ${s.followUpDate && !s.followedUp ? `<button class="btn btn-icon" type="button" data-followed="${esc(s.id)}" title="标记已跟进">${icon('check', 14)}</button>` : ''}
                          <button class="btn btn-icon" type="button" data-edit-sess="${esc(s.id)}" title="编辑">${icon('edit', 13)}</button>
                          <button class="btn btn-icon" type="button" data-del-sess="${esc(s.id)}" title="删除">${icon('trash', 13)}</button>
                        </div>
                      </div>`
                    )
                    .join('')
                : emptyState({ iconName: 'users', title: '还没有沟通记录', text: '打完电话顺手记两句，下次开口就有底。' })
            }
          </div>
        </section>

        <div class="stack">
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon('clock', 15)}待跟进</div><div class="card-sub">到期与逾期会出现在首页</div></div></div>
            <div class="card-body">
              ${
                stats.followUps.length
                  ? stats.followUps
                      .map(
                        (f) => `<div class="followup">
                          <div class="list-main">
                            <div class="list-title">${esc(f.client?.name || '未关联客户')}</div>
                            <div class="list-sub">${formatCN(f.session.followUpDate)} · ${esc(f.session.nextStep || '没有写下一步')}</div>
                          </div>
                          <button class="btn btn-icon" type="button" data-add-today="${esc(f.session.id)}" title="加入今日计划">${icon('plus', 15)}</button>
                          <button class="btn btn-icon" type="button" data-followed="${esc(f.session.id)}" title="标记已跟进">${icon('check', 15)}</button>
                        </div>`
                      )
                      .join('')
                  : `<p class="tiny muted">没有待跟进的事项。</p>`
              }
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><div class="card-title">${icon('spark', 15)}客户贡献</div><div class="card-sub">按合同金额</div></div></div>
            <div class="card-body">${
              stats.topClients.length
                ? barChart({
                    labels: stats.topClients.map((t) => t.client.name),
                    values: stats.topClients.map((t) => t.amount),
                    horizontal: true,
                    height: 140,
                    valueFormat: (v) => fmtMoney(v),
                  })
                : `<p class="tiny muted">还没有金额数据。</p>`
            }</div>
          </section>
        </div>
      </div>`;
    }

    return `${header}${kpis}
    <section class="card">
      <div class="card-head">
        <div><div class="card-title">${icon('users', 15)}客户列表</div><div class="card-sub">点客户展开项目与记录；右侧可编辑、删除</div></div>
        <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="new-client">${icon('plus', 13)}新增客户</button></div>
      </div>
      <div class="card-body ${clients.length ? 'tight' : ''}">
        ${
          clients.length
            ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>客户</th><th>阶段</th><th>联系方式</th><th class="num-cell">项目</th><th class="num-cell">金额</th><th>最近跟进</th><th></th></tr></thead>
              <tbody>${clients
                .map((c) => {
                  const cProjects = state.consulting.projects.filter((p) => p.clientId === c.id);
                  const lastSession = sessions.find((s) => s.clientId === c.id);
                  const amount = cProjects.reduce((a, p) => a + (Number(p.amount) || 0), 0);
                  const isOpen = expanded === c.id;
                  return `<tr>
                    <td>
                      <div class="row" style="gap:8px">
                        ${avatar(c.name, CHART_COLORS[(c.name || '?').length % CHART_COLORS.length])}
                        <div style="min-width:0">
                          <div class="truncate" style="max-width:18ch">${esc(c.name)}</div>
                          <div class="tiny muted truncate" style="max-width:20ch">${esc(c.company || '—')}</div>
                        </div>
                      </div>
                    </td>
                    <td>${badge(STAGE_LABEL[c.stage] || '线索', STAGE_TONE[c.stage] || 'neutral')}</td>
                    <td class="tiny">${esc(c.contact || '—')}</td>
                    <td class="num-cell">${cProjects.length}</td>
                    <td class="num-cell nowrap">${amount ? fmtMoney(amount) : '—'}</td>
                    <td class="tiny muted nowrap">${lastSession ? mdCN(lastSession.date) : '—'}</td>
                    <td><div class="actions">
                      <button class="btn btn-ghost btn-sm" type="button" data-expand="${esc(c.id)}">${isOpen ? '收起' : '展开'}</button>
                      <button class="btn btn-icon" type="button" data-edit-client="${esc(c.id)}" title="编辑">${icon('edit', 13)}</button>
                      <button class="btn btn-icon" type="button" data-del-client="${esc(c.id)}" title="删除">${icon('trash', 13)}</button>
                    </div></td>
                  </tr>
                  ${
                    isOpen
                      ? `<tr><td colspan="7" style="background:#fbfaf6;padding:0">
                          <div class="expand">
                            <div class="between">
                              <div class="card-title">${esc(c.name)} 的项目</div>
                              <div class="row">
                                <button class="btn btn-ghost btn-sm" type="button" data-act="new-project">${icon('plus', 12)}项目</button>
                                <button class="btn btn-soft btn-sm" type="button" data-session-client="${esc(c.id)}">${icon('users', 12)}记沟通</button>
                              </div>
                            </div>
                            <div class="mt-8">
                              ${cProjects.length
                                ? cProjects
                                    .map(
                                      (p) => `<div class="list-item">
                                        <span class="dot" style="background:${p.status === 'active' ? '#bd7a45' : '#2c6353'}"></span>
                                        <div class="list-main"><div class="list-title">${esc(p.name)}</div>
                                        <div class="list-sub">${p.startDate ? mdCN(p.startDate) : '—'} 起 · ${WORK_LABEL[p.status] || '筹备'} ${
                                        p.scope ? `· ${esc(p.scope.slice(0, 30))}` : ''
                                      }</div></div>
                                        <b class="small num">${p.amount ? fmtMoney(p.amount) : '—'}</b>
                                      </div>`
                                    )
                                    .join('')
                                : '<p class="tiny muted">还没有项目。</p>'}
                            </div>
                            <div class="divider"></div>
                            <div class="card-title">最近的沟通</div>
                            <div class="mt-8">
                              ${
                                sessions.filter((s) => s.clientId === c.id).length
                                  ? sessions
                                      .filter((s) => s.clientId === c.id)
                                      .slice(0, 4)
                                      .map(
                                        (s) => `<div class="list-item">
                                          <span class="badge badge-neutral">${mdCN(s.date)}</span>
                                          <div class="list-main"><div class="list-title small">${esc(s.summary || '（没有纪要）')}</div>
                                          <div class="list-sub">${s.minutes} 分钟${s.nextStep ? ` · 下一步：${esc(s.nextStep)}` : ''}</div></div>
                                          <button class="btn btn-icon" type="button" data-edit-sess="${esc(s.id)}" title="编辑">${icon('edit', 13)}</button>
                                        </div>`
                                      )
                                      .join('')
                                  : '<p class="tiny muted">还没有沟通记录。</p>'
                              }
                            </div>
                            ${c.note ? `<div class="hint-box mt-12">${icon('spark', 14)}<span>${esc(c.note)}</span></div>` : ''}
                          </div>
                        </td></tr>`
                      : ''
                  }`;
                })
                .join('')}</tbody></table></div>`
            : emptyState({
                iconName: 'users',
                title: '还没有客户',
                text: '把正在聊的人记下来，配上跟进日期，就不会忘。',
                action: `<button class="btn btn-primary btn-sm" type="button" data-act="new-client">${icon('plus', 13)}添加第一个客户</button>`,
              })
        }
      </div>
    </section>
    ${charts}`;
  },

  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-tab-key]');
      if (tabBtn) {
        tab = tabBtn.dataset.tabKey;
        expanded = null;
        ctx.rerender();
        return;
      }
      if (e.target.closest('[data-act="new-client"]')) return openClientModal(null, ctx);
      if (e.target.closest('[data-act="new-project"]')) return openProjectModal(null, ctx);
      if (e.target.closest('[data-act="new-session"]')) return openSessionModal(null, ctx);

      const expandBtn = e.target.closest('[data-expand]');
      if (expandBtn) {
        expanded = expanded === expandBtn.dataset.expand ? null : expandBtn.dataset.expand;
        ctx.rerender();
        return;
      }

      const editClient = e.target.closest('[data-edit-client]');
      if (editClient) {
        const c = ctx.state.consulting.clients.find((x) => x.id === editClient.dataset.editClient);
        if (c) openClientModal(c, ctx);
        return;
      }

      const delClient = e.target.closest('[data-del-client]');
      if (delClient) {
        const c = ctx.state.consulting.clients.find((x) => x.id === delClient.dataset.delClient);
        if (c) deleteClient(c, ctx);
        return;
      }

      const sessionClient = e.target.closest('[data-session-client]');
      if (sessionClient) return openSessionModal(null, ctx, sessionClient.dataset.sessionClient);

      const editProj = e.target.closest('[data-edit-cproj]');
      if (editProj) {
        const p = ctx.state.consulting.projects.find((x) => x.id === editProj.dataset.editCproj);
        if (p) openProjectModal(p, ctx);
        return;
      }
      const delProj = e.target.closest('[data-del-cproj]');
      if (delProj) {
        confirmDialog({
          title: '删除这个项目？',
          message: '项目记录会从收入统计中移除，无法恢复。',
          confirmText: '删除',
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          ctx.update((st) => {
            st.consulting.projects = st.consulting.projects.filter((p) => p.id !== delProj.dataset.delCproj);
          });
          ctx.toast('项目已删除');
        });
        return;
      }

      const editSess = e.target.closest('[data-edit-sess]');
      if (editSess) {
        const s = ctx.state.consulting.sessions.find((x) => x.id === editSess.dataset.editSess);
        if (s) openSessionModal(s, ctx);
        return;
      }
      const delSess = e.target.closest('[data-del-sess]');
      if (delSess) {
        ctx.update((st) => {
          st.consulting.sessions = st.consulting.sessions.filter((s) => s.id !== delSess.dataset.delSess);
        });
        ctx.toast('沟通记录已删除');
        return;
      }

      const followed = e.target.closest('[data-followed]');
      if (followed) {
        ctx.update((st) => {
          const s = st.consulting.sessions.find((x) => x.id === followed.dataset.followed);
          if (s) {
            s.followedUp = true;
            s.followedUpAt = new Date().toISOString();
          }
        });
        ctx.toast('已标记跟进完成');
        return;
      }

      const addToday = e.target.closest('[data-add-today]');
      if (addToday) {
        const sess = ctx.state.consulting.sessions.find((x) => x.id === addToday.dataset.addToday);
        if (!sess) return;
        const client = ctx.state.consulting.clients.find((c) => c.id === sess.clientId);
        let created = false;
        ctx.update((st) => {
          created = addToToday(st, {
            title: `跟进 ${client?.name || '客户'}：${sess.nextStep || sess.summary || '联系一下'}`,
            module: 'consulting',
            refId: sess.id,
            priority: 'high',
          }).created;
        });
        ctx.toast(created ? '已加入今日计划' : '已经在今日计划里了');
      }
    });
  },
};
