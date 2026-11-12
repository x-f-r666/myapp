/** 健身计划：月历按天记录「练什么部位、哪些动作、几组几次」。 */
import { addDays, formatCN, mdCN, monthLabel, parseISO, weekdayCN, relativeDay } from '../core/dates.js';
import { DEFAULT_WEEKDAY_PLAN, WEEKDAY_LABELS, uid } from '../core/model.js';
import { fitnessStats, workoutTotals } from '../core/stats.js';
import {
  esc,
  icon,
  badge,
  emptyState,
  confirmDialog,
  statBlock,
  progressBar,
  fmtMinutes,
} from '../components/ui.js';
import { monthCalendar, calendarHead } from '../components/calendar.js';
import { donut, CHART_COLORS } from '../components/charts.js';
import { n } from './_helpers.js';
import { addToToday } from './_helpers.js';

let calYear = null;
let calMonth = null;
let selected = null;
let draft = null;

function ensureCal(ctx) {
  if (calYear === null) {
    const d = parseISO(ctx.today);
    calYear = d.getFullYear();
    calMonth = d.getMonth();
    selected = ctx.today;
    draft = makeDraft(ctx.state, ctx.today);
  }
}

function makeDraft(state, date) {
  const existing = state.fitness.sessions.find((s) => s.date === date);
  if (existing) {
    return {
      date,
      existingId: existing.id,
      focus: existing.focus || '',
      durationMin: existing.durationMin || 0,
      feeling: existing.feeling || '',
      note: existing.note || '',
      exercises: (existing.exercises || []).map((e) => ({ ...e })),
    };
  }
  const dow = parseISO(date)?.getDay() ?? 1;
  return {
    date,
    existingId: null,
    focus: state.fitness.weekdayPlan?.[dow] || '休息',
    durationMin: 60,
    feeling: '',
    note: '',
    exercises: [],
  };
}

function saveDraft(ctx) {
  if (!draft) return;
  const valid = draft.exercises.filter((e) => String(e.name || '').trim());
  ctx.update((st) => {
    const idx = st.fitness.sessions.findIndex((s) => s.date === draft.date);
    const payload = {
      id: draft.existingId || uid('workout'),
      date: draft.date,
      focus: draft.focus || '训练',
      durationMin: n(draft.durationMin),
      feeling: draft.feeling,
      note: draft.note,
      exercises: valid.map((e) => ({
        id: e.id || uid('ex'),
        name: String(e.name).trim(),
        sets: n(e.sets),
        reps: n(e.reps),
        weight: n(e.weight),
      })),
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) st.fitness.sessions[idx] = { ...st.fitness.sessions[idx], ...payload };
    else st.fitness.sessions.push({ ...payload, createdAt: new Date().toISOString() });
  });
  ctx.toast(`${formatCN(draft.date)} 的训练已保存`);
}

