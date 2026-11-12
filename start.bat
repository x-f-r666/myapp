@echo off
chcp 65001 >nul
title 个人工作生活台
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] 没有找到 Node.js。
  echo      请先安装 Node.js 20 或更高版本： https://nodejs.org/
  echo      安装完成后重新双击本文件即可。
  echo.
  pause
  exit /b 1
)

if not exist data mkdir data

echo.
echo  正在启动「个人工作生活台」…
echo  数据保存在 data\app-data.json，关闭本窗口即停止服务。
echo.

set OPEN_BROWSER=1
node server/index.js
pause
