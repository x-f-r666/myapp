/**
 * 数据模型：整个 App 的唯一数据结构定义。
 * 同时被浏览器（public/js）与 Node 测试/服务端 import，保证规则只有一份。
 */

export const SCHEMA_VERSION = 1;

export const APP_NAME = '个人工作生活台';

/** 模块键与中文名，导航与首页摘要共用 */
export const MODULES = [
  { key: 'dashboard', label: '首页总览', icon: 'home', desc: '今天该做什么，各条线进展如何' },
  { key: 'today', label: '今日计划', icon: 'check', desc: '今天这一天：重点、任务、备忘' },
  { key: 'content', label: '自媒体', icon: 'video', desc: '选题管线与发布后的数据表现' },
  { key: 'dev', label: '开发工作', icon: 'code', desc: '项目、工作项与工时' },
  { key: 'consulting', label: '咨询工作', icon: 'briefcase', desc: '客户、项目、沟通与跟进' },
  { key: 'fitness', label: '健身计划', icon: 'dumbbell', desc: '日历里的部位、动作、组数与次数' },
  { key: 'diet', label: '饮食计划', icon: 'bowl', desc: '日历里的三餐、热量与蛋白质' },
  { key: 'games', label: '游戏娱乐', icon: 'game', desc: '玩什么、玩多久、值不值' },
  { key: 'settings', label: '数据与设置', icon: 'settings', desc: '保存、备份、恢复与个人偏好' },
];

export const CONTENT_STAGES = [
  { key: 'idea', label: '选题' },
  { key: 'script', label: '脚本' },
  { key: 'shoot', label: '拍摄' },
  { key: 'edit', label: '剪辑' },
  { key: 'published', label: '已发布' },
];

export const PLATFORMS = ['抖音', 'B站', '小红书', '视频号', '公众号'];

export const DEV_TYPES = [
  { key: 'feature', label: '功能' },
  { key: 'bug', label: '缺陷' },
  { key: 'refactor', label: '重构' },
  { key: 'chore', label: '杂务' },
];

export const DEV_STATUS = [
  { key: 'todo', label: '待办' },
  { key: 'doing', label: '进行中' },
  { key: 'done', label: '已完成' },
];

export const CLIENT_STAGES = [
  { key: 'lead', label: '线索' },
  { key: 'talking', label: '沟通中' },
  { key: 'signed', label: '已签约' },
  { key: 'delivering', label: '交付中' },
  { key: 'done', label: '已结束' },
  { key: 'lost', label: '已流失' },
];

export const WORK_STATUS = [
  { key: 'planning', label: '筹备' },
  { key: 'active', label: '进行中' },
  { key: 'delivered', label: '已交付' },
  { key: 'closed', label: '已结项' },
];

export const GAME_STATUS = [
  { key: 'playing', label: '在玩' },
  { key: 'backlog', label: '想玩' },
  { key: 'done', label: '已通关' },
  { key: 'dropped', label: '弃坑' },
];

export const PRIORITIES = [
  { key: 'high', label: '高' },
  { key: 'mid', label: '中' },
  { key: 'low', label: '低' },
];

export const SLOTS = [
  { key: 'morning', label: '上午' },
  { key: 'afternoon', label: '下午' },
  { key: 'evening', label: '晚上' },
];

export const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
];

export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 默认一周训练模板：0=周日 */
export const DEFAULT_WEEKDAY_PLAN = {
  0: '休息',
  1: '胸',
  2: '背',
  3: '有氧',
  4: '腿',
  5: '肩臂',
  6: '核心',
};

export const DEFAULT_FOODS = [
  { id: 'food_rice', name: '米饭', unit: '150g', kcal: 174, protein: 3.9 },
  { id: 'food_egg', name: '鸡蛋', unit: '1 个', kcal: 78, protein: 6.3 },
  { id: 'food_chicken', name: '鸡胸肉', unit: '100g', kcal: 133, protein: 24 },
  { id: 'food_milk', name: '牛奶', unit: '250ml', kcal: 135, protein: 8 },
  { id: 'food_bread', name: '全麦面包', unit: '1 片', kcal: 90, protein: 4 },
  { id: 'food_apple', name: '苹果', unit: '1 个', kcal: 95, protein: 0.5 },
  { id: 'food_broccoli', name: '西兰花', unit: '100g', kcal: 34, protein: 2.8 },
  { id: 'food_beef', name: '牛肉', unit: '100g', kcal: 125, protein: 20 },
  { id: 'food_tofu', name: '豆腐', unit: '100g', kcal: 82, protein: 8 },
  { id: 'food_oats', name: '燕麦', unit: '40g', kcal: 150, protein: 5 },
];

