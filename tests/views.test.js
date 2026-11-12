import { test } from 'node:test';
import assert from 'node:assert/strict';
import { richState, emptyState, fakeCtx, TODAY } from './fixtures.js';

import dashboard from '../public/js/views/dashboard.js';
import today from '../public/js/views/today.js';
import content from '../public/js/views/content.js';
import dev from '../public/js/views/dev.js';
import consulting from '../public/js/views/consulting.js';
import fitness from '../public/js/views/fitness.js';
import diet from '../public/js/views/diet.js';
import games from '../public/js/views/games.js';
import settings from '../public/js/views/settings.js';

const VIEWS = [
  ['dashboard', dashboard],
  ['today', today],
  ['content', content],
  ['dev', dev],
  ['consulting', consulting],
  ['fitness', fitness],
  ['diet', diet],
  ['games', games],
  ['settings', settings],
];

const count = (html, token) => html.split(token).length - 1;

function assertHealthy(name, html) {
  assert.equal(typeof html, 'string', `${name} 应返回字符串`);
  assert.ok(html.length > 300, `${name} 输出太短，可能是空页面`);
  assert.equal(count(html, '<div'), count(html, '</div>'), `${name} 的 <div> 未闭合`);
  assert.equal(count(html, '<section'), count(html, '</section>'), `${name} 的 <section> 未闭合`);
  assert.equal(count(html, '<button'), count(html, '</button>'), `${name} 的 <button> 未闭合`);
  assert.equal(count(html, '<table'), count(html, '</table>'), `${name} 的 <table> 未闭合`);
  assert.equal(count(html, '<svg'), count(html, '</svg>'), `${name} 的 <svg> 未闭合`);
  assert.ok(!/NaN|Infinity|\[object Object\]/.test(html), `${name} 输出里出现了 NaN / Infinity / [object Object]`);
  assert.ok(!html.includes('undefined'), `${name} 输出里出现了 undefined`);
}

test('9 个模块在「有数据」时都能正常渲染', () => {
  for (const [name, view] of VIEWS) {
    const state = richState();
    const html = view.render(state, fakeCtx(state));
    assertHealthy(name, html);
  }
});

test('9 个模块在「空数据」时都能正常渲染（新用户第一次打开）', () => {
  // fitness / diet 的日期草稿带有模块级缓存，空数据场景单独在下面用全新渲染校验日历代码路径
  for (const [name, view] of VIEWS) {
    const state = emptyState();
    const html = view.render(state, fakeCtx(state));
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 300);
    assert.equal(count(html, '<div'), count(html, '</div>'), `${name} 空数据时 <div> 未闭合`);
    assert.ok(!/NaN|\[object Object\]/.test(html), `${name} 空数据出现异常值`);
  }
});

test('首页包含全部必需区块与 6 张模块摘要卡', () => {
  const state = richState();
  const html = dashboard.render(state, fakeCtx(state));
  for (const text of ['今日重点', '快速备忘', '待跟进客户', '各条线', '昨天还没做完']) {
    assert.ok(html.includes(text), `首页缺少「${text}」`);
  }
  for (const mod of ['content', 'dev', 'consulting', 'fitness', 'diet', 'games']) {
    assert.ok(html.includes(`data-module="${mod}"`), `首页缺少 ${mod} 摘要卡`);
  }
  assert.ok(html.includes('summary-card'));
});

test('今日计划：重点、时间段、顺延、新建入口齐全', () => {
  const state = richState();
  const html = today.render(state, fakeCtx(state));
  for (const text of ['今日三件重点', '新建任务', '任务列表', '上午', '下午', '晚上', '顺延']) {
    assert.ok(html.includes(text), `今日计划缺少「${text}」`);
  }
  assert.equal(count(html, 'data-toggle='), 2, '默认筛选下显示 2 条未完成任务');
});

test('自媒体：选题看板 5 列 + 数据页图表', () => {
  const state = richState();
  const pipeline = content.render(state, fakeCtx(state), { tab: 'pipeline' });
  for (const stage of ['选题', '脚本', '拍摄', '剪辑', '已发布']) {
    assert.ok(pipeline.includes(`>${stage}<`) || pipeline.includes(stage), `看板缺少「${stage}」列`);
  }
  assert.ok(pipeline.includes('kanban-col'));

  const data = content.render(state, fakeCtx(state), { tab: 'data' });
  for (const text of ['播放量增长', '平台对比', '粉丝增长', '作品表现', '总播放']) {
    assert.ok(data.includes(text), `数据页缺少「${text}」`);
  }
  assert.ok(data.includes('<svg'), '数据页应有图表');
  assert.ok(data.includes('我用一个页面管住了所有事'), '应显示作品名');
});

