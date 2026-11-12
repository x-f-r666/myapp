/**
 * 本地服务：只监听 127.0.0.1，提供静态页面与数据 API。
 * 没有任何第三方依赖，`node server/index.js` 即可运行。
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Store, StoreError } from './store.js';
import { APP_NAME, SCHEMA_VERSION } from '../public/js/core/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, data) {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new StoreError('请求内容过大（上限 8MB）', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new StoreError('请求体不是合法 JSON', 400));
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(req, res, urlPath) {
  let relative = decodeURIComponent(urlPath.split('?')[0]);
  if (relative === '/' || relative === '') relative = '/index.html';
  const target = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    sendJson(res, 403, { error: '禁止访问该路径' });
    return;
  }
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    sendJson(res, 404, { error: '文件不存在', path: relative });
    return;
  }
  if (stat.isDirectory()) {
    sendJson(res, 404, { error: '文件不存在', path: relative });
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const data = await fs.readFile(target);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

export function createApp({ dataDir } = {}) {
  const store = new Store({ dataDir });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { pathname } = url;

    try {
      // ---- API ----
      if (pathname === '/api/health') {
        sendJson(res, 200, { ok: true, app: APP_NAME, version: SCHEMA_VERSION, pid: process.pid });
        return;
      }

      if (pathname === '/api/meta') {
        sendJson(res, 200, {
          app: APP_NAME,
          schemaVersion: SCHEMA_VERSION,
          dataFile: store.stateFile,
          backupDir: store.backupDir,
          node: process.version,
        });
        return;
      }

      if (pathname === '/api/state' && req.method === 'GET') {
        const loaded = await store.load();
        sendJson(res, 200, {
          ...loaded,
          revision: store.revision,
          dataFile: store.stateFile,
          backupDir: store.backupDir,
        });
        return;
      }

      if ((pathname === '/api/state' && req.method === 'PUT') || (pathname === '/api/save' && req.method === 'POST')) {
        const body = await readBody(req);
        const state = body && body.state ? body.state : body;
        if (!state || typeof state !== 'object') throw new StoreError('缺少 state 数据', 400);
        const result = await store.save(state);
        sendJson(res, 200, { ok: true, ...result, dataFile: store.stateFile });
        return;
      }

      if (pathname === '/api/backup' && req.method === 'POST') {
        const body = await readBody(req);
        const info = await store.backup('manual', body && body.state ? body.state : null);
        sendJson(res, 200, { ok: true, ...info });
        return;
      }

      if (pathname === '/api/backups' && req.method === 'GET') {
        const backups = await store.listBackups();
        sendJson(res, 200, { backups, backupDir: store.backupDir });
        return;
      }

      if (pathname === '/api/restore' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body || !body.name) throw new StoreError('缺少备份文件名', 400);
        const result = await store.restore(body.name);
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (pathname === '/api/export' && req.method === 'GET') {
        const file = await store.exportPath();
        const data = await fs.readFile(file, 'utf8');
        const name = `app-data-${new Date().toISOString().slice(0, 10)}.json`;
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Content-Length': Buffer.byteLength(data),
          'Cache-Control': 'no-store',
        });
        res.end(data);
        return;
      }

      if (pathname === '/api/import' && req.method === 'POST') {
        const body = await readBody(req);
        const state = body && body.state ? body.state : body;
        if (!state || typeof state !== 'object') throw new StoreError('缺少 state 数据', 400);
        const result = await store.save(state);
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: '接口不存在', path: pathname });
        return;
      }

      // ---- 静态资源 ----
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: '方法不支持' });
        return;
      }
      await serveStatic(req, res, pathname);
    } catch (err) {
      const status = err instanceof StoreError ? err.status : 500;
      if (status >= 500) console.error('[server]', err);
      sendJson(res, status, {
        error: err.message || '服务器内部错误',
        details: err.details || undefined,
      });
    }
  });

  server.store = store;
  return server;
}

/** 启动后自动打开浏览器（仅当 start.bat / start.sh 设置了 OPEN_BROWSER=1） */
function openBrowser(url) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* 打不开浏览器不影响服务，用户手动访问即可 */
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  const server = createApp();
  server.listen(port, host, () => {
    const line = `  ${APP_NAME} 已启动 →  http://${host}:${port}`;
    console.log(`\n${line}`);
    console.log(`  数据文件：${server.store.stateFile}`);
    console.log('  关闭此窗口或按 Ctrl+C 即可停止服务\n');
    if (process.env.OPEN_BROWSER === '1') setTimeout(() => openBrowser(`http://${host}:${port}`), 600);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n端口 ${port} 已被占用。可以换一个端口启动，例如：\n  PORT=4174 npm start\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      console.log('\n正在关闭服务…');
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1500).unref();
    });
  }
}
