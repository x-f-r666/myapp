#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[!] 没有找到 Node.js，请先安装 Node.js 20+： https://nodejs.org/"
  exit 1
fi

mkdir -p data

echo ""
echo "  正在启动「个人工作生活台」… → http://127.0.0.1:${PORT:-4173}"
echo "  数据保存在 data/app-data.json，按 Ctrl+C 停止服务"
echo ""

OPEN_BROWSER=1 exec node server/index.js
