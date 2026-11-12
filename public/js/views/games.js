/** 游戏娱乐：玩什么、玩多久、值不值。 */
import { GAME_STATUS, uid } from '../core/model.js';
import { gamesStats } from '../core/stats.js';
import { mdCN } from '../core/dates.js';
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
  statBlock,
  stars,
  fmtMinutes,
} from '../components/ui.js';
import { barChart, donut, CHART_COLORS } from '../components/charts.js';
import { n } from './_helpers.js';

let statusFilter = 'all';

const STATUS_TONE = { playing: 'warn', backlog: 'neutral', done: 'accent', dropped: 'danger' };
const STATUS_LABEL = Object.fromEntries(GAME_STATUS.map((s) => [s.key, s.label]));

function openGameModal(item, ctx) {
  const isEdit = !!item;
  const d = item || { title: '', platform: 'PC', status: 'playing', rating: 0, note: '' };
  openModal({
    title: isEdit ? '编辑条目' : '添加游戏 / 娱乐',
    subtitle: '游戏、剧、电影都行，反正是自己的娱乐账本',
    body: formGrid(
      field({ label: '名称', name: 'title', value: d.title, placeholder: '塞尔达传说', required: true, span: 2 }) +
        field({ label: '平台 / 类型', name: 'platform', value: d.platform || '', placeholder: 'PC / Switch / 剧集' }) +
        field({ label: '状态', name: 'status', value: d.status, options: GAME_STATUS.map((s) => ({ value: s.key, label: s.label })) }) +
        field({ label: '评分（0-5）', name: 'rating', type: 'number', min: 0, max: 5, step: 1, value: d.rating || 0, hint: '0 表示还没打分' }) +
        field({ label: '备注', name: 'note', type: 'textarea', value: d.note || '', placeholder: '进度、感想、为什么弃坑…', rows: 2, span: 2 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">${isEdit ? '保存' : '添加'}</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        if (!raw.title) return node.querySelector('[name="title"]').focus();
        const data = { ...raw, rating: Math.min(5, Math.max(0, n(raw.rating))) };
        ctx.update((st) => {
          if (isEdit) Object.assign(st.games.items.find((g) => g.id === item.id), data);
          else st.games.items.unshift({ id: uid('game'), ...data, createdAt: new Date().toISOString() });
        });
        close();
        ctx.toast(isEdit ? '已更新' : '已添加');
      });
    },
  });
}

function openPlayModal(ctx, presetItemId = '') {
  const items = ctx.state.games.items;
  if (items.length === 0) {
    ctx.toast('先添加一个游戏或娱乐条目', 'warn');
    openGameModal(null, ctx);
    return;
  }
  openModal({
    title: '记一次游玩',
    size: 'sm',
    body: formGrid(
      field({
        label: '玩的是什么',
        name: 'itemId',
        value: presetItemId || items[0].id,
        options: items.map((i) => ({ value: i.id, label: i.title })),
        span: 2,
      }) +
        field({ label: '日期', name: 'date', type: 'date', value: ctx.today }) +
        field({ label: '时长（分钟）', name: 'minutes', type: 'number', min: 1, step: 15, value: 60 }) +
        field({ label: '心情 / 备注', name: 'mood', value: '', placeholder: '放松、有点上瘾、打完很爽', span: 2 }),
      2
    ),
    footer: `<button class="btn btn-ghost" type="button" data-close="1">取消</button>
      <button class="btn btn-primary" type="button" data-save="1">记录</button>`,
    onMount: (node, close) => {
      node.querySelectorAll('[data-close="1"]').forEach((b) => b.addEventListener('click', close));
      node.querySelector('[data-save="1"]').addEventListener('click', () => {
        const raw = readForm(node);
        const minutes = n(raw.minutes);
        if (minutes <= 0) return ctx.toast('时长要大于 0', 'warn');
        ctx.update((st) => {
          st.games.sessions.unshift({
            id: uid('play'),
            itemId: raw.itemId,
            date: raw.date || ctx.today,
            minutes,
            mood: raw.mood || '',
          });
        });
        close();
        ctx.toast(`已记录 ${minutes} 分钟`);
      });
    },
  });
}

