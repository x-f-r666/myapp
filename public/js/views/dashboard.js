/** 首页总览：今天该做什么 + 各条线摘要。 */
import { greeting, formatCN, weekdayCN, relativeDay, addDays, startOfWeek } from '../core/dates.js';
import { fmtCompact, fmtMinutes, esc, icon, emptyState, priorityTag, progressBar, badge } from '../components/ui.js';
import { sparkline } from '../components/charts.js';
import { addToToday, toggleTask, moduleLabel, isInToday } from './_helpers.js';
import { uid } from '../core/model.js';

function taskRow(task, ctx) {
  return `<div class="task ${task.done ? 'done' : ''}" data-task-id="${esc(task.id)}">
    <button class="task-check" type="button" data-toggle-task="${esc(task.id)}" aria-label="${task.done ? '取消完成' : '标记完成'}">${
    task.done ? icon('check', 12) : ''
  }</button>
    <div class="task-main">
      <div class="task-title">${esc(task.title)}</div>
      <div class="task-meta">
        ${task.module && task.module !== 'today' ? badge(moduleLabel(task.module), 'neutral') : ''}
        ${task.rolledFrom ? badge('顺延', 'warn') : ''}
        ${task.slot === 'afternoon' ? '<span class="tiny muted">下午</span>' : task.slot === 'evening' ? '<span class="tiny muted">晚上</span>' : ''}
      </div>
    </div>
    ${task.priority === 'high' ? priorityTag('high') : ''}
  </div>`;
}

function summaryCard({ module, label, iconName, value, unit = '', foot = '', spark = '' }) {
  return `<button class="summary-card" type="button" data-go="${module}" data-module="${module}">
    <span class="summary-head"><span class="summary-icon">${icon(iconName, 15)}</span>${esc(label)}${icon(
    'arrow',
    13
  )}</span>
    <span class="summary-main"><span class="summary-value">${esc(value)}</span><span class="summary-unit">${esc(unit)}</span></span>
    <span class="summary-foot">${foot}</span>
    ${spark ? `<span class="summary-spark">${spark}</span>` : ''}
  </button>`;
}

