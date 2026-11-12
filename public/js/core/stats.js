/**
 * 聚合统计：所有「算数」集中在这里，视图只负责展示，测试直接验证这里。
 */
import { todayISO, addDays, lastNDays, startOfWeek, diffDays, parseISO, mdCN } from './dates.js';
import { CONTENT_STAGES, DEV_STATUS, DEV_TYPES, CLIENT_STAGES, GAME_STATUS, MEALS } from './model.js';

const sum = (arr, pick = (x) => x) => arr.reduce((acc, x) => acc + (Number(pick(x)) || 0), 0);
export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

const PRIORITY_RANK = { high: 0, mid: 1, low: 2 };

/** 排序：未完成在前 → 高优先级在前 → 创建时间新在前 */
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    const pa = PRIORITY_RANK[a.priority] ?? 1;
    const pb = PRIORITY_RANK[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

export function tasksOn(state, iso = todayISO()) {
  return sortTasks(state.today.tasks.filter((t) => t.date === iso));
}

export function doneRate(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

/** 今日重点：按 focus 顺序取，最多 3 条 */
export function focusTasks(state, iso = todayISO()) {
  const onDay = state.today.tasks.filter((t) => t.date === iso);
  const ids = (state.today.focus || []).slice(0, 3);
  const out = [];
  for (const id of ids) {
    const t = onDay.find((x) => x.id === id);
    if (t) out.push(t);
  }
  return out;
}

export function tasksBySlot(tasks) {
  return ['morning', 'afternoon', 'evening'].map((slot) => ({
    slot,
    tasks: tasks.filter((t) => (t.slot || 'morning') === slot),
  }));
}

export function memosSorted(state) {
  return [...state.today.memos].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

/* ---------------------------------- 自媒体 --------------------------------- */

export function latestSnapshot(post, date = '9999-12-31') {
  const list = Array.isArray(post.snapshots) ? post.snapshots : [];
  let best = null;
  for (const s of list) {
    if (!s || !s.date) continue;
    if (s.date <= date && (!best || s.date > best.date)) best = s;
  }
  return best;
}

export function postMetrics(post, date = '9999-12-31') {
  const snap = latestSnapshot(post, date);
  return {
    views: Number(snap?.views) || 0,
    likes: Number(snap?.likes) || 0,
    comments: Number(snap?.comments) || 0,
    followers: Number(snap?.followers) || 0,
    snapDate: snap?.date || null,
  };
}

export function contentStats(state, days = 30, today = todayISO()) {
  const posts = state.content.posts || [];
  const withMetrics = posts.map((p) => ({ post: p, ...postMetrics(p, today) }));
  const totalViews = sum(withMetrics, (x) => x.views);
  const totalLikes = sum(withMetrics, (x) => x.likes);
  const totalComments = sum(withMetrics, (x) => x.comments);
  const totalFollowers = sum(withMetrics, (x) => x.followers);

  const platformMap = new Map();
  for (const m of withMetrics) {
    const key = m.post.platform || '未标注';
    const cur = platformMap.get(key) || { platform: key, count: 0, views: 0, likes: 0 };
    cur.count += 1;
    cur.views += m.views;
    cur.likes += m.likes;
    platformMap.set(key, cur);
  }
  const platformTotals = [...platformMap.values()].sort((a, b) => b.views - a.views);

  const dates = lastNDays(days, today);
  const series = dates.map((date) => {
    let views = 0;
    let likes = 0;
    let followers = 0;
    for (const p of posts) {
      const m = postMetrics(p, date);
      views += m.views;
      likes += m.likes;
      followers += m.followers;
    }
    return { date, views, likes, followers };
  });

  const totalInteractions = totalLikes + totalComments;
  return {
    posts,
    postCount: posts.length,
    totalViews,
    totalLikes,
    totalComments,
    totalFollowers,
    totalInteractions,
    engagementRate: totalViews > 0 ? round1((totalInteractions / totalViews) * 100) : 0,
    avgViews: posts.length ? Math.round(totalViews / posts.length) : 0,
    platformTotals,
    series,
    ranking: withMetrics.sort((a, b) => b.views - a.views).slice(0, 8),
    stageCounts: CONTENT_STAGES.map((s) => ({
      ...s,
      count: (state.content.ideas || []).filter((i) => (i.stage || 'idea') === s.key).length,
    })),
  };
}

/* ---------------------------------- 开发 ---------------------------------- */

export function devStats(state, today = todayISO()) {
  const projects = state.dev.projects || [];
  const items = state.dev.items || [];
  const logs = state.dev.logs || [];
  const weekStart = startOfWeek(today);
  const weekLogs = logs.filter((l) => l.date >= weekStart && l.date <= today);
  const weekHours = round1(sum(weekLogs, (l) => l.hours));

  const byProject = projects
    .map((p) => {
      const hours = round1(sum(weekLogs.filter((l) => l.projectId === p.id), (l) => l.hours));
      const openItems = items.filter((i) => i.projectId === p.id && i.status !== 'done');
      const allItems = items.filter((i) => i.projectId === p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color || '#2C6353',
        status: p.status,
        stack: p.stack || '',
        repo: p.repo || '',
        hours,
        openCount: openItems.length,
        totalCount: allItems.length,
        doingCount: openItems.filter((i) => i.status === 'doing').length,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const statusCounts = DEV_STATUS.map((s) => ({
    ...s,
    count: items.filter((i) => (i.status || 'todo') === s.key).length,
  }));
  const typeCounts = DEV_TYPES.map((t) => ({
    ...t,
    count: items.filter((i) => (i.type || 'feature') === t.key).length,
  }));

  return {
    projects,
    items,
    weekHours,
    totalHours: round1(sum(logs, (l) => l.hours)),
    activeProjects: projects.filter((p) => p.status === 'active').length,
    doingItems: items.filter((i) => i.status === 'doing'),
    todoItems: items.filter((i) => i.status === 'todo'),
    doneItems: items.filter((i) => i.status === 'done'),
    overdueItems: items.filter((i) => i.status !== 'done' && i.status === 'todo').length,
    statusCounts,
    typeCounts,
    byProject,
    weekLogs: [...weekLogs].sort((a, b) => String(b.date).localeCompare(String(a.date))),
  };
}

/* ---------------------------------- 咨询 ---------------------------------- */

export function consultingStats(state, today = todayISO()) {
  const clients = state.consulting.clients || [];
  const projects = state.consulting.projects || [];
  const sessions = state.consulting.sessions || [];

  const clientStageCounts = CLIENT_STAGES.map((s) => ({
    ...s,
    count: clients.filter((c) => (c.stage || 'lead') === s.key).length,
  }));

  const activeStages = new Set(['talking', 'signed', 'delivering']);
  const activeClients = clients.filter((c) => activeStages.has(c.stage)).length;

  const openProjects = projects.filter((p) => p.status === 'planning' || p.status === 'active');
  const closedProjects = projects.filter((p) => p.status === 'delivered' || p.status === 'closed');
  const pipelineValue = sum(openProjects, (p) => p.amount);
  const wonValue = sum(closedProjects, (p) => p.amount);

  // 近 6 个月收入（按项目结束月/开始月归集）
  const months = [];
  const base = parseISO(today);
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1, 12);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}月` });
  }
  const monthlyRevenue = months.map((m) => ({
    ...m,
    amount: sum(
      closedProjects.filter((p) => String(p.endDate || p.startDate || '').slice(0, 7) === m.key),
      (p) => p.amount
    ),
  }));

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const followUps = sessions
    .filter((s) => s.followUpDate && !s.followedUp)
    .map((s) => ({
      session: s,
      client: clientById.get(s.clientId) || null,
      overdue: s.followUpDate < today,
      dueToday: s.followUpDate === today,
    }))
    .sort((a, b) => String(a.session.followUpDate).localeCompare(String(b.session.followUpDate)));

  const topClients = clients
    .map((c) => ({
      client: c,
      amount: sum(projects.filter((p) => p.clientId === c.id), (p) => p.amount),
      projectCount: projects.filter((p) => p.clientId === c.id).length,
    }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  return {
    clients,
    projects,
    sessions,
    clientStageCounts,
    activeClients,
    pipelineValue,
    wonValue,
    monthlyRevenue,
    followUps,
    dueFollowUps: followUps.filter((f) => f.overdue || f.dueToday),
    topClients,
    minutes30: sum(
      sessions.filter((s) => s.date >= addDays(today, -30) && s.date <= today),
      (s) => s.minutes
    ),
  };
}

/* ---------------------------------- 健身 ---------------------------------- */

export function fitnessSessionsSorted(state) {
  return [...(state.fitness.sessions || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function workoutTotals(session) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  return {
    exerciseCount: exercises.length,
    sets: sum(exercises, (e) => e.sets),
    reps: sum(exercises, (e) => e.sets * e.reps),
    volume: sum(exercises, (e) => e.sets * e.reps * e.weight),
  };
}

/** 连续训练天数：今天没练则从昨天往回数 */
export function fitnessStreak(state, today = todayISO()) {
  const dates = new Set((state.fitness.sessions || []).map((s) => s.date));
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function fitnessStats(state, today = todayISO()) {
  const sessions = fitnessSessionsSorted(state);
  const weekStart = startOfWeek(today);
  const thisWeek = sessions.filter((s) => s.date >= weekStart && s.date <= today);
  const monthStart = addDays(today, -29);
  const last30 = sessions.filter((s) => s.date >= monthStart && s.date <= today);

  const focusMap = new Map();
  for (const s of last30) {
    const key = s.focus || '未标注';
    focusMap.set(key, (focusMap.get(key) || 0) + 1);
  }
  const focusDistribution = [...focusMap.entries()]
    .map(([focus, count]) => ({ focus, count }))
    .sort((a, b) => b.count - a.count);

  const todaySession = sessions.find((s) => s.date === today) || null;
  const dow = parseISO(today)?.getDay() ?? 1;
  const plannedToday = state.fitness.weekdayPlan?.[dow] || state.fitness.weekdayPlan?.[String(dow)] || '休息';

  return {
    sessions,
    todaySession,
    todayFocus: todaySession?.focus || plannedToday,
    plannedToday,
    weeklyGoal: Number(state.settings?.fitnessWeeklyGoal) || 0,
    thisWeekCount: thisWeek.length,
    thisWeekMinutes: sum(thisWeek, (s) => s.durationMin),
    totalCount: sessions.length,
    streak: fitnessStreak(state, today),
    focusDistribution,
    last30Count: last30.length,
    trainedDates: new Set(sessions.map((s) => s.date)),
    weekDates: thisWeek.map((s) => s.date),
  };
}

/* ---------------------------------- 饮食 ---------------------------------- */

export function findDietDay(state, iso) {
  return (state.diet.days || []).find((d) => d.date === iso) || null;
}

export function mealEntries(day, mealKey) {
  const list = day?.meals?.[mealKey];
  return Array.isArray(list) ? list : [];
}

export function dietDayTotals(day) {
  let kcal = 0;
  let protein = 0;
  let items = 0;
  for (const meal of MEALS) {
    for (const e of mealEntries(day, meal.key)) {
      kcal += Number(e.kcal) || 0;
      protein += Number(e.protein) || 0;
      items += 1;
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: round1(protein),
    items,
    water: Number(day?.water) || 0,
  };
}

export function dietStats(state, today = todayISO()) {
  const targets = {
    kcal: Number(state.settings?.calorieTarget) || 0,
    protein: Number(state.settings?.proteinTarget) || 0,
    water: Number(state.settings?.waterTarget) || 0,
  };
  const todayDay = findDietDay(state, today);
  const todayTotals = dietDayTotals(todayDay);
  const series = lastNDays(7, today).map((date) => {
    const t = dietDayTotals(findDietDay(state, date));
    return { date, kcal: t.kcal, protein: t.protein };
  });
  const avgKcal = Math.round(sum(series, (s) => s.kcal) / 7);
  const over = targets.kcal > 0 && todayTotals.kcal > targets.kcal;
  return {
    targets,
    todayDay,
    todayTotals,
    series,
    avgKcal,
    over,
    remaining: targets.kcal > 0 ? targets.kcal - todayTotals.kcal : 0,
    daysLogged: (state.diet.days || []).filter((d) => dietDayTotals(d).items > 0).length,
    kcalPct: targets.kcal > 0 ? Math.round((todayTotals.kcal / targets.kcal) * 100) : 0,
    proteinPct: targets.protein > 0 ? Math.round((todayTotals.protein / targets.protein) * 100) : 0,
    waterPct: targets.water > 0 ? Math.round((todayTotals.water / targets.water) * 100) : 0,
  };
}

/* ---------------------------------- 游戏 ---------------------------------- */

export function gamesStats(state, today = todayISO()) {
  const items = state.games.items || [];
  const sessions = state.games.sessions || [];
  const weekStart = startOfWeek(today);
  const monthStart = addDays(today, -29);
  const weekMinutes = sum(sessions.filter((s) => s.date >= weekStart && s.date <= today), (s) => s.minutes);
  const monthMinutes = sum(sessions.filter((s) => s.date >= monthStart && s.date <= today), (s) => s.minutes);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const monthSessions = sessions.filter((s) => s.date >= monthStart && s.date <= today);
  const byItem = items
    .map((i) => ({
      item: i,
      minutes: sum(monthSessions.filter((s) => s.itemId === i.id), (s) => s.minutes),
    }))
    .filter((x) => x.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const statusCounts = GAME_STATUS.map((s) => ({
    ...s,
    count: items.filter((i) => (i.status || 'backlog') === s.key).length,
  }));

  const last4Weeks = [];
  for (let i = 3; i >= 0; i -= 1) {
    const start = addDays(weekStart, -7 * i);
    const end = addDays(start, 6);
    last4Weeks.push({
      start,
      end,
      label: mdCN(start),
      minutes: sum(sessions.filter((s) => s.date >= start && s.date <= end), (s) => s.minutes),
    });
  }

  const recent = [...sessions].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);

  return {
    items,
    sessions,
    weekMinutes,
    monthMinutes,
    byItem,
    statusCounts,
    playingCount: items.filter((i) => i.status === 'playing').length,
    last4Weeks,
    recent: recent.map((s) => ({ ...s, item: itemById.get(s.itemId) || null })),
    avgRating:
      items.filter((i) => Number(i.rating) > 0).length > 0
        ? round1(sum(items.filter((i) => Number(i.rating) > 0), (i) => i.rating) / items.filter((i) => Number(i.rating) > 0).length)
        : 0,
  };
}

/* ---------------------------------- 跟进 ---------------------------------- */

export function pendingFollowUps(state, today = todayISO()) {
  const { followUps } = consultingStats(state, today);
  return followUps.filter((f) => f.overdue || f.dueToday);
}

/* ---------------------------------- 首页 ---------------------------------- */

export function dashboardSummary(state, today = todayISO()) {
  const tasks = tasksOn(state, today);
  const yesterday = addDays(today, -1);
  const carryOver = tasksOn(state, yesterday).filter((t) => !t.done);
  return {
    today,
    tasks,
    doneRate: doneRate(tasks),
    doneCount: tasks.filter((t) => t.done).length,
    openCount: tasks.filter((t) => !t.done).length,
    focus: focusTasks(state, today),
    carryOver,
    memos: memosSorted(state),
    content: contentStats(state, 7, today),
    dev: devStats(state, today),
    consulting: consultingStats(state, today),
    fitness: fitnessStats(state, today),
    diet: dietStats(state, today),
    games: gamesStats(state, today),
    followUps: pendingFollowUps(state, today),
  };
}

export function weekRangeLabel(iso) {
  const start = startOfWeek(iso);
  return `${mdCN(start)} - ${mdCN(addDays(start, 6))}`;
}

export { diffDays, sum };
