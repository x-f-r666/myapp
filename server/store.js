/**
 * 本地数据仓库：单文件 JSON + 原子写入 + 每日自动备份。
 * 设计原则：宁可启动失败也不静默丢用户数据。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState, normalizeState, validateState, SCHEMA_VERSION } from '../public/js/core/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

export class StoreError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.details = details;
  }
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds()
  )}`;
}

function dayStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MAX_AUTO_BACKUPS = 30;

export class Store {
  constructor({ dataDir, now = () => new Date() } = {}) {
    this.dataDir = dataDir || process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data');
    this.backupDir = path.join(this.dataDir, 'backups');
    this.stateFile = path.join(this.dataDir, 'app-data.json');
    this.revision = 0;
    this.now = now;
  }

  async ensureDirs() {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  async exists() {
    try {
      await fs.access(this.stateFile);
      return true;
    } catch {
      return false;
    }
  }

  /** 读取状态；文件不存在则创建；文件损坏则改名保留并重建，绝不静默覆盖 */
  async load() {
    await this.ensureDirs();
    if (!(await this.exists())) {
      const fresh = createInitialState();
      await this.writeAtomic(fresh);
      this.revision = 1;
      return { state: fresh, savedAt: this.now().toISOString(), size: await this.size(), created: true };
    }

    let text;
    try {
      text = await fs.readFile(this.stateFile, 'utf8');
    } catch (err) {
      throw new StoreError(`读取数据文件失败：${err.message}`, 500);
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      const keep = `${this.stateFile}.corrupt-${stamp(this.now())}`;
      await fs.rename(this.stateFile, keep);
      const fresh = createInitialState();
      await this.writeAtomic(fresh);
      this.revision = 1;
      return {
        state: fresh,
        savedAt: this.now().toISOString(),
        size: await this.size(),
        recovered: true,
        corruptFile: path.basename(keep),
      };
    }

    const state = normalizeState(raw);
    this.revision += 1;
    return { state, savedAt: state.meta?.updatedAt || this.now().toISOString(), size: Buffer.byteLength(text) };
  }

  async size() {
    try {
      const st = await fs.stat(this.stateFile);
      return st.size;
    } catch {
      return 0;
    }
  }

  async writeAtomic(state) {
    const payload = `${JSON.stringify(state, null, 2)}\n`;
    const tmp = `${this.stateFile}.tmp`;
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(payload, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.stateFile);
    return Buffer.byteLength(payload);
  }

  /** 保存（带结构校验 + 每日自动备份） */
  async save(input) {
    const errors = validateState(input);
    if (errors.length) throw new StoreError('数据校验未通过', 400, errors);

    const state = normalizeState(input);
    state.version = SCHEMA_VERSION;
    state.meta = { ...state.meta, updatedAt: this.now().toISOString() };

    const size = await this.writeAtomic(state);
    this.revision += 1;
    const autoBackup = await this.ensureDailyBackup(state);

    return {
      savedAt: state.meta.updatedAt,
      size,
      revision: this.revision,
      autoBackup,
    };
  }

  /** 每天第一份数据留一个快照，最多保留 30 天 */
  async ensureDailyBackup(state) {
    const name = `auto-${dayStamp(this.now())}.json`;
    const file = path.join(this.backupDir, name);
    try {
      await fs.access(file);
      return null;
    } catch {
      /* 继续创建 */
    }
    await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await this.pruneAutoBackups();
    return name;
  }

  async pruneAutoBackups() {
    const files = (await fs.readdir(this.backupDir)).filter((f) => f.startsWith('auto-') && f.endsWith('.json'));
    if (files.length <= MAX_AUTO_BACKUPS) return;
    files.sort();
    const remove = files.slice(0, files.length - MAX_AUTO_BACKUPS);
    for (const f of remove) {
      await fs.unlink(path.join(this.backupDir, f)).catch(() => {});
    }
  }

  /** 手动备份：优先使用调用方传入的当前内存状态，避免备份到磁盘上的旧版本 */
  async backup(label = 'manual', stateOverride = null) {
    await this.ensureDirs();
    let state = stateOverride;
    if (state) {
      const errors = validateState(state);
      if (errors.length) throw new StoreError('数据校验未通过', 400, errors);
      state = normalizeState(state);
    } else {
      ({ state } = await this.load());
    }
    const safeLabel = String(label).replace(/[^a-z0-9_-]/gi, '').slice(0, 12) || 'manual';
    const name = `${safeLabel}-${stamp(this.now())}.json`;
    const file = path.join(this.backupDir, name);
    await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    const st = await fs.stat(file);
    return { name, size: st.size, mtime: st.mtime.toISOString() };
  }

  /** 备份列表（新的在前） */
  async listBackups() {
    await this.ensureDirs();
    const names = (await fs.readdir(this.backupDir)).filter((f) => f.endsWith('.json'));
    const out = [];
    for (const name of names) {
      const st = await fs.stat(path.join(this.backupDir, name)).catch(() => null);
      if (!st) continue;
      out.push({
        name,
        size: st.size,
        mtime: st.mtime.toISOString(),
        kind: name.startsWith('auto-') ? 'auto' : name.startsWith('pre-restore-') ? 'pre-restore' : 'manual',
      });
    }
    out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    return out;
  }

  resolveBackupName(name) {
    const base = path.basename(String(name || ''));
    if (!/^[A-Za-z0-9._-]+\.json$/.test(base) || base.includes('..')) {
      throw new StoreError('备份文件名不合法', 400);
    }
    const file = path.join(this.backupDir, base);
    if (path.dirname(file) !== this.backupDir) throw new StoreError('备份文件名不合法', 400);
    return { base, file };
  }

  /** 从备份恢复：先给当前数据留快照，再覆盖 */
  async restore(name) {
    const { base, file } = this.resolveBackupName(name);
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      throw new StoreError('备份文件不存在', 404);
    }
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new StoreError('备份文件不是合法 JSON', 400);
    }
    const errors = validateState(raw);
    if (errors.length) throw new StoreError('备份文件结构不合法', 400, errors);

    const preRestore = await this.backup('pre-restore');
    const state = normalizeState(raw);
    const result = await this.save(state);
    return { ...result, restoredFrom: base, preRestore: preRestore.name };
  }

  async exportPath() {
    if (!(await this.exists())) await this.load();
    return this.stateFile;
  }
}

export const paths = { PROJECT_ROOT };
