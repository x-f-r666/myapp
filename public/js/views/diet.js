/** 饮食计划：月历按天记录三餐，自动算热量与蛋白质，和每日目标对比。 */
import { addDays, formatCN, mdCN, parseISO, weekdayCN, lastNDays } from '../core/dates.js';
import { MEALS, uid } from '../core/model.js';
import { dietDayTotals, dietStats, findDietDay } from '../core/stats.js';
import {
  esc,
  icon,
  badge,
  openModal,
  field,
  formGrid,
  readForm,
  confirmDialog,
  statBlock,
  progressBar,
  emptyState,
} from '../components/ui.js';
import { monthCalendar, calendarHead } from '../components/calendar.js';
import { lineChart, CHART_COLORS } from '../components/charts.js';
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
  const day = findDietDay(state, date);
  if (day) {
    return {
      date,
      existingId: day.id,
      water: n(day.water),
      note: day.note || '',
      meals: {
        breakfast: (day.meals?.breakfast || []).map((e) => ({ ...e })),
        lunch: (day.meals?.lunch || []).map((e) => ({ ...e })),
        dinner: (day.meals?.dinner || []).map((e) => ({ ...e })),
        snack: (day.meals?.snack || []).map((e) => ({ ...e })),
      },
    };
  }
  return { date, existingId: null, water: 0, note: '', meals: { breakfast: [], lunch: [], dinner: [], snack: [] } };
}

function saveDraft(ctx) {
  if (!draft) return;
  ctx.update((st) => {
    const idx = st.diet.days.findIndex((d) => d.date === draft.date);
    const payload = {
      id: draft.existingId || uid('diet'),
      date: draft.date,
      water: n(draft.water),
      note: draft.note,
      meals: {
        breakfast: draft.meals.breakfast,
        lunch: draft.meals.lunch,
        dinner: draft.meals.dinner,
        snack: draft.meals.snack,
      },
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) st.diet.days[idx] = { ...st.diet.days[idx], ...payload };
    else st.diet.days.push({ ...payload, createdAt: new Date().toISOString() });
  });
  ctx.toast(`${formatCN(draft.date)} 的饮食已保存`);
}

function openFoodModal(ctx) {
  openModal({
    title: '添加常用食物',
    subtitle: '加进食物库，下次一点就填好',
    size: 'sm',
    body: formGrid(
      field({ label: '食物名', name: 'name', value: '', placeholder: '鸡胸肉', required: true, span: 2 }) +
        field({ label: '单位', name: 'unit', value: '100g', placeholder: '1 个 / 100g / 1 碗' }) +
        field({ label: '热量（kcal）', name: 'kcal', type: 'number', min: 0, value: 0 }) +
        field({ label: '蛋白质（g）', name: 'protein', type: 'number', min: 0, step: 0.1, value: 0 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">加入食物库</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.name) return node.querySelector('[name="name"]').focus();
        ctx.update((st) => {
          st.diet.foods.push({
            id: uid('food'),
            name: raw.name,
            unit: raw.unit || '1 份',
            kcal: n(raw.kcal),
            protein: n(raw.protein),
          });
        });
        close();
        ctx.toast('已加入食物库');
      });
    },
  });
}

function openManualMealModal(ctx, mealKey) {
  const mealLabel = MEALS.find((m) => m.key === mealKey)?.label || '加餐';
  openModal({
    title: `手动添加 · ${mealLabel}`,
    size: 'sm',
    body: formGrid(
      field({ label: '吃了什么', name: 'name', value: '', placeholder: '牛肉面', required: true, span: 2 }) +
        field({ label: '份量', name: 'qty', value: '1 份' }) +
        field({ label: '热量（kcal）', name: 'kcal', type: 'number', min: 0, value: 0 }) +
        field({ label: '蛋白质（g）', name: 'protein', type: 'number', min: 0, step: 0.1, value: 0 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">添加</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.name) return node.querySelector('[name="name"]').focus();
        draft.meals[mealKey].push({
          id: uid('meal'),
          name: raw.name,
          qty: raw.qty || '1 份',
          kcal: n(raw.kcal),
          protein: n(raw.protein),
        });
        close();
        ctx.rerender();
      });
    },
  });
}

