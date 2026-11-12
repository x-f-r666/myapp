import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES } from '../public/js/core/model.js';
import { richState, fakeCtx } from './fixtures.js';
import dashboard from '../public/js/views/dashboard.js';
import today from '../public/js/views/today.js';
import content from '../public/js/views/content.js';
import dev from '../public/js/views/dev.js';
import consulting from '../public/js/views/consulting.js';
import fitness from '../public/js/views/fitness.js';
import diet from '../public/js/views/diet.js';
import games from '../public/js/views/games.js';
import settings from '../public/js/views/settings.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('所有 JS 文件语法正确（含 server / 前端模块）', () => {
  const files = [...walk(path.join(ROOT, 'public')), ...walk(path.join(ROOT, 'server'))];
  assert.ok(files.length >= 15, `文件数量异常：${files.length}`);
  for (const file of files) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      assert.fail(`语法错误：${path.relative(ROOT, file)}\n${err.stderr?.toString() || err.message}`);
    }
  }
});

test('index.html 引用的资源真实存在', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  for (const ref of ['/styles/app.css', '/js/app.js']) {
    const target = path.join(ROOT, 'public', ref.replace(/^\//, ''));
    assert.ok(fs.existsSync(target), `缺少资源 ${ref}`);
    assert.ok(html.includes(ref), `index.html 没有引用 ${ref}`);
  }
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<div id="app"/);
  assert.match(html, /<div id="modal-root"/);
  assert.match(html, /<div id="toast-root"/);
});

test('导航模块为 9 个且 key 唯一', () => {
  assert.equal(MODULES.length, 9);
  assert.equal(new Set(MODULES.map((m) => m.key)).size, 9);
  const keys = MODULES.map((m) => m.key);
  for (const k of ['dashboard', 'today', 'content', 'dev', 'consulting', 'fitness', 'diet', 'games', 'settings']) {
    assert.ok(keys.includes(k), `缺少模块 ${k}`);
  }
});

test('页面里所有跳转目标都是合法模块', () => {
  const state = richState();
  const ctx = fakeCtx(state);
  const views = [dashboard, today, content, dev, consulting, fitness, diet, games, settings];
  const keys = new Set(MODULES.map((m) => m.key));
  for (const view of views) {
    const html = view.render(state, ctx);
    for (const m of html.matchAll(/data-go="([a-z-]+)"/g)) {
      assert.ok(keys.has(m[1]), `无效跳转目标：data-go="${m[1]}"`);
    }
  }
});

test('完全离线：不引用外部字体 / CDN / 远程脚本', () => {
  const files = [...walk(path.join(ROOT, 'public'))];
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'styles', 'app.css'), 'utf8');
  const all = [html, css, ...files.map((f) => fs.readFileSync(f, 'utf8'))].join('\n');
  for (const bad of ['fonts.googleapis', 'fonts.gstatic', 'cdn.jsdelivr', 'unpkg.com', 'cdnjs.cloudflare', '<script src="http']) {
    assert.ok(!all.includes(bad), `发现外部依赖：${bad}`);
  }
  assert.ok(!/@import\s+url\(\s*["']?https?:/.test(all), 'CSS 不应远程 import');
});

test('CSS 设计系统关键令牌与组件齐全', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'styles', 'app.css'), 'utf8');
  for (const token of ['--accent', '--line', '--ink', '--sidebar', '--radius-lg']) {
    assert.ok(css.includes(token), `缺少 CSS 变量 ${token}`);
  }
  for (const cls of ['.shell', '.sidebar', '.topbar', '.card', '.btn-primary', '.cal-grid', '.modal', '.toast', '.kanban', '.table']) {
    assert.ok(css.includes(cls), `缺少样式 ${cls}`);
  }
});

test('package.json 脚本与引擎配置正确', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'myapp');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.start, 'node server/index.js');
  assert.equal(pkg.scripts.test, 'node --test');
  assert.ok(pkg.engines.node.includes('20'));
  assert.equal(pkg.dependencies, undefined, '不应有运行时依赖');
});

test('data 目录与临时文件被 git 忽略', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  for (const rule of ['data/', 'node_modules/', '*.log']) {
    assert.ok(ignore.includes(rule), `.gitignore 缺少 ${rule}`);
  }
});

test('启动脚本存在且指向服务入口', () => {
  const bat = fs.readFileSync(path.join(ROOT, 'start.bat'), 'utf8');
  const sh = fs.readFileSync(path.join(ROOT, 'start.sh'), 'utf8');
  assert.ok(bat.includes('node server/index.js'));
  assert.ok(bat.includes('OPEN_BROWSER=1'));
  assert.ok(sh.includes('node server/index.js'));
  assert.ok(sh.includes('OPEN_BROWSER=1'));
});
