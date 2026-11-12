# 开发计划 · 个人工作生活台（myapp）

依据：`PRD.md` v1.0
技术选型：Node.js ≥ 20（本机 v22.22）+ 原生 HTTP 服务 + 原生前端 ES Modules，**零运行时依赖**，无构建步骤。
测试：Node 内置 `node:test` + `node:assert`，全部为可自动执行的用例。

---

## 0. 架构决策（开工前先定死）

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 数据落盘 | `data/app-data.json`，先写 `.tmp` + `fsync` + 原子 rename | 断电/崩溃不会留下半个文件 |
| 服务 | 纯 `node:http`，仅监听 `127.0.0.1:4173` | 不需要联网，不需要 npm install，最不容易坏 |
| 前端 | 原生 ESM + 字符串模板渲染（无虚拟 DOM、无框架） | 无构建、可直接调试、渲染函数返回字符串便于在 Node 里测试 |
| 共享逻辑 | `public/js/core/*.js` 同时被浏览器与测试 import | 业务规则只写一份，测试测的就是真实逻辑 |
| 图表 | 手写 SVG（折线/面积、柱状、环形、迷你线） | 离线可用，不依赖 CDN，样式统一 |
| 样式 | `public/styles/app.css` 一套 CSS 变量 + 组件类 | 统一设计语言，改一处全局生效 |
| 测试口径 | 失败即停，修好再往下；不允许删用例/放宽断言 | 按用户要求 |

目录结构：

```
myapp/
├─ package.json
├─ server/
│  ├─ index.js          # HTTP 服务、静态资源、API 路由
│  └─ store.js          # 读写、原子落盘、备份、恢复、校验
├─ public/
│  ├─ index.html
│  ├─ styles/app.css
│  └─ js/
│     ├─ app.js         # 启动、路由、状态、自动/手动保存
│     ├─ api.js
│     ├─ core/          # dates / model / stats（纯逻辑，可测）
│     ├─ components/    # ui / charts / calendar
│     └─ views/         # 9 个模块视图
├─ tests/
│  ├─ core.test.js
│  ├─ charts.test.js
│  ├─ server.test.js
│  └─ sanity.test.js
├─ data/                # 运行后生成（git 忽略）
├─ start.bat / start.sh
├─ PRD.md / PLAN.md / README.md
```

---

## 阶段一：服务端与本地数据持久化（预计 1 个提交单元）

**任务**
1. `package.json`：`type: module`，`start` / `test` 脚本，`engines.node >= 20`。
2. `public/js/core/model.js`：`createInitialState()`（含 `version`、`meta`、`settings`、9 个模块空结构）、`SCHEMA_VERSION`、`emptyState` 工厂。
3. `server/store.js`
   - `loadState()`：不存在则用初始状态创建；解析失败则备份坏文件并以初始状态启动（不静默覆盖）。
   - `saveState(state)`：校验 → 原子写入 → 生成当日 `auto-YYYY-MM-DD.json`（每日一次，保留 30 份）→ 返回 `{savedAt, size, revision}`。
   - `createBackup(label)` / `listBackups()` / `restoreBackup(name)`（恢复前先存 `pre-restore-*` 快照）。
   - `validateState(obj)`：校验根对象、版本、各模块数组类型，返回错误清单。
   - `normalizeState(obj)`：补齐缺失字段，兼容旧版本。
4. `server/index.js`
   - `GET /`、静态文件（带 MIME、防目录穿越）。
   - `GET /api/health`、`GET /api/state`、`PUT /api/state`、`POST /api/save`、`POST /api/backup`、`GET /api/backups`、`POST /api/restore`、`GET /api/export`、`POST /api/import`。
   - 统一 JSON 错误格式 `{error, detail}`；请求体上限 8MB。
   - `PORT`/`DATA_DIR` 可通过环境变量覆盖（测试用）。
5. `start.bat`：检测 node → 启动服务 → 打开默认浏览器；`start.sh` 同逻辑。

**测试（`tests/server.test.js`）**
- 首次请求自动创建数据文件，返回初始结构且 9 个模块键齐全。
- `PUT` 后文件真实存在，再用新实例 `loadState()` 能读回相同内容（模拟重启）。
- 原子写入：保存后目录内不存在残留 `.tmp`。
- 备份：手动备份出现在列表、文件存在；自动备份同一天只生成一次。
- 恢复：改数据 → 恢复 → 数据回退，且生成 `pre-restore-*` 文件。
- 导入校验：`{}`、`null`、字段类型错误均返回 400 且**不覆盖**原文件。
- 路径穿越：`../package.json`、`..%2F` 一律 400/404，不返回文件。
- 静态资源：`/` 返回 HTML，`/js/app.js` 返回 JS，未知路径 404 JSON。