export default {
  render(state, ctx) {
    ensureCal(ctx);
    const stats = dietStats(state, ctx.today);
    const totals = dietDayTotals(draft);
    const targets = stats.targets;
    const byDate = new Map(state.diet.days.map((d) => [d.date, d]));
    const isToday = selected === ctx.today;
    const foods = state.diet.foods;

    const calendarHtml = monthCalendar({
      year: calYear,
      month: calMonth,
      today: ctx.today,
      selected,
      dayHtml: (cell) => {
        const day = byDate.get(cell.iso);
        if (!day) return '';
        const t = dietDayTotals(day);
        if (!t.items && !t.water) return '';
        const over = targets.kcal > 0 && t.kcal > targets.kcal;
        return `<span class="cal-tag diet ${over ? 'over' : ''}">${t.kcal} kcal</span>
          <span class="cal-more">${t.protein}g 蛋白</span>`;
      },
    });

    const mealBlocks = MEALS.map((meal) => {
      const entries = draft.meals[meal.key];
      const kcal = entries.reduce((a, e) => a + n(e.kcal), 0);
      return `<div class="meal-block">
        <div class="meal-head">
          <b>${meal.label}</b>
          <span class="kcal">${Math.round(kcal)} kcal</span>
        </div>
        <div class="meal-items">
          ${
            entries.length
              ? entries
                  .map(
                    (e, i) => `<div class="meal-item">
                      <span class="m-name">${esc(e.name)}</span>
                      <span class="m-qty">${esc(e.qty || '')}</span>
                      <span class="m-kcal">${Math.round(n(e.kcal))} kcal · ${n(e.protein)}g</span>
                      <button class="btn btn-icon" style="width:22px;height:22px" type="button" data-del-meal="${meal.key}:${i}" title="删除">${icon('close', 12)}</button>
                    </div>`
                  )
                  .join('')
              : `<div class="tiny muted" style="padding:5px 0">还没记。</div>`
          }
        </div>
        <div class="meal-add">
          <select class="control" data-food-select="${meal.key}" aria-label="选择食物">
            <option value="">从食物库选择…</option>
            ${foods.map((f) => `<option value="${esc(f.id)}">${esc(f.name)} · ${f.kcal}kcal/${esc(f.unit)}</option>`).join('')}
          </select>
          <input class="control" style="max-width:64px" type="number" min="1" step="0.5" value="1" data-food-qty="${meal.key}" aria-label="份数" />
          <button class="btn btn-soft btn-sm" type="button" data-add-food="${meal.key}">添加</button>
          <button class="btn btn-ghost btn-sm" type="button" data-manual="${meal.key}" title="手动添加">${icon('plus', 13)}</button>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="kpi-grid" style="margin-bottom:16px">
      ${statBlock({ label: '今日热量', value: `${totals.kcal}`, unit: `/ ${targets.kcal || '—'} kcal`, foot: stats.remaining >= 0 ? `还可吃 ${stats.remaining} kcal` : `超出 ${Math.abs(stats.remaining)} kcal`, iconName: 'bowl' })}
      ${statBlock({ label: '蛋白质', value: `${totals.protein}`, unit: `/ ${targets.protein || '—'} g`, foot: `${stats.proteinPct}% 达成` })}
      ${statBlock({ label: '饮水', value: `${totals.water}`, unit: `/ ${targets.water || '—'} 杯`, foot: `今天记了 ${totals.items} 项食物` })}
      ${statBlock({ label: '近 7 天平均', value: `${stats.avgKcal}`, unit: 'kcal', foot: `记录过 ${stats.daysLogged} 天` })}
    </div>

    <div class="split-main">
      <div class="stack">
        <section class="card">
          ${calendarHead(calYear, calMonth)}
          ${calendarHtml}
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('target', 15)}近 7 天热量</div><div class="card-sub">对照每日目标看波动</div></div></div>
          <div class="card-body">${lineChart({
            labels: stats.series.map((s) => mdCN(s.date)),
            series: [{ name: '热量', values: stats.series.map((s) => s.kcal), color: CHART_COLORS[1] }],
            height: 180,
            width: 560,
            valueSuffix: ' kcal',
          })}</div>
        </section>
      </div>

      <div class="stack day-panel">
        <section class="card">
          <div class="day-panel-head">
            <div class="between">
              <div>
                <div class="day-panel-date">${formatCN(selected)} <span class="small muted">${weekdayCN(selected)}</span></div>
                <div class="day-panel-sub">
                  ${isToday ? badge('今天', 'accent') : ''}
                  <span>${totals.kcal} kcal · ${totals.protein}g 蛋白</span>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" type="button" data-act="save-diet">${icon('save', 13)}保存</button>
            </div>
          </div>
          <div class="card-body">
            <div class="progress-row">
              <div class="between"><span>热量</span><b>${totals.kcal} / ${targets.kcal || '—'}</b></div>
              ${progressBar(stats.kcalPct, totals.kcal > targets.kcal && targets.kcal > 0 ? 'danger' : 'accent')}
            </div>
            <div class="progress-row mt-12">
              <div class="between"><span>蛋白质</span><b>${totals.protein} / ${targets.protein || '—'} g</b></div>
              ${progressBar(stats.proteinPct, 'info')}
            </div>
            <div class="mt-12">
              <div class="between" style="margin-bottom:6px"><span class="tiny muted">饮水（点格子记录）</span><span class="tiny muted">${totals.water} / ${targets.water || '—'} 杯</span></div>
              <div class="water-dots">
                ${Array.from({ length: Math.max(targets.water || 8, 8) }, (_, i) => {
                  const idx = i + 1;
                  return `<button class="water-dot ${totals.water >= idx ? 'on' : ''}" type="button" data-water="${idx}" aria-label="第 ${idx} 杯水"></button>`;
                }).join('')}
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('bowl', 15)}三餐记录</div><div class="card-sub">每改一次记得点保存</div></div>
            <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-act="add-food-lib">${icon('plus', 13)}食物库</button></div>
          </div>
          <div class="card-body stack-sm">
            ${mealBlocks}
          </div>
          <div class="modal-foot" style="border-top:1px solid var(--line)">
            <button class="btn btn-ghost" type="button" data-act="add-diet-today">${icon('plus', 14)}加入今日计划</button>
            <button class="btn btn-primary" type="button" data-act="save-diet">${icon('save', 14)}保存这天</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('settings', 15)}我的目标</div><div class="card-sub">改完立即生效</div></div></div>
          <div class="card-body">
            <div class="form-grid cols-2">
              <label class="field"><span class="field-label">每日热量 kcal</span>
                <input class="control" type="number" min="0" step="50" data-target="calorieTarget" value="${targets.kcal}" /></label>
              <label class="field"><span class="field-label">蛋白质 g</span>
                <input class="control" type="number" min="0" step="5" data-target="proteinTarget" value="${targets.protein}" /></label>
              <label class="field"><span class="field-label">饮水杯数</span>
                <input class="control" type="number" min="0" step="1" data-target="waterTarget" value="${targets.water}" /></label>
              <label class="field span-2"><span class="field-label">常用食物</span>
                <button class="btn btn-ghost btn-block" type="button" data-act="add-food-lib">${icon('plus', 13)}管理食物库（${foods.length} 种）</button></label>
            </div>
          </div>
        </section>
      </div>
    </div>`;
  },

  bind(root, ctx) {
    root.addEventListener('click', async (e) => {
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

      const water = e.target.closest('[data-water]');
      if (water) {
        const idx = Number(water.dataset.water);
        draft.water = draft.water === idx ? idx - 1 : idx;
        ctx.rerender();
        return;
      }

      const delMeal = e.target.closest('[data-del-meal]');
      if (delMeal) {
        const [mealKey, idx] = delMeal.dataset.delMeal.split(':');
        draft.meals[mealKey].splice(Number(idx), 1);
        ctx.rerender();
        return;
      }

      const addFood = e.target.closest('[data-add-food]');
      if (addFood) {
        const mealKey = addFood.dataset.addFood;
        const select = root.querySelector(`[data-food-select="${mealKey}"]`);
        const qtyInput = root.querySelector(`[data-food-qty="${mealKey}"]`);
        const food = ctx.state.diet.foods.find((f) => f.id === select.value);
        if (!food) {
          ctx.toast('先选一个食物', 'warn');
          return;
        }
        const qty = n(qtyInput.value, 1) || 1;
        draft.meals[mealKey].push({
          id: uid('meal'),
          name: food.name,
          qty: `${qty} × ${food.unit}`,
          kcal: Math.round(food.kcal * qty),
          protein: Math.round(food.protein * qty * 10) / 10,
        });
        ctx.rerender();
        return;
      }

      const manual = e.target.closest('[data-manual]');
      if (manual) {
        openManualMealModal(ctx, manual.dataset.manual);
        return;
      }

      if (e.target.closest('[data-act="save-diet"]')) {
        saveDraft(ctx);
        return;
      }
      if (e.target.closest('[data-act="add-food-lib"]')) {
        openFoodModal(ctx);
        return;
      }
      if (e.target.closest('[data-act="add-diet-today"]')) {
        const created = addToToday(ctx.state, {
          title: `饮食：记录三餐（${totalsOf(draft).kcal} kcal）`,
          module: 'diet',
          refId: `diet_${selected}`,
          priority: 'low',
          slot: 'evening',
        }).created;
        if (created) {
          ctx.update(() => {});
          ctx.toast('已加入今日计划');
        } else {
          ctx.toast('已经在今日计划里了');
        }
      }
    });

    root.addEventListener('input', (e) => {
      const target = e.target.dataset.target;
      if (target) {
        ctx.update((st) => {
          st.settings[target] = n(e.target.value);
        }, { rerender: false });
      }
    });
  },
};

function totalsOf(day) {
  return dietDayTotals(day);
}
