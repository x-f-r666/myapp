import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISO,
  todayISO,
  addDays,
  startOfWeek,
  lastNDays,
  monthMatrix,
  formatCN,
  weekdayCN,
  monthLabel,
  diffDays,
  parseISO,
} from '../public/js/core/dates.js';
import {
  tasksOn,
  doneRate,
  focusTasks,
  dashboardSummary,
  contentStats,
  devStats,
  consultingStats,
  fitnessStats,
  fitnessStreak,
  workoutTotals,
  dietDayTotals,
  dietStats,
  findDietDay,
  gamesStats,
  memosSorted,
  sortTasks,
  pendingFollowUps,
} from '../public/js/core/stats.js';
import { createInitialState, normalizeState, validateState, uid } from '../public/js/core/model.js';
import { monthCalendar } from '../public/js/components/calendar.js';

/* --------------------------------- 夹具 ---------------------------------- */

const TODAY = '2026-11-12';
const iso = (s) => s;

function baseState() {
  const s = createInitialState();
  s.today.tasks = [];
  s.today.memos = [];
  s.today.focus = [];
  return s;
}

function task(over = {}) {
  return {
    id: uid('task'),
    title: '任务',
    note: '',
    module: 'today',
    refId: '',
    priority: 'mid',
    slot: 'morning',
    done: false,
    date: TODAY,
    createdAt: '2026-11-12T01:00:00.000Z',
    ...over,
  };
}

/* --------------------------------- 日期 ---------------------------------- */

test('monthMatrix 恒定 42 格，周一开头', () => {
  const feb = monthMatrix(2026, 1);
  assert.equal(feb.length, 42);
  // 2026-02-01 是周日，周一起始 → 第一格回到 1 月 26 日（周一）
  assert.equal(feb[0].iso, '2026-01-26');
  assert.equal(feb[0].inMonth, false);
  assert.equal(feb.filter((c) => c.inMonth).length, 28);
  assert.equal(feb[6].iso, '2026-02-01');
  assert.equal(feb[6].inMonth, true);
});

test('monthMatrix 30 天的月份、跨年与今天高亮', () => {
  const nov = monthMatrix(2026, 10);
  assert.equal(nov.length, 42);
  assert.equal(nov.filter((c) => c.inMonth).length, 30);
  assert.equal(nov[0].iso, '2026-10-26');
  assert.ok(nov.some((c) => c.iso === '2026-11-12'));

  const dec = monthMatrix(2026, 11);
  assert.equal(dec[41].iso, '2027-01-10');
  assert.equal(dec.filter((c) => c.inMonth).length, 31);
});

test('日期基础运算', () => {
  assert.equal(addDays('2026-11-12', 1), '2026-11-13');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(startOfWeek('2026-11-12'), '2026-11-09');
  assert.equal(startOfWeek('2026-11-09'), '2026-11-09');
  assert.equal(startOfWeek('2026-11-15'), '2026-11-09');
  assert.equal(formatCN('2026-11-12'), '11月12日');
  assert.equal(weekdayCN('2026-11-12'), '周四');
  assert.equal(monthLabel(2026, 10), '2026年11月');
  assert.equal(diffDays('2026-11-12', '2026-11-05'), 7);
  assert.equal(parseISO('bad'), null);
});

test('lastNDays 长度与顺序（含当天）', () => {
  const days = lastNDays(7, TODAY);
  assert.equal(days.length, 7);
  assert.equal(days[6], TODAY);
  assert.equal(days[0], '2026-11-06');
  assert.equal(todayISO(new Date(2026, 10, 12)), TODAY);
});

/* -------------------------------- 今日计划 ------------------------------- */

test('doneRate 不除零、四舍五入', () => {
  assert.equal(doneRate([]), 0);
  assert.equal(doneRate([task({ done: true })]), 100);
  assert.equal(doneRate([task({ done: true }), task({ done: false }), task({ done: false })]), 33);
});

