import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/index.js';
import { Store } from '../server/store.js';

let server;
let base;
let dataDir;

async function boot(dir) {
  return new Promise((resolve) => {
    const s = createApp({ dataDir: dir });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'myapp-test-'));
  server = await boot(dataDir);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(dataDir, { recursive: true, force: true });
});

const api = async (p, opts = {}) => {
  const res = await fetch(`${base}${p}`, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON（导出文件/静态资源） */
  }
  return { status: res.status, json, text, headers: res.headers };
};

test('GET /api/state 首次访问自动创建数据文件，9 个模块齐全', async () => {
  const res = await api('/api/state');
  assert.equal(res.status, 200);
  const { state } = res.json;
  for (const key of ['today', 'content', 'dev', 'consulting', 'fitness', 'diet', 'games', 'settings', 'meta']) {
    assert.ok(state[key], `缺少 ${key}`);
  }
  assert.equal(state.content.ideas.length, 0);
  assert.ok(Array.isArray(state.fitness.weekdayPlan ? Object.keys(state.fitness.weekdayPlan) : null));
  const file = path.join(dataDir, 'app-data.json');
  const stat = await fs.stat(file);
  assert.ok(stat.size > 100);
  assert.ok(res.json.dataFile.endsWith('app-data.json'));
});

test('PUT /api/state 落盘，新 Store 实例可读回（模拟重启）', async () => {
  const { json } = await api('/api/state');
  const state = json.state;
  state.today.memos.push({ id: 'memo_test1', text: '重启也存在的备忘', createdAt: new Date().toISOString() });
  const saved = await api('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.ok, true);
  assert.equal(saved.json.autoBackup, `auto-${new Date().toISOString().slice(0, 10)}.json`);

  const fresh = new Store({ dataDir });
  const reloaded = await fresh.load();
  assert.equal(reloaded.state.today.memos.length, 1);
  assert.equal(reloaded.state.today.memos[0].text, '重启也存在的备忘');
});

test('保存后不残留 .tmp 文件（原子写入）', async () => {
  const files = await fs.readdir(dataDir);
  assert.ok(!files.some((f) => f.endsWith('.tmp')), `残留临时文件: ${files.join(',')}`);
});

test('POST /api/backup 生成备份并出现在列表中', async () => {
  const res = await api('/api/backup', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(res.status, 200);
  assert.match(res.json.name, /^manual-\d{8}-\d{6}\.json$/);
  const list = await api('/api/backups');
  assert.equal(list.status, 200);
  assert.ok(list.json.backups.some((b) => b.name === res.json.name));
  assert.equal(list.json.backups.find((b) => b.name === res.json.name).kind, 'manual');
});

test('每日自动备份同一天只生成一次', async () => {
  const name = `auto-${new Date().toISOString().slice(0, 10)}.json`;
  const list1 = await api('/api/backups');
  const count1 = list1.json.backups.filter((b) => b.name === name).length;
  assert.equal(count1, 1);
  const { json } = await api('/api/state');
  await api('/api/save', { method: 'POST', body: JSON.stringify({ state: json.state }) });
  const list2 = await api('/api/backups');
  assert.equal(list2.json.backups.filter((b) => b.name === name).length, 1);
});

test('恢复备份：数据回退且生成 pre-restore 快照', async () => {
  const backup = await api('/api/backup', { method: 'POST', body: JSON.stringify({}) });
  const { json } = await api('/api/state');
  json.state.today.memos.push({ id: 'memo_after', text: '备份之后加的', createdAt: new Date().toISOString() });
  await api('/api/save', { method: 'POST', body: JSON.stringify({ state: json.state }) });
  const after = await api('/api/state');
  assert.equal(after.json.state.today.memos.length, 2);

  const restored = await api('/api/restore', { method: 'POST', body: JSON.stringify({ name: backup.json.name }) });
  assert.equal(restored.status, 200);
  assert.match(restored.json.preRestore, /^pre-restore-/);

  const now = await api('/api/state');
  assert.equal(now.json.state.today.memos.length, 1);
  const list = await api('/api/backups');
  assert.ok(list.json.backups.some((b) => b.kind === 'pre-restore'));
});

test('导入非法数据被拒绝且不覆盖原文件', async () => {
  const before = await fs.readFile(path.join(dataDir, 'app-data.json'), 'utf8');
  for (const bad of [{}, { today: {} }, { today: { tasks: 'oops' } }]) {
    const res = await api('/api/import', { method: 'POST', body: JSON.stringify({ state: bad }) });
    assert.equal(res.status, 400, `应拒绝: ${JSON.stringify(bad)}`);
    assert.ok(res.json.error);
  }
  const after = await fs.readFile(path.join(dataDir, 'app-data.json'), 'utf8');
  assert.equal(after, before);
});

test('备份文件名不能穿越目录', async () => {
  for (const name of ['../package.json', '..%2Fpackage.json', '/etc/passwd', 'app-data.json.bak']) {
    const res = await api('/api/restore', { method: 'POST', body: JSON.stringify({ name }) });
    assert.ok(res.status === 400 || res.status === 404, `应拒绝: ${name} -> ${res.status}`);
  }
});

test('静态资源：首页 HTML、脚本 JS、未知路径 404', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  const html = await home.text();
  assert.match(html, /<div id="app"/);

  const js = await fetch(`${base}/js/core/model.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);

  const missing = await api('/nope.html');
  assert.equal(missing.status, 404);

  const traversal = await fetch(`${base}/..%2Fpackage.json`);
  assert.ok([403, 404].includes(traversal.status));
});

test('导出接口返回可解析的 JSON 附件', async () => {
  const res = await fetch(`${base}/api/export`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="app-data-\d{4}-\d{2}-\d{2}\.json"/);
  const data = JSON.parse(await res.text());
  assert.equal(data.version, 1);
});

test('损坏的数据文件不会静默丢失：改名保留并重建', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'myapp-corrupt-'));
  await fs.writeFile(path.join(dir, 'app-data.json'), '{ 这不是 JSON', 'utf8');
  const store = new Store({ dataDir: dir });
  const res = await store.load();
  assert.equal(res.recovered, true);
  assert.ok(res.corruptFile.startsWith('app-data.json.corrupt-'));
  const files = await fs.readdir(dir);
  assert.ok(files.some((f) => f.startsWith('app-data.json.corrupt-')));
  await fs.rm(dir, { recursive: true, force: true });
});