**完成判据**：`npm test -- tests/server.test.js` 全绿；手动启动能 `curl` 到 `/api/state`。

---

## 阶段二：设计系统、应用外壳、首页、今日计划

**任务**
1. `public/styles/app.css`：CSS 变量（米白背景 `#F5F3EE`、纸白卡面、深墨绿主色、赭石强调色）、排版（中文无衬线 + 等宽数字）、卡片、按钮（primary/ghost/danger/icon）、表单、分段标签、表格、弹窗、Toast、空状态、日历、看板、进度条、环形进度。
2. `public/index.html`：应用骨架（sidebar / topbar / main / statusbar），含 favicon（inline SVG）。
3. `public/js/api.js`：`getState/saveState/backup/listBackups/restore/exportUrl/importState`。
4. `public/js/app.js`：启动加载、`commit()` 状态变更 + 700ms 防抖自动保存、`Ctrl/Cmd+S`、`beforeunload` 兜底、hash 路由、侧栏角标、保存状态机（idle/dirty/saving/saved/error）。
5. `public/js/components/ui.js`：`esc()`、`uid()`、`modal()`、`confirmDialog()`、`toast()`、`field()`、`emptyState()`、`pageHeader()`、`progressBar()`、`tabs()`、`fmtNum()`。
6. `public/js/components/charts.js`：`sparkline()`、`lineChart()`（网格/轴/点/面积渐变）、`barChart()`、`donut()`、`progressRing()`；全部返回 SVG 字符串，空数据返回占位。
7. `public/js/core/dates.js`：`todayISO`、`toISO`、`addDays`、`startOfWeek`、`monthMatrix`、`lastNDays`、`formatCN`、`weekdayCN`、`monthLabel`。
8. `public/js/core/stats.js`：今日任务筛选、完成率、各模块摘要聚合（`dashboardSummary`）。
9. `views/dashboard.js`：问候条 + 今日完成环、三件重点 + 待办、快速备忘、6 张摘要卡、待跟进清单。
10. `views/today.js`：按上午/下午/晚上分组、优先级、来源标签、设为重点（≤3）、完成、编辑、删除、顺延到明天、昨日遗留一键带入、筛选。

**测试（`tests/core.test.js` 第一批 + `tests/charts.test.js`）**
- `monthMatrix`：2026-02（28 天，周一起始）、2026-11、跨年 12→1、首尾补齐单元格数量恒为 42。
- `lastNDays` 顺序与长度；`formatCN` 中文格式；`startOfWeek` 周一边界。
- 完成率：0 任务返回 0 不除零；部分完成取整；全完成 100。
- `dashboardSummary`：只统计当天任务；重点最多 3 条；待跟进只含 `followUpDate <= today` 且未完成。
- `lineChart/barChart/donut/sparkline`：空数组不抛错且含“暂无数据”；单点、全 0 不产生 `NaN`/`Infinity`；输出包含 `<svg` 且闭合标签数量匹配。

**完成判据**：页面能启动，首页与今日计划可增删改并自动保存；上述测试全绿。

---

## 阶段三：自媒体 / 开发工作 / 咨询工作

**任务**
1. `views/content.js`
   - 分段：选题管线（5 列看板，点击推进/回退阶段）、发布数据。
   - 发布记录弹窗：标题、平台、日期、链接、备注 + 当前播放/点赞/评论/涨粉（保存时写当日快照）。
   - 图表：近 30 天播放增长（面积折线）、平台播放对比（柱状）、粉丝增长（折线）、KPI 四卡、作品排行表。
2. `views/dev.js`
   - 项目卡片（状态、技术栈、进行中工作项数、本周工时）。
   - **「+ 新建工作项」主按钮 + 项目卡内 `+` 入口 + 空状态按钮**；未选项目时禁用并提示「先建一个项目」。
   - 工作项列表按状态分组，可改状态、记工时、编辑、删除、加入今日计划。
   - 图表：本周各项目工时柱状、状态环形、类型分布。