export default {
  render(state, ctx) {
    ensureCal(ctx);
    const stats = fitnessStats(state, ctx.today);
    const byDate = new Map(state.fitness.sessions.map((s) => [s.date, s]));
    const plan = state.fitness.weekdayPlan || DEFAULT_WEEKDAY_PLAN;
    const totals = workoutTotals(draft);
    const isToday = selected === ctx.today;
    const record = byDate.get(selected);

    const calendarHtml = monthCalendar({
      year: calYear,
      month: calMonth,
      today: ctx.today,
      selected,
      dayHtml: (cell) => {
        const s = byDate.get(cell.iso);
        if (s) {
          const t = workoutTotals(s);
          return `<span class="cal-tag fitness">${esc(s.focus || '训练')}</span>
            <span class="cal-more">${t.exerciseCount} 个动作 · ${s.durationMin || 0} 分</span>`;
        }
        const dow = parseISO(cell.iso)?.getDay();
        const planned = plan[dow];
        if (cell.iso === ctx.today && planned && planned !== '休息') {
          return `<span class="cal-more">计划：${esc(planned)}</span>`;
        }
        return '';
      },
    });

    return `
    <div class="kpi-grid" style="margin-bottom:16px">
      ${statBlock({ label: '本周训练', value: `${stats.thisWeekCount}`, unit: `/ ${stats.weeklyGoal || '—'} 次`, foot: `${stats.thisWeekMinutes} 分钟`, iconName: 'dumbbell' })}
      ${statBlock({ label: '连续训练', value: `${stats.streak}`, unit: '天', foot: '今天休息也不清零到 0', iconName: 'flame' })}
      ${statBlock({ label: '近 30 天', value: `${stats.last30Count}`, unit: '次', foot: `累计 ${stats.totalCount} 次训练` })}
      ${statBlock({ label: '今天', value: esc(stats.todayFocus), foot: stats.todaySession ? '已记录，可以去改' : '还没记录' })}
    </div>

    <div class="split-main">
      <section class="card">
        ${calendarHead(calYear, calMonth)}
        ${calendarHtml}
      </section>

      <div class="stack day-panel">
        <section class="card">
          <div class="day-panel-head">
            <div class="between">
              <div>
                <div class="day-panel-date">${formatCN(selected)} <span class="small muted">${weekdayCN(selected)}</span></div>
                <div class="day-panel-sub">
                  ${isToday ? badge('今天', 'accent') : isToday ? '' : `<span>${relativeDay(selected, ctx.today)}</span>`}
                  <span>${record ? '已有训练记录' : '还没有记录'}</span>
                  ${totals.exerciseCount ? `<span>· ${totals.sets} 组 / ${totals.reps} 次</span>` : ''}
                </div>
              </div>
              <button class="btn btn-primary btn-sm" type="button" data-act="save-workout">${icon('save', 13)}保存</button>
            </div>
          </div>
          <div class="card-body">
            <div class="form-grid cols-2">
              <label class="field">
                <span class="field-label">主练部位</span>
                <input class="control" data-draft="focus" value="${esc(draft.focus)}" placeholder="胸 / 背 / 腿 / 肩臂 / 有氧" list="focus-list" />
                <datalist id="focus-list">
                  ${['胸', '背', '腿', '肩臂', '核心', '有氧', '全身', '休息']
                    .map((f) => `<option value="${f}"></option>`)
                    .join('')}
                </datalist>
              </label>
              <label class="field">
                <span class="field-label">时长（分钟）</span>
                <input class="control" type="number" min="0" step="5" data-draft="durationMin" value="${n(draft.durationMin)}" />
              </label>
              <label class="field span-2">
                <span class="field-label">感受 / 备注</span>
                <input class="control" data-draft="note" value="${esc(draft.note)}" placeholder="状态好、卧推加了 2.5kg…" />
              </label>
            </div>

            <div class="divider"></div>

            <div class="between" style="margin-bottom:6px">
              <div class="card-title">${icon('dumbbell', 14)}动作</div>
              <div class="row">
                <button class="btn btn-ghost btn-sm" type="button" data-act="apply-plan">套用当天计划（${esc(plan[parseISO(selected)?.getDay()] || '休息')}）</button>
                <button class="btn btn-soft btn-sm" type="button" data-act="add-exercise">${icon('plus', 12)}加动作</button>
              </div>
            </div>

            ${
              draft.exercises.length
                ? `<div class="exercise-head"><span>动作</span><span>组</span><span>次</span><span>重量kg</span><span></span></div>
                  ${draft.exercises
                    .map(
                      (ex, i) => `<div class="exercise">
                        <input class="control" data-ex="${i}" data-field="name" value="${esc(ex.name)}" placeholder="卧推 / 深蹲" />
                        <input class="control" type="number" min="0" data-ex="${i}" data-field="sets" value="${n(ex.sets)}" />
                        <input class="control" type="number" min="0" data-ex="${i}" data-field="reps" value="${n(ex.reps)}" />
                        <input class="control" type="number" min="0" step="2.5" data-ex="${i}" data-field="weight" value="${n(ex.weight)}" />
                        <button class="btn btn-icon" type="button" data-del-ex="${i}" title="删除">${icon('close', 13)}</button>
                      </div>`
                    )
                    .join('')}`
                : `<div class="empty" style="padding:18px">
                    <div class="empty-icon">${icon('dumbbell', 18)}</div>
                    <h4>这一天还没有动作</h4>
                    <p>点「加动作」，记下动作名、组数、次数和重量。</p>
                  </div>`
            }

            <div class="row mt-12">
              <button class="btn btn-primary" type="button" data-act="save-workout">${icon('save', 14)}保存这天</button>
              <button class="btn btn-ghost" type="button" data-act="add-to-today">${icon('plus', 14)}把训练加入今日计划</button>
              ${
                record
                  ? `<button class="btn btn-danger-ghost spacer" type="button" data-act="del-workout">删除记录</button>`
                  : ''
              }
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="grid cols-3 mt-16">
      <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('target', 15)}本周进度</div><div class="card-sub">目标 ${stats.weeklyGoal} 次/周</div></div></div>
          <div class="card-body">
            ${progressBar(stats.weeklyGoal ? Math.round((stats.thisWeekCount / stats.weeklyGoal) * 100) : 0, 'accent', `${stats.thisWeekCount} / ${stats.weeklyGoal} 次`)}
            <div class="divider"></div>
            <div class="tiny muted" style="margin-bottom:6px">本周练过的日子</div>
            <div class="pill-row">
              ${
                stats.weekDates.length
                  ? stats.weekDates.map((d) => `<span class="chip on">${mdCN(d)} ${esc(byDate.get(d)?.focus || '')}</span>`).join('')
                  : '<span class="tiny muted">这周还没开始练。</span>'
              }
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('calendar', 15)}一周训练模板</div><div class="card-sub">点日历某天会按这里预填部位</div></div></div>
          <div class="card-body">
            <div class="form-grid cols-2">
              ${WEEKDAY_LABELS.slice(1)
                .concat(WEEKDAY_LABELS.slice(0, 1))
                .map((label, idx) => {
                  const dow = (idx + 1) % 7;
                  return `<div class="row" style="padding:2px 0">
                    <span class="small muted" style="width:34px">${label}</span>
                    <input class="control" style="height:30px" data-plan-day="${dow}" value="${esc(plan[dow] || '')}" placeholder="休息" />
                  </div>`;
                })
                .join('')}
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('flame', 15)}近 30 天部位分布</div><div class="card-sub">别只练胸</div></div></div>
          <div class="card-body">${donut({
            items: stats.focusDistribution.map((f, i) => ({ label: f.focus, value: f.count, color: CHART_COLORS[i % CHART_COLORS.length] })),
            size: 128,
            centerValue: String(stats.last30Count),
            centerLabel: '次',
          })}</div>
      </section>
    </div>`;
  },

  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      const calBtn = e.target.closest('[data-cal]');
      if (calBtn) {
        const dir = calBtn.dataset.cal;
        if (dir === 'today') {
          const d = parseISO(ctx.today);
          calYear = d.getFullYear();
          calMonth = d.getMonth();
          selected = ctx.today;
        } else {
          const d = new Date(calYear, calMonth + (dir === 'next' ? 1 : -1), 1, 12);
          calYear = d.getFullYear();
          calMonth = d.getMonth();
        }
        draft = makeDraft(ctx.state, selected);
        ctx.rerender();
        return;
      }

      const cell = e.target.closest('[data-date]');
      if (cell) {
        selected = cell.dataset.date;
        const d = parseISO(selected);
        calYear = d.getFullYear();
        calMonth = d.getMonth();
        draft = makeDraft(ctx.state, selected);
        ctx.rerender();
        return;
      }

      if (e.target.closest('[data-act="add-exercise"]')) {
        draft.exercises.push({ id: uid('ex'), name: '', sets: 4, reps: 8, weight: 0 });
        ctx.rerender();
        return;
      }
      const delEx = e.target.closest('[data-del-ex]');
      if (delEx) {
        draft.exercises.splice(Number(delEx.dataset.delEx), 1);
        ctx.rerender();
        return;
      }
      if (e.target.closest('[data-act="apply-plan"]')) {
        const dow = parseISO(selected)?.getDay();
        draft.focus = ctx.state.fitness.weekdayPlan?.[dow] || '休息';
        ctx.rerender();
        return;
      }
      if (e.target.closest('[data-act="save-workout"]')) {
        saveDraft(ctx);
        return;
      }
      if (e.target.closest('[data-act="add-to-today"]')) {
        const created = addToToday(ctx.state, {
          title: `健身：${draft.focus || '训练'}${draft.exercises.length ? `（${draft.exercises.length} 个动作）` : ''}`,
          module: 'fitness',
          refId: `fitness_${selected}`,
          priority: 'mid',
          slot: 'evening',
        }).created;
        if (created) {
          ctx.update(() => {});
          ctx.toast('已加入今日计划');
        } else {
          ctx.toast('已经在今日计划里了');
        }
        return;
      }
      if (e.target.closest('[data-act="del-workout"]')) {
        confirmDialog({ title: '删除这天的训练记录？', message: '动作数据会一起删除。', confirmText: '删除', danger: true }).then((ok) => {
          if (!ok) return;
          ctx.update((st) => {
            st.fitness.sessions = st.fitness.sessions.filter((s) => s.date !== selected);
          });
          draft = makeDraft(ctx.state, selected);
          ctx.toast('记录已删除');
        });
      }
    });

    root.addEventListener('input', (e) => {
      const fieldName = e.target.dataset.draft;
      if (fieldName) {
        draft[fieldName] = e.target.value;
        return;
      }
      const exIdx = e.target.dataset.ex;
      if (exIdx !== undefined) {
        const key = e.target.dataset.field;
        draft.exercises[Number(exIdx)][key] = e.target.value;
        return;
      }
      const planDay = e.target.dataset.planDay;
      if (planDay !== undefined) {
        ctx.update((st) => {
          st.fitness.weekdayPlan[planDay] = e.target.value;
        }, { rerender: false });
      }
    });
  },
};