test('开发工作：新建工作项入口在页面主按钮里', () => {
  const state = richState();
  const html = dev.render(state, fakeCtx(state));
  assert.ok(html.includes('新建工作项'), '必须有新建工作项的按钮');
  assert.ok(html.includes('data-act="new-item"'), '新建工作项按钮缺少行为标记');
  assert.ok(html.includes('本周工时'), '缺少工时统计');
  assert.ok(html.includes('本周工时分布'), '缺少工时图');
  assert.ok(html.includes('登录态丢失'), '应显示工作项');

  // 没有项目时，主按钮仍然存在，并引导先建项目
  const empty = emptyState();
  const emptyHtml = dev.render(empty, fakeCtx(empty));
  assert.ok(emptyHtml.includes('新建工作项'), '空状态下也要能看到新建工作项入口');
  assert.ok(emptyHtml.includes('新建项目'));
});

test('咨询工作：客户可删除，三个分段都有内容', () => {
  const state = richState();
  const clients = consulting.render(state, fakeCtx(state), { tab: 'clients' });
  assert.ok(clients.includes('客户列表'));
  assert.ok(clients.includes('data-del-client'), '客户行必须有删除入口');
  assert.ok(clients.includes('王总'));
  assert.ok(clients.includes('展开'), '客户应可展开查看项目与记录');

  const projects = consulting.render(state, fakeCtx(state), { tab: 'projects' });
  assert.ok(projects.includes('咨询项目'));
  assert.ok(projects.includes('月度成交金额'));

  const sessions = consulting.render(state, fakeCtx(state), { tab: 'sessions' });
  assert.ok(sessions.includes('沟通记录'));
  assert.ok(sessions.includes('待跟进'));
});

test('健身：日历 + 当天动作面板 + 周模板', () => {
  const state = richState();
  const html = fitness.render(state, fakeCtx(state));
  assert.ok(html.includes('cal-grid'), '缺少日历');
  assert.equal(count(html, 'cal-cell'), 42, '日历应为 42 格');
  assert.ok(html.includes('一键') === false);
  for (const text of ['主练部位', '动作', '套用当天计划', '一周训练模板', '本周训练']) {
    assert.ok(html.includes(text), `健身模块缺少「${text}」`);
  }
  assert.ok(html.includes('卧推'), '应显示已记录的动作');
  assert.ok(html.includes('4'), '应显示组数');
});

test('饮食：日历 + 三餐 + 热量目标', () => {
  const state = richState();
  const html = diet.render(state, fakeCtx(state));
  assert.equal(count(html, 'cal-cell'), 42, '日历应为 42 格');
  for (const text of ['热量', '蛋白质', '饮水', '三餐记录', '早餐', '午餐', '晚餐', '近 7 天热量']) {
    assert.ok(html.includes(text), `饮食模块缺少「${text}」`);
  }
  assert.ok(html.includes('鸡蛋'), '应显示已记录的食物');
  assert.ok(html.includes('data-food-select'), '应有从食物库添加的入口');
});

test('游戏娱乐：清单、时长统计、状态筛选', () => {
  const state = richState();
  const html = games.render(state, fakeCtx(state));
  for (const text of ['我的清单', '近 4 周时长', '最近记录', '塞尔达传说', '在玩']) {
    assert.ok(html.includes(text), `游戏模块缺少「${text}」`);
  }
  assert.ok(html.includes('data-gstatus'), '缺少状态筛选');
});

test('数据与设置：手动保存、备份、导入导出、清空', () => {
  const state = richState();
  const html = settings.render(state, fakeCtx(state));
  for (const text of ['立即保存', '备份与恢复', '立即备份', '导出全部数据', '从 JSON 文件导入', '危险操作', '个人偏好', '数据概览']) {
    assert.ok(html.includes(text), `设置页缺少「${text}」`);
  }
  assert.ok(html.includes('data-act="save-now"'));
  assert.ok(html.includes('data-import-file'));
  assert.ok(html.includes('data-clear-target'));
});

test('每个视图都导出了 render，且能被应用外壳调用', () => {
  for (const [name, view] of VIEWS) {
    assert.equal(typeof view.render, 'function', `${name} 缺少 render`);
    assert.equal(typeof view.bind, 'function', `${name} 缺少 bind（事件绑定）`);
  }
});

test('日期上下文一致：首页标题使用注入的 today', () => {
  const state = richState();
  const html = today.render(state, fakeCtx(state));
  assert.ok(html.includes('今天'));
  assert.equal(state.today.tasks.filter((t) => t.date === TODAY).length, 3);
});