export default {
  render(state, ctx) {
    const s = ctx.summary();
    const today = s.today;
    const nickname = state.settings.nickname || '';
    const contentDelta = s.content.series.length
      ? s.content.series[s.content.series.length - 1].views - s.content.series[0].views
      : 0;

    const heroTitle =
      s.tasks.length === 0
        ? '今天还是一张白纸，先写下最重要的一件事。'
        : s.openCount === 0
        ? '今天的任务全部完成了，剩下的时间留给自己。'
        : `今天还有 ${s.openCount} 件事，先做最重要的那一件。`;

    const heroSub = [
      `${formatCN(today)} ${weekdayCN(today)}`,
      s.carryOver.length ? `昨天留下 ${s.carryOver.length} 件` : '',
      s.followUps.length ? `${s.followUps.length} 位客户待跟进` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const nextFollow = s.consulting.followUps[0];
    const weekStart = startOfWeek(today);
    const weekDone = state.today.tasks.filter((t) => t.date >= weekStart && t.date <= today && t.done).length;
    const weekPosts = state.content.posts.filter((p) => p.publishedAt && p.publishedAt >= weekStart).length;
    const weekGames = s.games.last4Weeks[s.games.last4Weeks.length - 1]?.minutes || 0;
    const otherTasks = s.tasks.filter((t) => !t.done && !s.focus.some((f) => f.id === t.id));

    return `
    <section class="hero">
      <div class="hero-copy">
        <div class="hero-greet">${esc(greeting())}${nickname ? `，${esc(nickname)}` : ''}</div>
        <h2 class="hero-title">${esc(heroTitle)}</h2>
        <div class="hero-sub">${esc(heroSub)}</div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><b>${s.openCount}</b><span>待完成</span></div>
        <div class="hero-stat"><b>${s.doneCount}</b><span>已完成</span></div>
        <div class="hero-stat"><b>${s.doneRate}%</b><span>完成度</span></div>
      </div>
    </section>

    <div class="split-main mt-16">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('target', 15)}今日重点</div>
              <div class="card-sub">最多三件，做完就算今天没白过</div>
            </div>
            <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-go="today">今日计划${icon('arrow', 13)}</button></div>
          </div>
          <div class="card-body">
            ${
              s.focus.length
                ? s.focus.map((t) => taskRow(t, ctx)).join('')
                : emptyState({
                    iconName: 'target',
                    title: '还没有定今天的重点',
                    text: '去今日计划里，给最重要的任务点亮星标。',
                    action: '<button class="btn btn-soft btn-sm" type="button" data-go="today">去挑三件事</button>',
                  })
            }
            ${
              otherTasks.length
                ? `<div class="divider"></div>
                  <div class="between" style="margin-bottom:2px"><span class="tiny muted">其它待办（${otherTasks.length}）</span>
                  <button class="btn btn-ghost btn-sm" type="button" data-go="today">全部</button></div>
                  ${otherTasks.slice(0, 6).map((t) => taskRow(t, ctx)).join('')}`
                : ''
            }
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('spark', 15)}快速备忘</div>
              <div class="card-sub">想到什么先扔进来，回车即存</div>
            </div>
            <div class="card-actions"><span class="tiny muted">${s.memos.length} 条</span></div>
          </div>
          <div class="card-body">
            <form class="memo-input" data-memo-form>
              <input class="control" name="memo" placeholder="比如：明天问一下王工合同的付款节点" autocomplete="off" maxlength="200" />
              <button class="btn btn-primary" type="submit">${icon('plus', 14)}记下</button>
            </form>
            <div class="mt-8">
              ${
                s.memos.length
                  ? s.memos
                      .slice(0, 6)
                      .map(
                        (m) => `<div class="memo ${m.pinned ? 'pinned' : ''}">
                          ${m.pinned ? `<span class="focus-mark">${icon('pin', 12)}</span>` : ''}
                          <span class="memo-text">${esc(m.text)}</span>
                          <span class="memo-actions">
                            <button class="btn btn-icon" type="button" data-pin-memo="${esc(m.id)}" title="${m.pinned ? '取消置顶' : '置顶'}">${icon(
                          'pin',
                          13
                        )}</button>
                            <button class="btn btn-icon" type="button" data-del-memo="${esc(m.id)}" title="删除">${icon('trash', 13)}</button>
                          </span>
                        </div>`
                      )
                      .join('')
                  : `<p class="tiny muted" style="padding:6px 0">还没有备忘。随手记一句，比记住更可靠。</p>`
              }
            </div>
          </div>
        </section>
      </div>

      <div class="stack">
        ${
          s.carryOver.length
            ? `<section class="card pad">
                <div class="between">
                  <div>
                    <div class="card-title">${icon('clock', 15)}昨天还没做完</div>
                    <div class="card-sub">${s.carryOver.length} 件事可以顺延到今天</div>
                  </div>
                  <button class="btn btn-soft btn-sm" type="button" data-act="carry">带入今天</button>
                </div>
                <div class="mt-8">
                  ${s.carryOver
                    .slice(0, 3)
                    .map((t) => `<div class="tiny muted truncate">· ${esc(t.title)}</div>`)
                    .join('')}
                </div>
              </section>`
            : ''
        }

        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('users', 15)}待跟进客户</div>
              <div class="card-sub">到期与逾期的跟进</div>
            </div>
            <div class="card-actions"><button class="btn btn-ghost btn-sm" type="button" data-go="consulting">咨询${icon('arrow', 13)}</button></div>
          </div>
          <div class="card-body">
            ${
              s.followUps.length
                ? s.followUps
                    .slice(0, 5)
                    .map(
                      (f) => `<div class="followup">
                        <div class="list-main">
                          <div class="list-title">${esc(f.client?.name || '未关联客户')}${
                        f.overdue ? badge('逾期', 'danger') : badge('今天', 'warn')
                      }</div>
                          <div class="list-sub">${esc(f.session.nextStep || f.session.summary || '没有写下一步')}</div>
                        </div>
                        <button class="btn btn-icon" type="button" data-done-follow="${esc(f.session.id)}" title="标记已跟进">${icon(
                        'check',
                        15
                      )}</button>
                      </div>`
                    )
                    .join('')
                : `<p class="tiny muted">没有到期的跟进，客户这边是干净的。</p>`
            }
          </div>
        </section>

        <section class="card pad">
          <div class="between">
            <div class="card-title">${icon('calendar', 15)}今天的状态</div>
            <button class="btn btn-ghost btn-sm" type="button" data-go="fitness">健身${icon('arrow', 13)}</button>
          </div>
          <div class="kv mt-8">
            <span>今天练什么</span><b>${esc(s.fitness.todayFocus)}${s.fitness.todaySession ? '（已记录）' : ''}</b>
          </div>
          <div class="kv"><span>本周训练</span><b>${s.fitness.thisWeekCount} / ${s.fitness.weeklyGoal || '—'} 次</b></div>
          <div class="kv"><span>今日热量</span><b>${s.diet.todayTotals.kcal} / ${s.diet.targets.kcal || '—'} kcal</b></div>
          <div class="mt-8">${progressBar(s.diet.kcalPct, s.diet.over ? 'danger' : 'accent')}</div>
        </section>

        <section class="card pad">
          <div class="between">
            <div class="card-title">${icon('spark', 15)}本周小结</div>
            <span class="tiny muted">周一起算</span>
          </div>
          <div class="kv mt-8"><span>完成的事</span><b>${weekDone} 件</b></div>
          <div class="kv"><span>开发投入</span><b>${s.dev.weekHours} 小时</b></div>
          <div class="kv"><span>训练</span><b>${s.fitness.thisWeekCount} 次</b></div>
          <div class="kv"><span>发布作品</span><b>${weekPosts} 条</b></div>
          <div class="kv"><span>游戏娱乐</span><b>${fmtMinutes(weekGames)}</b></div>
        </section>
      </div>
    </div>

    <section class="mt-24">
      <div class="section-head">
        <h2>各条线</h2>
        <p>一眼看进展，点进去处理</p>
      </div>
      <div class="summary-grid">
        ${summaryCard({
          module: 'content',
          label: '自媒体',
          iconName: 'video',
          value: `${contentDelta >= 0 ? '+' : ''}${fmtCompact(contentDelta)}`,
          unit: '近 7 天播放',
          foot: `${s.content.postCount} 条作品 · ${s.content.platformTotals.length} 个平台`,
          spark: s.content.series.length ? sparkline(s.content.series.map((p) => p.views), { width: 120, height: 30 }) : '',
        })}
        ${summaryCard({
          module: 'dev',
          label: '开发工作',
          iconName: 'code',
          value: `${s.dev.weekHours}`,
          unit: '本周工时',
          foot: `${s.dev.doingItems.length} 个进行中 · ${s.dev.activeProjects} 个在跑项目`,
        })}
        ${summaryCard({
          module: 'consulting',
          label: '咨询工作',
          iconName: 'briefcase',
          value: `${s.consulting.activeClients}`,
          unit: '位客户在跟进',
          foot: nextFollow
            ? `最近跟进 ${relativeDay(nextFollow.session.followUpDate)}`
            : `合同金额 ¥${fmtCompact(s.consulting.pipelineValue)}`,
        })}
        ${summaryCard({
          module: 'fitness',
          label: '健身计划',
          iconName: 'dumbbell',
          value: `${s.fitness.thisWeekCount}`,
          unit: `/ ${s.fitness.weeklyGoal || '—'} 次`,
          foot: `今天：${esc(s.fitness.todayFocus)} · 连续 ${s.fitness.streak} 天`,
        })}
        ${summaryCard({
          module: 'diet',
          label: '饮食计划',
          iconName: 'bowl',
          value: `${s.diet.todayTotals.kcal}`,
          unit: 'kcal',
          foot: s.diet.targets.kcal
            ? s.diet.remaining >= 0
              ? `还可摄入 ${s.diet.remaining} kcal · 蛋白 ${s.diet.todayTotals.protein}g`
              : `已超目标 ${Math.abs(s.diet.remaining)} kcal`
            : `今天记了 ${s.diet.todayTotals.items} 项`,
        })}
        ${summaryCard({
          module: 'games',
          label: '游戏娱乐',
          iconName: 'game',
          value: `${Math.round(s.games.weekMinutes / 6) / 10}`,
          unit: '小时 / 本周',
          foot: `${s.games.playingCount} 个在玩 · 本月 ${fmtMinutes(s.games.monthMinutes)}`,
        })}
      </div>
    </section>`;
  },

  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-task]');
      if (toggle) {
        ctx.update((st) => toggleTask(st, toggle.dataset.toggleTask));
        return;
      }
      const pin = e.target.closest('[data-pin-memo]');
      if (pin) {
        ctx.update((st) => {
          const m = st.today.memos.find((x) => x.id === pin.dataset.pinMemo);
          if (m) m.pinned = !m.pinned;
        });
        return;
      }
      const del = e.target.closest('[data-del-memo]');
      if (del) {
        ctx.update((st) => {
          st.today.memos = st.today.memos.filter((x) => x.id !== del.dataset.delMemo);
        });
        ctx.toast('备忘已删除');
        return;
      }
      const follow = e.target.closest('[data-done-follow]');
      if (follow) {
        ctx.update((st) => {
          const sess = st.consulting.sessions.find((x) => x.id === follow.dataset.doneFollow);
          if (sess) {
            sess.followedUp = true;
            sess.followedUpAt = new Date().toISOString();
          }
        });
        ctx.toast('已标记跟进完成');
        return;
      }
      if (e.target.closest('[data-act="carry"]')) {
        const s = ctx.summary();
        let count = 0;
        ctx.update((st) => {
          for (const t of s.carryOver) {
            const dup = st.today.tasks.some((x) => x.date === ctx.today && x.title === t.title && !x.done);
            if (dup) continue;
            st.today.tasks.push({
              id: uid('task'),
              title: t.title,
              note: t.note || '',
              module: t.module || 'today',
              refId: '',
              priority: t.priority || 'mid',
              slot: t.slot || 'morning',
              done: false,
              date: ctx.today,
              rolledFrom: t.date,
              createdAt: new Date().toISOString(),
            });
            count += 1;
          }
        });
        ctx.toast(count ? `已带入 ${count} 件事` : '没有需要带入的任务');
      }
    });

    root.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-memo-form]');
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('input[name="memo"]');
      const text = input.value.trim();
      if (!text) return;
      ctx.update((st) => {
        st.today.memos.unshift({
          id: `memo_${Date.now().toString(36)}`,
          text,
          pinned: false,
          createdAt: new Date().toISOString(),
        });
      });
      form.reset();
      input.focus();
    });
  },
};