3. `views/consulting.js`
   - 客户表：阶段、公司、联系、最近跟进、操作（编辑/**删除**）。
   - 删除确认：可选「同时删除该客户的项目与沟通记录」，默认勾选；删除后统计同步。
   - 客户详情抽屉/内联展开：项目列表、沟通记录、下一步。
   - 项目：金额、起止、状态；收入按月柱状图；客户阶段分布。
   - 跟进：`followUpDate` 到期高亮，可「标记已跟进」或加入今日计划。
4. `core/stats.js` 增补：`contentSeries`、`platformTotals`、`postRanking`、`devWorkload`、`itemBreakdown`、`consultingPipeline`、`monthlyRevenue`。

**测试（追加到 `tests/core.test.js`）**
- 快照聚合：某作品只有 1 个快照时，曲线沿用该值不跳 0；多作品同日快照求和；跨 30 天边界正确。
- 平台汇总：同平台多条相加，结果按播放降序。
- 工时：只统计本周（周一为界）；项目删除后其工作项工时不计入。
- 咨询：`status=lost` 不计入在谈/签约数；月度收入按月份分组；删除客户后关联统计减少。
- 工作项：状态分布合计等于总数；预估工时为空按 0 处理。

**完成判据**：三个模块可完整走通「建 → 改 → 看图表 → 删」；测试全绿。

---

## 阶段四：健身 / 饮食 / 游戏娱乐

**任务**
1. `components/calendar.js`：月历网格（周一起始、今天高亮、上下月切换、每格自定义内容与点击回调）。
2. `views/fitness.js`
   - 月历：每格显示主练部位色点 + 部位名 + 动作数；今天描边高亮。
   - 点某天 → 当日面板：主练部位（模板预填）、时长、感受、动作列表（动作/组数/次数/重量）、备注；增删动作；保存/删除当天记录。
   - 侧栏：本周已练 X/目标 Y、连续训练天数、近 30 天部位分布环形、周计划模板可编辑。
3. `views/diet.js`
   - 月历：每格显示当日总热量（超目标标红）+ 蛋白质达成小点。
   - 点某天 → 三餐 + 加餐面板：从食物库选择或手填（名称/份量/热量/蛋白质），删除条目，饮水 +1 杯；实时合计与目标环形。
   - 侧栏：近 7 天热量折线、目标设置、食物库管理（增删）。
4. `views/games.js`：条目卡片/表格（状态筛选、评分星）、记录游玩（日期/条目/分钟/心情）、近 4 周时长柱状、条目占比、状态分布。

**测试（追加）**
- 健身：同一天重复保存是更新不是新增；动作合计组数正确；连续训练天数计算（含中断）；部位分布只统计近 30 天。
- 饮食：当日热量 = 四餐之和；空餐返回 0；超目标判定为 `>` 而非 `>=`；近 7 天缺数据的日期补 0 而不是断点。
- 游戏：周时长按周一切分；状态筛选互斥且合计等于总数；删除条目后其记录不计入统计。
- 日历：42 格、跨月日期标记 `outside`、点击回调返回正确 ISO 日期。

**完成判据**：两个日历模块点任意日期都能录入并在格子里看到结果；测试全绿。

---

## 阶段五：数据与设置、全量回归

**任务**
1. `views/settings.js`：保存状态与手动保存大按钮、立即备份、备份列表 + 恢复（二次确认）、导出（下载）、导入（文件选择 + 校验结果）、按模块清空、偏好设置（昵称/健身周目标/热量与蛋白质目标/饮水目标）、数据统计（各模块条数、文件大小、最后保存时间、版本）。
2. `app.js` 收尾：保存失败重试提示、切页强制保存、空数据引导。
3. 视觉走查：空状态、长文本截断、1280/1440 宽度、图表无数据、深色侧栏对比度。
4. 全量测试：`npm test`，覆盖 4 个测试文件；补 `tests/sanity.test.js`（对所有 `.js` 执行 `node --check`、检查 9 个视图均导出 `render`、index.html 引用的资源都存在）。

**完成判据**：PRD 第 10 节 20 条验收标准逐条自查通过；`npm test` 0 failed。

---

## 阶段六：Git、文档、发布

1. `git init` → `git config` 检查 → `.gitignore`（`data/`、`node_modules/`、`*.log`、系统垃圾文件）。
2. 首次提交（含源码、PRD、PLAN、README、启动脚本）。
3. `README.md`：解决什么问题、主要功能、安装、使用、输入输出示例，必须与真实功能一致。
4. `gh` 检查：本机未安装 → 说明安装方式并等待用户确认 → 安装后 `gh --version` → `gh auth login --web --git-protocol ssh`。
5. 发布前向用户确认：仓库名 `myapp`、Public、remote `origin`、分支 `main`，确认后才执行创建与推送。

---

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| 浏览器清缓存/换浏览器 | 数据在磁盘文件，不在浏览器；顶栏显示数据文件路径 |
| 写入过程中断电 | 原子 rename + 每日自动备份 + 恢复前快照 |
| 页面关闭时还有未保存修改 | `beforeunload` 强制保存 + 保存状态常驻可见 |
| 单文件数据损坏 | 启动时坏文件改名保留，不覆盖；可从备份恢复 |
| 端口被占用 | 启动失败提示换端口（`PORT=4174`） |
| 前端无构建导致模块加载失败 | `sanity.test.js` 校验所有模块语法与导出 |
