/** 测试夹具：一份「什么都有一点」的数据，用来验证 9 个页面都能渲染。 */
import { createInitialState, uid } from '../public/js/core/model.js';
import { dashboardSummary } from '../public/js/core/stats.js';

export const TODAY = '2026-11-12';

export function richState() {
  const s = createInitialState();
  s.settings.nickname = '小林';
  s.settings.calorieTarget = 2200;
  s.settings.proteinTarget = 130;
  s.settings.waterTarget = 8;

  const t1 = { id: 'task_a', title: '写完咨询方案第 2 版', note: '客户周五要看', module: 'consulting', refId: 'sess_1', priority: 'high', slot: 'morning', done: false, date: TODAY, createdAt: '2026-11-12T01:00:00Z' };
  const t2 = { id: 'task_b', title: '修登录态丢失', note: '', module: 'dev', refId: 'item_1', priority: 'mid', slot: 'afternoon', done: false, date: TODAY, createdAt: '2026-11-12T02:00:00Z' };
  const t3 = { id: 'task_c', title: '回一封邮件', note: '', module: 'today', refId: '', priority: 'low', slot: 'evening', done: true, date: TODAY, createdAt: '2026-11-12T03:00:00Z' };
  s.today.tasks = [t1, t2, t3, { ...t2, id: 'task_d', title: '昨天没做完的事', date: '2026-11-11', done: false }];
  s.today.focus = [t1.id, t2.id];
  s.today.memos = [
    { id: 'memo_1', text: '问一下王工合同付款节点', pinned: true, createdAt: '2026-11-12T04:00:00Z' },
    { id: 'memo_2', text: '买猫粮', pinned: false, createdAt: '2026-11-12T05:00:00Z' },
  ];

  s.content.ideas = [
    { id: 'idea_1', title: '一个人搭完整套个人系统', angle: '从零到一的过程记录', platform: 'B站', stage: 'script', tags: ['效率', '复盘'], createdAt: '2026-11-10T01:00:00Z' },
    { id: 'idea_2', title: '我把待办清单砍掉一半之后', angle: '反效率鸡汤', platform: '小红书', stage: 'idea', tags: ['效率'], createdAt: '2026-11-11T01:00:00Z' },
    { id: 'idea_3', title: '30 天健身记录', angle: '真实数据', platform: '抖音', stage: 'edit', tags: ['健身'], createdAt: '2026-11-09T01:00:00Z' },
  ];
  s.content.posts = [
    {
      id: 'post_1',
      title: '我用一个页面管住了所有事',
      platform: 'B站',
      publishedAt: '2026-11-01',
      url: '',
      note: '评论里有人问模板',
      ideaId: 'idea_1',
      snapshots: [
        { date: '2026-11-02', views: 1200, likes: 80, comments: 12, followers: 30 },
        { date: '2026-11-10', views: 8600, likes: 420, comments: 55, followers: 160 },
      ],
    },
    {
      id: 'post_2',
      title: '效率工具的三个坑',
      platform: '小红书',
      publishedAt: '2026-11-06',
      snapshots: [{ date: '2026-11-09', views: 2300, likes: 190, comments: 21, followers: 60 }],
    },
  ];

  s.dev.projects = [
    { id: 'proj_1', name: '个人工作生活台', repo: 'github.com/me/myapp', stack: 'Node + 原生 JS', status: 'active', color: '#2C6353', note: '' },
    { id: 'proj_2', name: '客户官网', repo: '', stack: 'Vue', status: 'paused', color: '#C07A45', note: '' },
  ];
  s.dev.items = [
    { id: 'item_1', projectId: 'proj_1', title: '登录态丢失', type: 'bug', priority: 'high', status: 'doing', estimateH: 4, spentH: 2, note: '刷新后掉登录', createdAt: '2026-11-10T01:00:00Z' },
    { id: 'item_2', projectId: 'proj_1', title: '首页改成驾驶舱', type: 'feature', priority: 'mid', status: 'todo', estimateH: 8, spentH: 0, note: '', createdAt: '2026-11-11T01:00:00Z' },
    { id: 'item_3', projectId: 'proj_2', title: '移动端适配', type: 'feature', priority: 'low', status: 'done', estimateH: 12, spentH: 10, note: '', createdAt: '2026-11-01T01:00:00Z' },
  ];
  s.dev.logs = [
    { id: 'log_1', projectId: 'proj_1', date: TODAY, hours: 2.5, content: '调登录接口' },
    { id: 'log_2', projectId: 'proj_1', date: '2026-11-10', hours: 3, content: '写首页' },
  ];

  s.consulting.clients = [
    { id: 'cli_1', name: '王总', company: '衡远科技', contact: '微信 wang', stage: 'delivering', tags: ['长期'], note: '决策快，喜欢看数据' },
    { id: 'cli_2', name: '李姐', company: '小满餐饮', contact: '138****', stage: 'talking', tags: ['高客单'], note: '' },
    { id: 'cli_3', name: '老张', company: '', contact: '', stage: 'lost', tags: [], note: '预算不够' },
  ];
  s.consulting.projects = [
    { id: 'cproj_1', clientId: 'cli_1', name: '年度顾问', scope: '每月两次策略会', amount: 60000, startDate: '2026-09-01', endDate: '2026-11-30', status: 'active' },
    { id: 'cproj_2', clientId: 'cli_1', name: '内训', scope: '两天工作坊', amount: 20000, startDate: '2026-10-01', endDate: '2026-10-20', status: 'delivered' },
  ];
  s.consulting.sessions = [
    { id: 'sess_1', clientId: 'cli_1', projectId: 'cproj_1', date: '2026-11-01', minutes: 60, summary: '聊了 Q4 目标', nextStep: '发报价', followUpDate: '2026-11-10', followedUp: false },
    { id: 'sess_2', clientId: 'cli_2', projectId: '', date: '2026-11-08', minutes: 30, summary: '初次沟通', nextStep: '等对方回复', followUpDate: '2026-11-20', followedUp: false },
  ];

  s.fitness.sessions = [
    {
      id: 'work_1',
      date: TODAY,
      focus: '胸',
      durationMin: 60,
      feeling: '状态不错',
      note: '',
      exercises: [
        { id: 'ex_1', name: '卧推', sets: 4, reps: 8, weight: 60 },
        { id: 'ex_2', name: '飞鸟', sets: 3, reps: 12, weight: 12 },
      ],
    },
    { id: 'work_2', date: '2026-11-11', focus: '背', durationMin: 50, feeling: '', note: '', exercises: [{ id: 'ex_3', name: '引体', sets: 4, reps: 6, weight: 0 }] },
    { id: 'work_3', date: '2026-11-09', focus: '腿', durationMin: 55, feeling: '', note: '', exercises: [] },
  ];

  s.diet.days = [
    {
      id: 'diet_1',
      date: TODAY,
      water: 3,
      note: '',
      meals: {
        breakfast: [{ id: 'e1', name: '鸡蛋', qty: '2 × 1 个', kcal: 156, protein: 12.6 }],
        lunch: [{ id: 'e2', name: '米饭', qty: '1 × 150g', kcal: 174, protein: 3.9 }],
        dinner: [],
        snack: [{ id: 'e3', name: '牛奶', qty: '1 × 250ml', kcal: 135, protein: 8 }],
      },
    },
    {
      id: 'diet_2',
      date: '2026-11-11',
      water: 8,
      note: '',
      meals: { breakfast: [], lunch: [{ id: 'e4', name: '牛肉面', qty: '1 份', kcal: 800, protein: 30 }], dinner: [], snack: [] },
    },
    {
      id: 'diet_3',
      date: '2026-11-10',
      water: 6,
      note: '',
      meals: { breakfast: [], lunch: [], dinner: [{ id: 'e5', name: '火锅', qty: '1 顿', kcal: 2600, protein: 90 }], snack: [] },
    },
  ];

  s.games.items = [
    { id: 'game_1', title: '塞尔达传说', platform: 'Switch', status: 'playing', rating: 5, note: '第 40 小时' },
    { id: 'game_2', title: '只狼', platform: 'PC', status: 'dropped', rating: 3, note: '太难了' },
    { id: 'game_3', title: '星露谷物语', platform: 'PC', status: 'backlog', rating: 0, note: '' },
  ];
  s.games.sessions = [
    { id: 'play_1', itemId: 'game_1', date: TODAY, minutes: 90, mood: '放松' },
    { id: 'play_2', itemId: 'game_1', date: '2026-11-10', minutes: 60, mood: '' },
    { id: 'play_3', itemId: 'game_2', date: '2026-11-02', minutes: 120, mood: '上头' },
  ];

  s.meta.dataFile = 'C:/Users/Legion/WorkBuddy/2026-11-12-09-26-18/data/app-data.json';
  return s;
}

export function emptyState() {
  return createInitialState();
}

export function fakeCtx(state) {
  return {
    get state() {
      return state;
    },
    today: TODAY,
    route: 'dashboard',
    navigate() {},
    rerender() {},
    toast() {},
    async saveNow() {},
    async reload() {},
    summary: () => dashboardSummary(state, TODAY),
    update(fn) {
      fn(state);
    },
  };
}

export { uid };