test('tasksOn 只取当天并按 未完成 → 高优先级 排序', () => {
  const s = baseState();
  s.today.tasks = [
    task({ title: 'A', priority: 'low' }),
    task({ title: 'B', priority: 'high', done: true }),
    task({ title: 'C', priority: 'high' }),
    task({ title: 'D', date: '2026-11-11' }),
  ];
  const list = tasksOn(s, TODAY);
  assert.equal(list.length, 3);
  assert.deepEqual(
    list.map((t) => t.title),
    ['C', 'A', 'B']
  );
  assert.equal(sortTasks([]).length, 0);
});

test('focusTasks 最多三条且按设定顺序', () => {
  const s = baseState();
  const a = task({ title: 'A' });
  const b = task({ title: 'B' });
  const c = task({ title: 'C' });
  s.today.tasks = [a, b, c];
  s.today.focus = [c.id, a.id];
  assert.deepEqual(
    focusTasks(s, TODAY).map((t) => t.title),
    ['C', 'A']
  );
  s.today.focus = [c.id, a.id, b.id, 'not_exist'];
  assert.equal(focusTasks(s, TODAY).length, 3);
});

test('memos 置顶优先，其次按时间倒序', () => {
  const s = baseState();
  s.today.memos = [
    { id: '1', text: '旧', pinned: false, createdAt: '2026-11-11T00:00:00Z' },
    { id: '2', text: '新', pinned: false, createdAt: '2026-11-12T00:00:00Z' },
    { id: '3', text: '置顶', pinned: true, createdAt: '2026-11-10T00:00:00Z' },
  ];
  assert.deepEqual(
    memosSorted(s).map((m) => m.text),
    ['置顶', '新', '旧']
  );
});

test('dashboardSummary 汇总今日、重点、遗留、待跟进', () => {
  const s = baseState();
  const a = task({ title: '写方案' });
  s.today.tasks = [a, task({ title: '昨天没做完', date: '2026-11-11' })];
  s.today.focus = [a.id];
  s.consulting.clients = [{ id: 'c1', name: '王总', stage: 'talking' }];
  s.consulting.sessions = [
    { id: 's1', clientId: 'c1', date: TODAY, followUpDate: '2026-11-10', followedUp: false, summary: '聊了需求' },
    { id: 's2', clientId: 'c1', date: TODAY, followUpDate: '2026-12-01', followedUp: false, summary: '以后再说' },
    { id: 's3', clientId: 'c1', date: TODAY, followUpDate: '2026-11-01', followedUp: true, summary: '已完成' },
  ];
  const sum = dashboardSummary(s, TODAY);
  assert.equal(sum.tasks.length, 1);
  assert.equal(sum.focus.length, 1);
  assert.equal(sum.carryOver.length, 1);
  assert.equal(sum.doneRate, 0);
  assert.equal(sum.followUps.length, 1);
  assert.equal(sum.followUps[0].session.id, 's1');
  assert.equal(pendingFollowUps(s, TODAY).length, 1);
});

/* --------------------------------- 自媒体 -------------------------------- */

function contentState() {
  const s = baseState();
  s.content.posts = [
    {
      id: 'p1',
      title: '第一条',
      platform: '抖音',
      publishedAt: '2026-10-01',
      snapshots: [
        { date: '2026-11-01', views: 1000, likes: 50, comments: 5, followers: 10 },
        { date: '2026-11-10', views: 3000, likes: 120, comments: 12, followers: 30 },
      ],
    },
    {
      id: 'p2',
      title: '第二条',
      platform: 'B站',
      publishedAt: '2026-11-05',
      snapshots: [{ date: '2026-11-09', views: 500, likes: 20, comments: 2, followers: 5 }],
    },
  ];
  return s;
}

