/** 今日计划：一天的任务池，支持重点、时间段、顺延、昨日带入。 */
import { addDays, formatCN, weekdayCN, relativeDay, todayISO } from '../core/dates.js';
import { MODULES, PRIORITIES, SLOTS, uid } from '../core/model.js';
import {
  esc,
  icon,
  badge,
  priorityTag,
  emptyState,
  openModal,
  field,
  formGrid,
  readForm,
  confirmDialog,
  progressBar,
  tabs,
} from '../components/ui.js';
import { tasksOn, focusTasks, doneRate } from '../core/stats.js';
import { toggleTask, removeTask, toggleFocus, moduleLabel } from './_helpers.js';

let viewDate = null;
let filter = 'open';

function dateOf(ctx) {
  return viewDate || ctx.today;
}

function taskRow(task, ctx) {
  const inFocus = ctx.state.today.focus.includes(task.id);
  return `<div class="task ${task.done ? 'done' : ''}">
    <button class="task-check" type="button" data-toggle="${esc(task.id)}" aria-label="${task.done ? '取消完成' : '完成'}">${
    task.done ? icon('check', 12) : ''
  }</button>
    <div class="task-main">
      <div class="task-title">${esc(task.title)}</div>
      <div class="task-meta">
        ${task.module && task.module !== 'today' ? badge(moduleLabel(task.module), 'neutral') : ''}
        ${task.rolledFrom ? badge(`顺延自 ${formatCN(task.rolledFrom)}`, 'warn') : ''}
        ${task.note ? `<span class="tiny muted truncate" style="max-width:34ch">${esc(task.note)}</span>` : ''}
      </div>
    </div>
    ${task.priority === 'high' ? priorityTag('high') : task.priority === 'low' ? priorityTag('low') : ''}
    <div class="task-actions">
      <button class="btn btn-icon" type="button" data-focus="${esc(task.id)}" title="${inFocus ? '取消重点' : '设为今日重点'}" style="${
    inFocus ? 'color:#bd7a45' : ''
  }">${icon('star', 14)}</button>
      <button class="btn btn-icon" type="button" data-edit="${esc(task.id)}" title="编辑">${icon('edit', 14)}</button>
      <button class="btn btn-icon" type="button" data-postpone="${esc(task.id)}" title="顺延到明天">${icon('right', 14)}</button>
      <button class="btn btn-icon" type="button" data-del="${esc(task.id)}" title="删除">${icon('trash', 14)}</button>
    </div>
  </div>`;
}

function openTaskModal(task, ctx) {
  const isEdit = !!task;
  const t = task || {
    title: '',
    note: '',
    priority: 'mid',
    slot: 'morning',
    module: 'today',
    date: dateOf(ctx),
  };
  openModal({
    title: isEdit ? '编辑任务' : '新建任务',
    subtitle: `${formatCN(t.date)} ${weekdayCN(t.date)}`,
    body: formGrid(
      field({ label: '要做什么', name: 'title', value: t.title, placeholder: '动词开头，比如：写完咨询方案第 2 版', required: true, span: 2 }) +
        field({ label: '备注', name: 'note', type: 'textarea', value: t.note || '', placeholder: '补充背景、链接、验收标准（可不填）', span: 2 }) +
        field({
          label: '优先级',
          name: 'priority',
          value: t.priority,
          options: PRIORITIES.map((p) => ({ value: p.key, label: p.label })),
        }) +
        field({
          label: '时间段',
          name: 'slot',
          value: t.slot,
          options: SLOTS.map((s) => ({ value: s.key, label: s.label })),
        }) +
        field({
          label: '来源模块',
          name: 'module',
          value: t.module || 'today',
          options: MODULES.filter((m) => !['dashboard', 'settings'].includes(m.key)).map((m) => ({
            value: m.key,
            label: m.label,
          })),
        }) +
        field({ label: '日期', name: 'date', type: 'date', value: t.date }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存修改' : '创建任务'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      const submit = () => {
        const data = readForm(node);
        if (!data.title) {
          node.querySelector('[name="title"]').focus();
          return;
        }
        ctx.update((st) => {
          if (isEdit) {
            const target = st.today.tasks.find((x) => x.id === task.id);
            Object.assign(target, data);
          } else {
            st.today.tasks.push({
              id: uid('task'),
              ...data,
              done: false,
              createdAt: new Date().toISOString(),
            });
          }
        });
        close();
        ctx.toast(isEdit ? '任务已更新' : '任务已创建');
      };
      node.querySelector('[data-save="1"]').addEventListener('click', submit);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
      });
    },
  });
}