/** 生成短 id：可读前缀 + 时间戳 + 随机串 */
export function uid(prefix = 'id') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${t}${r}`;
}

function isoDay(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 全新初始数据（不塞假数据，避免用户第一眼看到别人的内容） */
export function createInitialState() {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    meta: {
      createdAt: now,
      updatedAt: now,
      appName: APP_NAME,
    },
    settings: {
      nickname: '',
      fitnessWeeklyGoal: 4,
      calorieTarget: 2200,
      proteinTarget: 130,
      waterTarget: 8,
      contentPlatformDefault: '抖音',
    },
    today: {
      tasks: [],
      memos: [],
      focus: [],
    },
    content: {
      ideas: [],
      posts: [],
      platforms: [...PLATFORMS],
    },
    dev: {
      projects: [],
      items: [],
      logs: [],
    },
    consulting: {
      clients: [],
      projects: [],
      sessions: [],
    },
    fitness: {
      weekdayPlan: { ...DEFAULT_WEEKDAY_PLAN },
      sessions: [],
    },
    diet: {
      foods: DEFAULT_FOODS.map((f) => ({ ...f })),
      days: [],
    },
    games: {
      items: [],
      sessions: [],
    },
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 把任意输入补齐成合法结构：缺字段用默认值，数组类型不对则回落为空数组。
 * 这样即使数据文件被手工改坏一部分，应用仍能启动。
 */
export function normalizeState(raw) {
  const base = createInitialState();
  if (!isPlainObject(raw)) return base;

  const merge = (baseVal, givenVal) => {
    if (Array.isArray(baseVal)) {
      if (!Array.isArray(givenVal)) return [...baseVal];
      // 实体数组里是对象，字符串数组（重点 id、平台、标签）必须原样保留
      return givenVal
        .filter((v) => v !== null && v !== undefined)
        .map((v) => (isPlainObject(v) ? { ...v } : v));
    }
    if (isPlainObject(baseVal)) {
      const out = {};
      const keys = new Set([...Object.keys(baseVal), ...(isPlainObject(givenVal) ? Object.keys(givenVal) : [])]);
      for (const k of keys) {
        out[k] = merge(baseVal[k] === undefined ? null : baseVal[k], givenVal ? givenVal[k] : undefined);
      }
      return out;
    }
    if (baseVal === null) return givenVal === undefined ? null : givenVal;
    if (givenVal === undefined || givenVal === null) return baseVal;
    return givenVal;
  };

  const merged = merge(base, raw);
  merged.version = SCHEMA_VERSION;
  merged.meta = { ...base.meta, ...(isPlainObject(raw.meta) ? raw.meta : {}) };
  merged.meta.appName = APP_NAME;
  merged.today.focus = Array.isArray(merged.today.focus) ? merged.today.focus.slice(0, 3) : [];

  // 平台列表至少保留默认值
  if (!Array.isArray(merged.content.platforms) || merged.content.platforms.length === 0) {
    merged.content.platforms = [...PLATFORMS];
  }
  // 食物库为空时补回默认，避免饮食模块无法快速添加
  if (!Array.isArray(merged.diet.foods) || merged.diet.foods.length === 0) {
    merged.diet.foods = DEFAULT_FOODS.map((f) => ({ ...f }));
  }
  return merged;
}

const REQUIRED_ARRAYS = [
  ['today', 'tasks'],
  ['today', 'memos'],
  ['content', 'ideas'],
  ['content', 'posts'],
  ['dev', 'projects'],
  ['dev', 'items'],
  ['dev', 'logs'],
  ['consulting', 'clients'],
  ['consulting', 'projects'],
  ['consulting', 'sessions'],
  ['fitness', 'sessions'],
  ['diet', 'days'],
  ['games', 'items'],
  ['games', 'sessions'],
];

/** 导入前的结构校验，返回错误信息数组（空数组=通过） */
export function validateState(raw) {
  const errors = [];
  if (!isPlainObject(raw)) {
    return ['数据必须是一个 JSON 对象'];
  }
  if (raw.version !== undefined && typeof raw.version !== 'number') {
    errors.push('version 必须是数字');
  }
  for (const [mod, key] of REQUIRED_ARRAYS) {
    const bucket = raw[mod];
    if (!isPlainObject(bucket)) {
      errors.push(`缺少模块 ${mod}`);
      continue;
    }
    if (!Array.isArray(bucket[key])) {
      errors.push(`${mod}.${key} 必须是数组`);
      continue;
    }
    bucket[key].forEach((item, i) => {
      if (!isPlainObject(item)) errors.push(`${mod}.${key}[${i}] 必须是对象`);
      else if (typeof item.id !== 'string' || item.id.length === 0) {
        errors.push(`${mod}.${key}[${i}] 缺少 id`);
      }
    });
  }
  if (raw.fitness && !isPlainObject(raw.fitness.weekdayPlan)) {
    errors.push('fitness.weekdayPlan 必须是对象');
  }
  if (raw.diet && !Array.isArray(raw.diet.foods)) {
    errors.push('diet.foods 必须是数组');
  }
  if (raw.settings && !isPlainObject(raw.settings)) {
    errors.push('settings 必须是对象');
  }
  return errors;
}

/** 今天的日期字符串 YYYY-MM-DD（本地时区，不用 UTC，避免早上 8 点前记到昨天） */
export function todayISO(date = new Date()) {
  return isoDay(date);
}

/** 某模块条目数量，设置页统计用 */
export function moduleCounts(state) {
  return {
    tasks: state.today.tasks.length,
    memos: state.today.memos.length,
    ideas: state.content.ideas.length,
    posts: state.content.posts.length,
    projects: state.dev.projects.length,
    devItems: state.dev.items.length,
    logs: state.dev.logs.length,
    clients: state.consulting.clients.length,
    consultProjects: state.consulting.projects.length,
    sessions: state.consulting.sessions.length,
    workouts: state.fitness.sessions.length,
    dietDays: state.diet.days.length,
    games: state.games.items.length,
    playSessions: state.games.sessions.length,
  };
}