test('内容快照按日期沿用最近一次数据，不跳 0', () => {
  const s = contentState();
  const stats = contentStats(s, 30, TODAY);
  assert.equal(stats.totalViews, 3500);
  assert.equal(stats.postCount, 2);
  assert.equal(stats.series.length, 30);
  const before = stats.series.find((p) => p.date === '2026-10-20');
  assert.equal(before.views, 0, '作品发布前应为 0');
  const mid = stats.series.find((p) => p.date === '2026-11-05');
  assert.equal(mid.views, 1000, '只有 11-01 快照时沿用 1000');
  const end = stats.series[stats.series.length - 1];
  assert.equal(end.views, 3500);
  assert.equal(end.followers, 35);
});

test('平台汇总、排行与互动率', () => {
  const s = contentState();
  const stats = contentStats(s, 30, TODAY);
  assert.deepEqual(
    stats.platformTotals.map((p) => [p.platform, p.views]),
    [
      ['抖音', 3000],
      ['B站', 500],
    ]
  );
  assert.equal(stats.ranking[0].post.id, 'p1');
  assert.equal(stats.engagementRate, 4.4);
  assert.equal(stats.avgViews, 1750);
});

test('没有任何作品时图表数据为空且不报错', () => {
  const stats = contentStats(baseState(), 7, TODAY);
  assert.equal(stats.totalViews, 0);
  assert.equal(stats.series.length, 7);
  assert.equal(stats.series.every((p) => p.views === 0), true);
  assert.equal(stats.engagementRate, 0);
});

/* --------------------------------- 开发 --------------------------------- */

function devState() {
  const s = baseState();
  s.dev.projects = [
    { id: 'pr1', name: '记账 App', status: 'active', color: '#2C6353' },
    { id: 'pr2', name: '官网', status: 'done' },
  ];
  s.dev.items = [
    { id: 'i1', projectId: 'pr1', title: '登录', type: 'feature', status: 'doing', estimateH: 8, spentH: 3 },
    { id: 'i2', projectId: 'pr1', title: '闪退', type: 'bug', status: 'todo', estimateH: 2, spentH: 0 },
    { id: 'i3', projectId: 'pr2', title: '首页改版', type: 'feature', status: 'done', estimateH: 20, spentH: 18 },
  ];
  s.dev.logs = [
    { id: 'l1', projectId: 'pr1', date: '2026-11-10', hours: 3, content: '写登录' },
    { id: 'l2', projectId: 'pr1', date: '2026-11-12', hours: 2.5, content: '调接口' },
    { id: 'l3', projectId: 'pr2', date: '2026-11-11', hours: 4, content: '改首页' },
    { id: 'l4', projectId: 'pr1', date: '2026-11-01', hours: 9, content: '上上周' },
  ];
  return s;
}

test('开发：本周工时只算周一起，按项目汇总', () => {
  const stats = devStats(devState(), TODAY);
  assert.equal(stats.weekHours, 9.5);
  assert.equal(stats.totalHours, 18.5);
  assert.equal(stats.activeProjects, 1);
  assert.equal(stats.doingItems.length, 1);
  assert.equal(stats.byProject.find((p) => p.id === 'pr1').hours, 5.5);
  assert.equal(stats.byProject.find((p) => p.id === 'pr2').hours, 4);
});

test('开发：工作项状态与类型分布合计等于总数', () => {
  const stats = devStats(devState(), TODAY);
  assert.equal(stats.statusCounts.reduce((a, x) => a + x.count, 0), 3);
  assert.equal(stats.typeCounts.reduce((a, x) => a + x.count, 0), 3);
  assert.equal(stats.statusCounts.find((x) => x.key === 'done').count, 1);
});

test('开发：删掉项目后该项目不再出现在项目工时里', () => {
  const s = devState();
  s.dev.projects = s.dev.projects.filter((p) => p.id !== 'pr2');
  const stats = devStats(s, TODAY);
  assert.equal(stats.byProject.length, 1);
  assert.equal(stats.byProject[0].id, 'pr1');
});

/* --------------------------------- 咨询 --------------------------------- */