export default {
  render(state, ctx) {
    const stats = gamesStats(state, ctx.today);
    const items = state.games.items.filter((i) => statusFilter === 'all' || i.status === statusFilter);
    const minutesById = new Map(stats.byItem.map((b) => [b.item.id, b.minutes]));

    return `
    <div class="kpi-grid" style="margin-bottom:16px">
      ${statBlock({ label: '本周娱乐', value: `${Math.round(stats.weekMinutes / 6) / 10}`, unit: '小时', foot: fmtMinutes(stats.weekMinutes), iconName: 'game' })}
      ${statBlock({ label: '本月累计', value: `${Math.round(stats.monthMinutes / 6) / 10}`, unit: '小时', foot: `平均每天 ${Math.round(stats.monthMinutes / 30)} 分钟` })}
      ${statBlock({ label: '在玩', value: `${stats.playingCount}`, unit: '个', foot: `共 ${stats.items.length} 个条目` })}
      ${statBlock({ label: '平均评分', value: stats.avgRating ? `${stats.avgRating}` : '—', unit: stats.avgRating ? '/ 5' : '', foot: '只统计打过分的' })}
    </div>

    <div class="toolbar">
      <div class="pill-row">
        <button class="chip ${statusFilter === 'all' ? 'on' : ''}" type="button" data-gstatus="all">全部 ${state.games.items.length}</button>
        ${GAME_STATUS.map(
          (s) => `<button class="chip ${statusFilter === s.key ? 'on' : ''}" type="button" data-gstatus="${s.key}">${s.label} ${
            state.games.items.filter((i) => (i.status || 'backlog') === s.key).length
          }</button>`
        ).join('')}
      </div>
      <span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-act="new-game">${icon('plus', 14)}新增条目</button>
      <button class="btn btn-primary" type="button" data-act="new-play">${icon('game', 14)}记一次游玩</button>
    </div>

    <div class="split-main">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div><div class="card-title">${icon('game', 15)}我的清单</div><div class="card-sub">按状态筛选，共 ${items.length} 个</div></div>
          </div>
          <div class="card-body">
            ${
              items.length
                ? `<div class="summary-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
                  ${items
                    .map(
                      (g) => `<div class="summary-card" style="cursor:default" data-module="games">
                        <div class="between">
                          <div class="summary-head" style="min-width:0">
                            <span class="summary-icon">${icon('game', 15)}</span>
                            <span class="truncate" style="max-width:16ch" title="${esc(g.title)}">${esc(g.title)}</span>
                          </div>
                          ${badge(STATUS_LABEL[g.status] || '想玩', STATUS_TONE[g.status] || 'neutral')}
                        </div>
                        <div class="row" style="justify-content:space-between">
                          <span class="tiny muted">${esc(g.platform || '—')}</span>
                          ${stars(g.rating)}
                        </div>
                        <div class="summary-foot">
                          <span>近 30 天 ${fmtMinutes(minutesById.get(g.id) || 0)}</span>
                          <span class="spacer"></span>
                          <button class="btn btn-icon" type="button" data-play="${esc(g.id)}" title="记一次">${icon('plus', 13)}</button>
                          <button class="btn btn-icon" type="button" data-edit-game="${esc(g.id)}" title="编辑">${icon('edit', 13)}</button>
                          <button class="btn btn-icon" type="button" data-del-game="${esc(g.id)}" title="删除">${icon('trash', 13)}</button>
                        </div>
                      </div>`
                    )
                    .join('')}
                </div>`
                : emptyState({
                    iconName: 'game',
                    title: '清单是空的',
                    text: '把在玩的、想玩的、打完的都记进来，时间花得值不值就有数了。',
                    action: `<button class="btn btn-primary btn-sm" type="button" data-act="new-game">${icon('plus', 13)}添加第一个</button>`,
                  })
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('clock', 15)}最近记录</div><div class="card-sub">最近 8 次</div></div></div>
          <div class="card-body">
            ${
              stats.recent.length
                ? stats.recent
                    .map(
                      (s) => `<div class="list-item">
                        <span class="badge badge-neutral">${mdCN(s.date)}</span>
                        <div class="list-main">
                          <div class="list-title">${esc(s.item?.title || '已删除的条目')}</div>
                          <div class="list-sub">${s.mood ? esc(s.mood) : fmtMinutes(s.minutes)}</div>
                        </div>
                        <b class="small num">${fmtMinutes(s.minutes)}</b>
                        <button class="btn btn-icon" type="button" data-del-play="${esc(s.id)}" title="删除">${icon('trash', 13)}</button>
                      </div>`
                    )
                    .join('')
                : `<p class="tiny muted">还没有游玩记录。</p>`
            }
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('target', 15)}近 4 周时长</div><div class="card-sub">周一开始算</div></div></div>
          <div class="card-body">${barChart({
            labels: stats.last4Weeks.map((w) => w.label),
            values: stats.last4Weeks.map((w) => w.minutes),
            height: 170,
            width: 360,
            color: CHART_COLORS[4],
            valueFormat: (v) => fmtMinutes(v),
          })}</div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('game', 15)}时间花在哪</div><div class="card-sub">近 30 天</div></div></div>
          <div class="card-body">${
            stats.byItem.length
              ? barChart({
                  labels: stats.byItem.slice(0, 6).map((b) => b.item.title),
                  values: stats.byItem.slice(0, 6).map((b) => b.minutes),
                  horizontal: true,
                  width: 340,
                  height: 140,
                  valueFormat: (v) => fmtMinutes(v),
                })
              : `<p class="tiny muted">近 30 天没有记录。</p>`
          }</div>
        </section>

        <section class="card">
          <div class="card-head"><div><div class="card-title">${icon('check', 15)}状态分布</div><div class="card-sub">共 ${stats.items.length} 个</div></div></div>
          <div class="card-body">${donut({
            items: stats.statusCounts.map((s, i) => ({
              label: s.label,
              value: s.count,
              color: [CHART_COLORS[1], CHART_COLORS[2], CHART_COLORS[0], CHART_COLORS[5]][i],
            })),
            size: 128,
            centerValue: String(stats.items.length),
            centerLabel: '个条目',
          })}</div>
        </section>
      </div>
    </div>`;
  },

  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-gstatus]');
      if (chip) {
        statusFilter = chip.dataset.gstatus;
        ctx.rerender();
        return;
      }
      if (e.target.closest('[data-act="new-game"]')) return openGameModal(null, ctx);
      if (e.target.closest('[data-act="new-play"]')) return openPlayModal(ctx);

      const play = e.target.closest('[data-play]');
      if (play) return openPlayModal(ctx, play.dataset.play);

      const edit = e.target.closest('[data-edit-game]');
      if (edit) {
        const g = ctx.state.games.items.find((x) => x.id === edit.dataset.editGame);
        if (g) openGameModal(g, ctx);
        return;
      }

      const del = e.target.closest('[data-del-game]');
      if (del) {
        confirmDialog({
          title: '删除这个条目？',
          message: '它名下的游玩记录也会一起删除。',
          confirmText: '删除',
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          ctx.update((st) => {
            st.games.items = st.games.items.filter((x) => x.id !== del.dataset.delGame);
            st.games.sessions = st.games.sessions.filter((s) => s.itemId !== del.dataset.delGame);
          });
          ctx.toast('已删除');
        });
        return;
      }

      const delPlay = e.target.closest('[data-del-play]');
      if (delPlay) {
        ctx.update((st) => {
          st.games.sessions = st.games.sessions.filter((s) => s.id !== delPlay.dataset.delPlay);
        });
        ctx.toast('记录已删除');
      }
    });
  },
};
