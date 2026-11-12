/** 视图共用的小动作：把工作项/跟进推到今日计划、任务勾选等。 */
import { MODULES, uid } from '../core/model.js';
import { todayISO } from '../core/dates.js';

export function moduleLabel(key) {
  return (MODULES.find((m) => m.key === key) || {}).label || '';
}

export function todayTasks(state) {
  return state.today.tasks.filter((t) => t.date === todayISO());
}

/**
 * 把一条外部事项加到今日计划；同一来源当天只加一次，避免重复。
 * @returns {{task: object, created: boolean}}
 */
export function addToToday(state, { title, module = 'today', refId = '', priority = 'mid', slot = 'morning', note = '' }) {
  const day = todayISO();
  const dup = state.today.tasks.find((t) => t.date === day && t.refId === refId && t.refId && t.module === module);
  if (dup) return { task: dup, created: false };
  const task = {
    id: uid('task'),
    title,
    note,
    module,
    refId,
    priority,
    slot,
    done: false,
    date: day,
    createdAt: new Date().toISOString(),
  };
  state.today.tasks.push(task);
  return { task, created: true };
}

export function toggleTask(state, id) {
  const task = state.today.tasks.find((t) => t.id === id);
  if (!task) return null;
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  if (task.done && state.today.focus.includes(task.id)) {
    // 完成的任务保留在重点里，方便看到今天做成了什么
  }
  return task;
}

export function removeTask(state, id) {
  state.today.tasks = state.today.tasks.filter((t) => t.id !== id);
  state.today.focus = state.today.focus.filter((f) => f !== id);
}

export function toggleFocus(state, id) {
  const inFocus = state.today.focus.includes(id);
  if (inFocus) {
    state.today.focus = state.today.focus.filter((f) => f !== id);
    return false;
  }
  if (state.today.focus.length >= 3) return null;
  state.today.focus.push(id);
  return true;
}

/** 升序列表里找某天的记录 */
export function findByDate(list, iso) {
  return (list || []).find((x) => x.date === iso) || null;
}

/** 安全转数字 */
export function n(v, fallback = 0) {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

/** 按钮里显示「已加入」状态用的小工具 */
export function isInToday(state, refId, module) {
  return state.today.tasks.some((t) => t.date === todayISO() && t.refId === refId && t.module === module);
}