function consultState() {
  const s = baseState();
  s.consulting.clients = [
    { id: 'c1', name: '王总', stage: 'delivering' },
    { id: 'c2', name: '李姐', stage: 'talking' },
    { id: 'c3', name: '老张', stage: 'lost' },
    { id: 'c4', name: '陈工', stage: 'signed' },
  ];
  s.consulting.projects = [
    { id: 'pj1', clientId: 'c1', name: '年度顾问', amount: 60000, status: 'active', startDate: '2026-09-01', endDate: '2026-11-30' },
    { id: 'pj2', clientId: 'c4', name: '内训', amount: 20000, status: 'delivered', startDate: '2026-10-01', endDate: '2026-10-20' },
    { id: 'pj3', clientId: 'c2', name: '诊断', amount: 8000, status: 'planning', startDate: '2026-11-20', endDate: '' },
  ];
  s.consulting.sessions = [
    { id: 's1', clientId: 'c1', date: '2026-11-01', minutes: 60, followUpDate: '2026-11-10', followedUp: false, nextStep: '发报价' },
    { id: 's2', clientId: 'c2', date: '2026-11-05', minutes: 30, followUpDate: '2026-12-05', followedUp: false, nextStep: '等回复' },
  ];
  return s;
}

test('咨询：流失客户不计入在跟进，金额按状态归类', () => {
  const stats = consultingStats(consultState(), TODAY);
  assert.equal(stats.activeClients, 3);
  assert.equal(stats.pipelineValue, 68000);
  assert.equal(stats.wonValue, 20000);
  assert.equal(stats.clientStageCounts.find((x) => x.key === 'lost').count, 1);
});

test('咨询：近 6 个月收入按结束月归集', () => {
  const stats = consultingStats(consultState(), TODAY);
  assert.equal(stats.monthlyRevenue.length, 6);
  const oct = stats.monthlyRevenue.find((m) => m.key === '2026-10');
  assert.equal(oct.amount, 20000);
  const nov = stats.monthlyRevenue.find((m) => m.key === '2026-11');
  assert.equal(nov.amount, 0, '进行中的项目不计入收入');
});

test('咨询：逾期跟进排在最前，完成跟进后消失', () => {
  const s = consultState();
  const stats = consultingStats(s, TODAY);
  assert.equal(stats.dueFollowUps.length, 1);
  assert.equal(stats.followUps[0].session.id, 's1');
  s.consulting.sessions[0].followedUp = true;
  assert.equal(consultingStats(s, TODAY).dueFollowUps.length, 0);
});

test('咨询：删除客户后统计同步减少', () => {
  const s = consultState();
  const before = consultingStats(s, TODAY).activeClients;
  s.consulting.clients = s.consulting.clients.filter((c) => c.id !== 'c1');
  s.consulting.projects = s.consulting.projects.filter((p) => p.clientId !== 'c1');
  const after = consultingStats(s, TODAY);
  assert.equal(after.activeClients, before - 1);
  assert.equal(after.pipelineValue, 8000);
});

/* --------------------------------- 健身 --------------------------------- */

function fitnessState() {
  const s = baseState();
  s.fitness.sessions = [
    {
      id: 'w1',
      date: '2026-11-12',
      focus: '胸',
      durationMin: 60,
      exercises: [
        { id: 'e1', name: '卧推', sets: 4, reps: 8, weight: 60 },
        { id: 'e2', name: '飞鸟', sets: 3, reps: 12, weight: 12 },
      ],
    },
    { id: 'w2', date: '2026-11-11', focus: '背', durationMin: 50, exercises: [{ id: 'e3', name: '引体', sets: 4, reps: 6, weight: 0 }] },
    { id: 'w3', date: '2026-11-09', focus: '腿', durationMin: 55, exercises: [] },
    { id: 'w4', date: '2026-10-20', focus: '胸', durationMin: 45, exercises: [] },
  ];
  return s;
}

test('健身：动作组数/次数/容量合计', () => {
  const totals = workoutTotals(fitnessState().fitness.sessions[0]);
  assert.equal(totals.exerciseCount, 2);
  assert.equal(totals.sets, 7);
  assert.equal(totals.reps, 68);
  assert.equal(totals.volume, 4 * 8 * 60 + 3 * 12 * 12);
  assert.equal(workoutTotals(null).sets, 0);
});

