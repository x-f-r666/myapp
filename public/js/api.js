/** 与本地服务通信。所有错误都抛成带中文提示的 Error。 */

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error('连不上本地服务，请确认启动窗口还开着');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error || `请求失败（${res.status}）`;
    const extra = Array.isArray(data?.details) && data.details.length ? `：${data.details.slice(0, 3).join('；')}` : '';
    const error = new Error(`${msg}${extra}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

const post = (url, body) =>
  request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });

export const api = {
  getState: () => request('/api/state'),
  saveState: (state) =>
    request('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    }),
  backup: (state) => post('/api/backup', { state }),
  listBackups: () => request('/api/backups'),
  restore: (name) => post('/api/restore', { name }),
  importState: (state) => post('/api/import', { state }),
  meta: () => request('/api/meta'),
  exportUrl: '/api/export',
};

/** 页面关闭前用 sendBeacon 兜底保存（不保证成功，但比丢数据好） */
export function beaconSave(state) {
  try {
    const blob = new Blob([JSON.stringify({ state })], { type: 'application/json' });
    return navigator.sendBeacon('/api/save', blob);
  } catch {
    return false;
  }
}