export default {
  render(state, ctx) {
    const date = dateOf(ctx);
    const all = tasksOn(state, date);
    const isToday = date === ctx.today;
    const focus = focusTasks(state, date);
    const rate = doneRate(all);
    const openCount = all.filter((t) => !t.done).length;
    const filtered = filter === 'open' ? all.filter((t) => !t.done) : filter === 'done' ? all.filter((t) => t.done) : all;
    const yesterday = addDays(date, -1);
    const carry = tasksOn(state, yesterday).filter((t) => !t.done);

    const groups = SLOTS.map((slot) => ({
      ...slot,
      tasks: filtered.filter((t) => (t.slot || 'morning') === slot.key),
    }));

    return `
    <div class="split-main">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('check', 15)}${isToday ? '今天' : formatCN(date)} · ${weekdayCN(date)}
                ${isToday ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-nav="today">回到今天</button>`}
              </div>
              <div class="card-sub">共 ${all.length} 件事，还剩 ${openCount} 件${
      all.length ? ` · 完成度 ${rate}%` : ''
    }</div>
            </div>
            <div class="card-actions">
              <button class="btn btn-icon" type="button" data-nav="-1" title="前一天">${icon('left', 16)}</button>
              <button class="btn btn-icon" type="button" data-nav="1" title="后一天">${icon('right', 16)}</button>
              <button class="btn btn-primary btn-sm" type="button" data-act="new">${icon('plus', 14)}新建任务</button>
            </div>
          </div>
          <div class="card-body">
            <form class="inline-form" data-quick-form>
              <input class="control" name="title" placeholder="直接在这里写一件事，回车创建…" autocomplete="off" maxlength="120" />
              <select class="inline-select" name="priority" aria-label="优先级">
                ${PRIORITIES.map((p) => `<option value="${p.key}" ${p.key === 'mid' ? 'selected' : ''}>${p.label}优先</option>`).join('')}
              </select>
              <select class="inline-select" name="slot" aria-label="时间段">
                ${SLOTS.map((s) => `<option value="${s.key}">${s.label}</option>`).join('')}
              </select>
              <button class="btn btn-soft" type="submit">${icon('plus', 14)}添加</button>
            </form>
            <div class="mt-12">${progressBar(rate, rate === 100 ? 'accent' : 'accent')}</div>
          </div>
        </section>

        ${
          carry.length
            ? `<div class="hint-box">
                ${icon('clock', 15)}
                <span>${formatCN(yesterday)} 还有 <b>${carry.length}</b> 件事没做完。
                <button class="btn btn-ghost btn-sm" type="button" data-act="carry">全部带到今天</button></span>
              </div>`
            : ''
        }

        <section class="card">
          <div class="card-head">
            <div class="card-title">任务列表</div>
            <div class="card-actions">${tabs({
              name: 'task-filter',
              active: filter,
              items: [
                { key: 'open', label: '未完成', count: all.filter((t) => !t.done).length },
                { key: 'done', label: '已完成', count: all.filter((t) => t.done).length },
                { key: 'all', label: '全部', count: all.length },
              ],
            })}</div>
          </div>
          <div class="card-body">
            ${
              filtered.length
                ? groups
                    .map(
                      (g) => `<div class="mt-8">
                        <div class="tiny muted" style="letter-spacing:.08em;margin:4px 0 2px">${g.label}${
                        g.tasks.length ? ` · ${g.tasks.filter((t) => !t.done).length}/${g.tasks.length}` : ''
                      }</div>
                        ${g.tasks.length ? g.tasks.map((t) => taskRow(t, ctx)).join('') : '<p class="tiny muted" style="padding:6px 0">这个时段空着。</p>'}
                      </div>`
                    )
                    .join('')
                : emptyState({
                    iconName: 'check',
                    title: filter === 'done' ? '还没有完成的任务' : '这一天还没有任务',
                    text: filter === 'done' ? '完成一件任务后，它会出现在这里。' : '先写下一件事，哪怕只是「回一封邮件」。',
                    action: `<button class="btn btn-primary btn-sm" type="button" data-act="new">${icon('plus', 13)}新建任务</button>`,
                  })
            }
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('target', 15)}今日三件重点</div>
              <div class="card-sub">点亮星标，最多 3 件</div>
            </div>
            <div class="card-actions"><span class="tiny muted">${focus.length}/3</span></div>
          </div>
          <div class="card-body">
            ${
              focus.length
                ? focus
                    .map(
                      (t, i) => `<div class="row" style="padding:8px 0;border-bottom:1px dashed #f0ece3">
                        <span class="prio prio-warn">${i + 1}</span>
                        <span class="list-main ${t.done ? 'muted' : ''}" style="font-size:12.5px;${t.done ? 'text-decoration:line-through' : ''}">${esc(
                        t.title
                      )}</span>
                        <button class="btn btn-icon" type="button" data-focus="${esc(t.id)}" title="移出重点">${icon('close', 13)}</button>
                      </div>`
                    )
                    .join('')
                : `<p class="tiny muted">还没有重点。点任务右侧的星标，选出今天最重要的三件。</p>`
            }
          </div>
        </section>

        <section class="card pad">
          <div class="card-title">${icon('calendar', 15)}这一天的节奏</div>
          <div class="kv mt-8"><span>上午</span><b>${all.filter((t) => (t.slot || 'morning') === 'morning').length} 件</b></div>
          <div class="kv"><span>下午</span><b>${all.filter((t) => t.slot === 'afternoon').length} 件</b></div>
          <div class="kv"><span>晚上</span><b>${all.filter((t) => t.slot === 'evening').length} 件</b></div>
          <div class="kv"><span>已完成</span><b>${all.filter((t) => t.done).length} 件</b></div>
          <div class="hint-box mt-12">${icon('spark', 14)}<span>把最难的那件事放在上午，剩下的时间会轻松很多。</span></div>
        </section>
      </div>
    </div>`;
  },

  bind(root, ctx) {
    root.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-quick-form]');
      if (!form) return;
      e.preventDefault();
      const title = form.querySelector('[name="title"]').value.trim();
      if (!title) return;
      ctx.update((st) => {
        st.today.tasks.push({
          id: uid('task'),
          title,
          note: '',
          module: 'today',
          refId: '',
          priority: form.querySelector('[name="priority"]').value,
          slot: form.querySelector('[name="slot"]').value,
          done: false,
          date: dateOf(ctx),
          createdAt: new Date().toISOString(),
        });
      });
      form.reset();
      form.querySelector('[name="title"]').focus();
    });

    root.addEventListener('click', async (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        const v = nav.dataset.nav;
        viewDate = v === 'today' ? ctx.today : addDays(dateOf(ctx), Number(v));
        filter = 'open';
        ctx.rerender();
        return;
      }

      const tab = e.target.closest('[data-tab-key]');
      if (tab) {
        filter = tab.dataset.tabKey;
        ctx.rerender();
        return;
      }

      if (e.target.closest('[data-act="new"]')) {
        openTaskModal(null, ctx);
        return;
      }

      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        ctx.update((st) => toggleTask(st, toggle.dataset.toggle));
        return;
      }

      const focusBtn = e.target.closest('[data-focus]');
      if (focusBtn) {
        let result = null;
        ctx.update((st) => {
          result = toggleFocus(st, focusBtn.dataset.focus);
        });
        if (result === null) ctx.toast('今日重点最多 3 件，先移出一个', 'warn');
        return;
      }

      const edit = e.target.closest('[data-edit]');
      if (edit) {
        const task = ctx.state.today.tasks.find((t) => t.id === edit.dataset.edit);
        if (task) openTaskModal(task, ctx);
        return;
      }

      const postpone = e.target.closest('[data-postpone]');
      if (postpone) {
        ctx.update((st) => {
          const task = st.today.tasks.find((t) => t.id === postpone.dataset.postpone);
          if (!task) return;
          task.rolledFrom = task.rolledFrom || task.date;
          task.date = addDays(task.date, 1);
          st.today.focus = st.today.focus.filter((f) => f !== task.id);
        });
        ctx.toast('已顺延到明天');
        return;
      }

      const del = e.target.closest('[data-del]');
      if (del) {
        const ok = await confirmDialog({
          title: '删除这条任务？',
          message: '删除后无法恢复。如果只是今天做不完，可以用「顺延到明天」。',
          confirmText: '删除',
          danger: true,
        });
        if (ok) {
          ctx.update((st) => removeTask(st, del.dataset.del));
          ctx.toast('任务已删除');
        }
        return;
      }

      if (e.target.closest('[data-act="carry"]')) {
        const yesterday = addDays(dateOf(ctx), -1);
        const carry = tasksOn(ctx.state, yesterday).filter((t) => !t.done);
        ctx.update((st) => {
          for (const t of carry) {
            st.today.tasks.push({
              ...t,
              id: uid('task'),
              date: dateOf(ctx),
              rolledFrom: t.date,
              done: false,
              doneAt: null,
              createdAt: new Date().toISOString(),
            });
          }
        });
        ctx.toast(carry.length ? `已带入 ${carry.length} 件事` : '没有需要带入的任务');
      }
    });
  },
};