test('健身：本周次数、部位分布（近 30 天）与连续天数', () => {
  const s = fitnessState();
  const stats = fitnessStats(s, TODAY);
  assert.equal(stats.thisWeekCount, 3);
  assert.equal(stats.thisWeekMinutes, 165);
  assert.equal(stats.streak, 2, '今天和昨天连续，前天断档');
  assert.equal(stats.focusDistribution.find((f) => f.focus === '胸').count, 2);
  assert.equal(stats.totalCount, 4);
});

test('健身：今天没练时连续天数从昨天算起', () => {
  const s = fitnessState();
  s.fitness.sessions = s.fitness.sessions.filter((x) => x.date !== TODAY);
  assert.equal(fitnessStreak(s, TODAY), 1);
  s.fitness.sessions = [];
  assert.equal(fitnessStreak(s, TODAY), 0);
});

/* --------------------------------- 饮食 --------------------------------- */

function dietState() {
  const s = baseState();
  s.settings.calorieTarget = 2000;
  s.settings.proteinTarget = 120;
  s.settings.waterTarget = 8;
  s.diet.days = [
    {
      id: 'd1',
      date: TODAY,
      water: 3,
      meals: {
        breakfast: [{ id: 'f1', name: '鸡蛋', qty: '2 个', kcal: 156, protein: 12.6 }],
        lunch: [{ id: 'f2', name: '米饭', qty: '150g', kcal: 174, protein: 3.9 }],
        dinner: [],
        snack: [{ id: 'f3', name: '牛奶', qty: '250ml', kcal: 135, protein: 8 }],
      },
    },
    {
      id: 'd2',
      date: '2026-11-11',
      water: 8,
      meals: {
        breakfast: [],
        lunch: [{ id: 'f4', name: '牛肉面', qty: '1 碗', kcal: 800, protein: 30 }],
        dinner: [],
        snack: [],
      },
    },
  ];
  return s;
}

test('饮食：当日四餐合计与达成率', () => {
  const s = dietState();
  const day = findDietDay(s, TODAY);
  const totals = dietDayTotals(day);
  assert.equal(totals.kcal, 465);
  assert.equal(totals.protein, 24.5);
  assert.equal(totals.items, 3);
  assert.equal(totals.water, 3);
  assert.equal(dietDayTotals(null).kcal, 0);

  const stats = dietStats(s, TODAY);
  assert.equal(stats.remaining, 1535);
  assert.equal(stats.over, false);
  assert.equal(stats.kcalPct, 23);
  assert.equal(stats.waterPct, 38);
});

test('饮食：超过目标才算超，等号不算', () => {
  const s = dietState();
  s.diet.days[0].meals.lunch[0].kcal = 2000 - 156 - 135;
  assert.equal(dietStats(s, TODAY).over, false);
  s.diet.days[0].meals.lunch[0].kcal += 1;
  const stats = dietStats(s, TODAY);
  assert.equal(stats.over, true);
  assert.ok(stats.remaining < 0);
});

test('饮食：近 7 天缺数据补 0 而不是断点', () => {
  const stats = dietStats(dietState(), TODAY);
  assert.equal(stats.series.length, 7);
  assert.equal(stats.series[6].date, TODAY);
  assert.equal(stats.series[6].kcal, 465);
  assert.equal(stats.series[5].kcal, 800);
  assert.equal(stats.series[0].kcal, 0);
  assert.equal(stats.daysLogged, 2);
});

/* --------------------------------- 游戏 --------------------------------- */

function gameState() {
  const s = baseState();
  s.games.items = [
    { id: 'g1', title: '塞尔达', platform: 'Switch', status: 'playing', rating: 5 },
    { id: 'g2', title: '只狼', platform: 'PC', status: 'dropped', rating: 3 },
    { id: 'g3', title: '星露谷', platform: 'PC', status: 'backlog', rating: 0 },
  ];
  s.games.sessions = [
    { id: 'g1s', date: '2026-11-12', itemId: 'g1', minutes: 90 },
    { id: 'g2s', date: '2026-11-10', itemId: 'g1', minutes: 60 },
    { id: 'g3s', date: '2026-11-02', itemId: 'g2', minutes: 120 },
    { id: 'g4s', date: '2026-10-20', itemId: 'g1', minutes: 45 },
  ];
  return s;
}

test('游戏：本周/本月时长与四周分桶', () => {
  const stats = gamesStats(gameState(), TODAY);
  assert.equal(stats.weekMinutes, 150);
  assert.equal(stats.monthMinutes, 315);
  assert.equal(stats.last4Weeks.length, 4);
  assert.equal(stats.last4Weeks[3].minutes, 150);
  assert.equal(stats.last4Weeks[2].minutes, 120);
  assert.equal(stats.playingCount, 1);
  assert.equal(stats.statusCounts.reduce((a, x) => a + x.count, 0), 3);
  assert.equal(stats.byItem[0].item.id, 'g1');
});

/* --------------------------------- 模型 --------------------------------- */

test('normalizeState 补齐缺失字段，坏数组回落为空', () => {
  const s = normalizeState({ today: { tasks: 'oops' }, settings: { nickname: '小林' } });
  assert.equal(s.today.tasks.length, 0);
  assert.equal(s.settings.nickname, '小林');
  assert.ok(Array.isArray(s.fitness.sessions));
  assert.ok(s.fitness.weekdayPlan['1']);
  assert.ok(s.diet.foods.length > 0);
  assert.equal(s.version, 1);
  const empty = normalizeState(null);
  assert.equal(empty.today.tasks.length, 0);
});

test('validateState 能识别结构问题', () => {
  assert.deepEqual(validateState(null), ['数据必须是一个 JSON 对象']);
  assert.ok(validateState({}).length > 0);
  const ok = createInitialState();
  assert.deepEqual(validateState(ok), []);
  const badItem = createInitialState();
  badItem.today.tasks = [{ title: '没有 id' }];
  assert.ok(validateState(badItem).some((e) => e.includes('缺少 id')));
});

/* --------------------------------- 日历组件 ------------------------------- */

test('月历渲染 42 格、跨月标记、可点击日期', () => {
  const html = monthCalendar({
    year: 2026,
    month: 10,
    today: TODAY,
    selected: '2026-11-12',
    dayHtml: (cell) => (cell.inMonth ? `<span class="cal-tag">${cell.day}</span>` : ''),
  });
  assert.equal((html.match(/cal-cell/g) || []).length, 42);
  assert.equal((html.match(/outside/g) || []).length, 12, '10 月 26-31 + 12 月 1-6');
  assert.ok(html.includes('data-date="2026-11-12"'));
  assert.ok(html.includes('today'));
  assert.ok(html.includes('selected'));
  assert.ok(html.includes('cal-week'));
});

test('toISO 使用本地时区，不因时差跑到昨天', () => {
  const d = new Date(2026, 10, 12, 0, 30);
  assert.equal(toISO(d), '2026-11-12');
  assert.equal(iso('2026-11-12'), '2026-11-12');
});

test('normalizeState 必须保留字符串数组（重点 id / 平台 / 标签）', () => {
  const s = createInitialState();
  s.today.tasks = [{ id: 't1', title: 'A', date: '2026-11-12', done: false }];
  s.today.focus = ['t1'];
  s.content.platforms = ['抖音', 'B站', '视频号'];
  s.content.ideas = [{ id: 'i1', title: '选题', tags: ['效率', '复盘'] }];
  const n = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n.today.focus, ['t1'], '今日重点被清空了');
  assert.deepEqual(n.content.platforms, ['抖音', 'B站', '视频号']);
  assert.deepEqual(n.content.ideas[0].tags, ['效率', '复盘']);
  assert.equal(n.today.tasks.length, 1);
});
