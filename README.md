# 学院运营数据页（/academy/stats）· 候选交付

会员空间平台「学院 v1」的运营数据工作台页面，对应工单 S6-ACAD-051。页面包含筛选区、6 张指标卡、最近 12 个月报名/出勤双轴趋势图、可排序课程排行表、指标口径 Tooltip 与空状态。

> 仓库内所有会所、课程、会员与数值均为**虚构演示数据**，不含任何真实企业、客户或个人身份信息。

## 1. 页面能力

- **筛选**：时间段（默认最近 90 天）、会所、课程类别；另有「近 30 / 90 / 180 天」快捷区间与「重置筛选」。
- **6 张指标卡**：有效报名数、出勤率、训练营完课率、满意度均分、评价率、课程带来的连接数。每张卡展示当前值、与上一同等长度时间段的箭头与变化值，以及上一周期数值。
- **趋势图**：最近 12 个自然月报名数（左轴）与出勤率（右轴）双轴折线图，随会所/课程类别筛选变化。
- **课程排行表**：课程名、类别、课期数、报名数、出勤率、均分、评价率、非会员报名数、带来线索数、带来连接数，10 列均可点击表头排序；默认按报名数降序。
- **口径 Tooltip**：每个指标名旁的问号悬停/聚焦显示口径说明、对比口径与上一周期值，与本文「指标口径表」一致。
- **空状态**：无数据时指标卡、趋势、排行三个区块分别显示空状态。

## 2. 运行与验证

环境要求：Node.js ≥ 20；Edge 或 Chrome（e2e 自动查找，可用 `EDGE_PATH`/`CHROME_PATH` 指定）。录屏探针为纯 Node EBML 解析，不需要系统 `ffprobe`。安装依赖后：

```bash
npm install       # 或用 pnpm install（仓库带 pnpm-lock.yaml）
npm run dev       # 本地开发服务 127.0.0.1:5173/
npm run typecheck # tsc --noEmit
npm test          # Vitest 单元测试
npm run check     # 独立校验器：重算 6 指标/环比/趋势/排行 + 输出 artifacts/expected-stats.json
npm run e2e       # Playwright 端到端断言 + 截图（需先 npm run build）
npm run capture   # 重新录制 AC3 录屏（需先执行 npx playwright install ffmpeg）
npm run verify    # 全量验收（先写 FAIL/运行中，再跑各步骤并汇总证据）
```

`npm run check` 会重写 `artifacts/expected-stats.json`，使该文件哈希变化；复跑后执行 `npm run manifest` 重建 `repo/MANIFEST.sha256`（打包时交付工具会再生成同内容清单）。

`npm run verify` 先在 `artifacts/acceptance.json` 与 `ACCEPTANCE.md` 写入 `status: FAIL（运行中）`，再依次执行数据校验 / 反例 / typecheck / build / 单测 / e2e / 录屏 / 录屏探针，最后重算证据 SHA-256、字节数与生成时间，全部通过后才写 PASS；任一步失败都会保留失败日志并以非零码退出。录屏用 Playwright 自带 WebM 录制，本机需 `npx playwright install ffmpeg`（交付包内已含录制好的 WebM，复跑才需要）。

## 3. 统计口径

### 3.1 时间与筛选

- 默认时间段为**系统当天往前共 90 天（含当天）**；本轮演示快照日期为 2026-11-25，因此默认区间为 2026-08-28 至 2026-11-25。
- 「上一同等长度时间段」为紧邻当前区间之前、天数完全相同的一段（默认 2026-05-30 至 2026-08-27）。
- 起止日期倒置时页面自动交换；日期选择器不允许清空。
- 会所筛选含一个「筹备中」会所（无课期），用于演示空状态；会所与课程类别筛选同时作用于指标卡、趋势与排行表。
- 趋势图固定展示**最近 12 个自然月**（截至当天所在月），只受会所/类别影响；时间段筛选只作用于指标卡与排行表，这是本页明确的口径边界。

### 3.2 指标口径表

口径唯一来源为 `mock/metric-definitions.json`（11 条，含 6 个指标卡口径与 5 个表格列口径）；页面 Tooltip 直接取自该文件，下表由人工核对保持一致。`node scripts/check-stats.mjs` 校验 JSON 口径字段的完整性与关键词，不解析 README 文本。

| 指标 | 定义 | 对比口径 |
| --- | --- | --- |
| 有效报名数 | 统计周期内各课期「已确认」报名人数之和；取消、候补与重复报名不计。数据取自课期报名报表的去重报名人数。 | 与紧邻的上一同等长度时间段对比，会所与课程类别筛选保持一致。 |
| 出勤率 | 统计周期内实际签到人数 ÷ 有效报名人数 × 100%，按全部课期汇总后计算，不对各课期比率做简单平均。 | 与紧邻的上一同等长度时间段对比，变化值以百分点（pp）计。 |
| 训练营完课率 | 统计周期内训练营课期完成全部课次的人数 ÷ 训练营有效报名人数 × 100%；仅统计课程类型为「训练营」的课期，普通课程不参与。 | 与紧邻的上一同等长度时间段对比，变化值以百分点（pp）计。 |
| 满意度均分 | 统计周期内课后评价评分总和 ÷ 评价份数，满分 5 分，保留 2 位小数；周期内无评价时显示「—」。 | 与紧邻的上一同等长度时间段对比，变化值为分数差值。 |
| 评价率 | 统计周期内提交课后评价的人数 ÷ 实际出勤人数 × 100%，衡量出勤学员的评价参与度。 | 与紧邻的上一同等长度时间段对比，变化值以百分点（pp）计。 |
| 课程带来的连接数 | 由课期活动直接促成、且已归因到具体课期的会员间连接数之和；同一对会员在同一课期多次连接只计一次。 | 与紧邻的上一同等长度时间段对比，变化值为绝对差值。 |
| 报名数 | 统计周期内、所选会所与课程类别下的课期报名人数之和；取消、候补与重复报名不计。 | 仅展示当前周期，不做环比。 |
| 带来连接数 | 由课期活动直接促成、且已归因到该课程的会员间连接数之和；同一对会员在同一课期多次连接只计一次。 | 仅展示当前周期，不做环比。 |
| 课期数 | 统计周期内、所选会所与课程类别下的课期数量；同一课程的不同日期分别计期。 | 仅展示当前周期，不做环比。 |
| 非会员报名数 | 有效报名中，报名时尚未取得会员身份的报名人数；已包含在报名数内，不重复计数。 | 仅展示当前周期，不做环比。 |
| 带来线索数 | 课期现场登记、尚未转化为会员的潜在客户线索数之和；按课期归因，不含线上自然咨询。 | 仅展示当前周期，不做环比。 |

展示与计算约定：

- 计数类指标按千分位展示整数；比率保留 1 位小数并以 `%` 展示；满意度均分按口径定义保留 2 位小数。
- 变化值由未四舍五入的原始值相减后再取整/保留小数，避免「先取整再相减」造成误差；计数变化为绝对差值，比率变化单位为 pp，均分变化为分数差值。
- 分母为 0 或上一周期没有课期时显示「—」，方向标记为「–（上一周期无数据）」，不显示假的 0。

### 3.3 趋势

- 月份按自然月聚合，最近 12 个自然月按时间升序；无课期的月份报名数为 0，出勤率为「—」（折线断开）。
- 左轴报名数为整数人数，右轴出勤率为百分比；右轴下限按数据自适应，上限 100%。
- 图表下方提供屏幕阅读器可读的数据明细表（视觉隐藏），e2e 也以该表作为断言来源。

### 3.4 课程排行

- 在当前时间段 + 会所 + 类别下，按课程聚合所有课期；课期数为区间内课期数量。
- 默认按报名数降序；点击任意表头切换该列排序，再次点击切换升降序；文本列按 `zh-CN` 排序规则比较，空值（无评价）在升序时排在最前、降序时排在最后（当前 mock 无空值）。
- 表头问号 Tooltip 覆盖全部 8 个指标列：课期数、报名数、非会员报名数、带来线索数、带来连接数各有一条专用口径，出勤率、满意度均分、评价率复用对应卡片口径；课程名、类别为文本列，没有问号但同样可点击文字排序。
- Tooltip 支持鼠标悬停与键盘 focus，按 Escape 可关闭。

### 3.5 空状态

- 当筛选组合下区间内课期数为 0（例如选择「青屿会所（筹备中）」），6 张指标卡、趋势图、排行表分别展示空状态文案，不留旧数据。
- 趋势图空状态同时覆盖「最近 12 个月无数据」的情形。

## 4. Mock 接口与对接点

页面数据通过 `src/api/academyStats.ts` 的 `fetchAcademyStats()` 获取，当前直接返回打包进前端的 mock JSON，附带 120ms 模拟延迟。函数返回：

```ts
interface AcademyStatsPayload {
  dataset: AcademyDataset;      // 会所、类别、课程、课期明细与会话级指标
  definitions: MetricDefinition[]; // 指标口径定义（label/unit/definition/comparison）
  source: "mock";
  fetchedAt: string;
}
```

真实接口对接方式：

- 用真实请求替换该函数：`GET /api/v1/academy/stats?start=YYYY-MM-DD&end=YYYY-MM-DD&venue_id=<id|all>&category_id=<id|all>`，返回结构保持 `{ dataset, definitions }`；分页/大数据量场景可在服务端完成聚合，前端仅消费 `ViewModel` 所需的明细或聚合结果。
- **身份与数据范围**：真实部署时应由 S2-IAM 注入当前用户角色与 data scope（可见会所/类别），前端不自行拼接越权参数；当前 mock 以 S2-IAM stub 视为「全量可见」。
- **工作台框架**：页面按 S2-WB 的前端约定独立可运行（React 18 + TypeScript + TDesign + Vite），接入工作台 shell 时保留 `/academy/stats` 路由与页面容器即可。
- 课期级字段：`id, courseId, venueId, date, enrolled, attended, nonMemberEnrolled, completed, reviewCount, reviewScoreSum, leads, connections`；真实接口应保证同一课期同一会员去重后再提供 `enrolled/attended` 等汇总字段，否则指标会重复计数。
- 错误处理：接口失败时页面展示错误态（`data-testid="page-error"`）；真实实现应补充分页、重试与埋点，当前 mock 不涉及。

## 5. 设计 tokens

颜色与间距定义在 `src/designTokens.ts`，并以 CSS 变量同步到 `src/styles.css`（`:root`）。主色、语义色与图表色一致：

| token | 值 | 用途 |
| --- | --- | --- |
| color.pageBackground | `#f3f6fb` | 页面底色 |
| color.panel | `#ffffff` | 卡片/面板底色 |
| color.text | `#1d2939` | 主文本 |
| color.textSecondary | `#475467` | 次级文本 |
| color.textMuted | `#667085` | 辅助说明 |
| color.border | `#e4e9f2` | 分割线/边框 |
| color.borderStrong | `#cfd8e6` | 强边框、问号描边 |
| color.brand | `#2563eb` | 主色、报名折线 |
| color.brandSoft | `#eff4ff` | 主色浅底、徽标 |
| color.neon | `#0e9f6e` | 正向变化、出勤折线 |
| color.danger | `#d92d20` | 负向变化 |
| color.warning | `#b54708` | 提示色（预留） |
| color.chartEnrollment | `#2563eb` | 报名数折线 |
| color.chartAttendance | `#0e9f6e` | 出勤率折线（虚线） |
| color.chartGrid | `#e4e9f2` | 图表网格线 |
| color.chipBackground | `#f0f4fa` | 类别 chip / 标签底色 |
| font.family | PingFang SC / Microsoft YaHei / Noto Sans SC 等 | 全局字体 |
| radius.panel / control / chip | 12px / 8px / 999px | 圆角 |
| spacing.page / section / card | 24px / 14px / 14px | 布局间距 |

TDesign 主题变量在 `src/styles.css` 中映射到同一主色（`--td-brand-color` 等），保证组件与图表配色一致。

## 6. Mock 数据说明

- 文件：`mock/academy-stats.json`（会所/类别/课程/课期明细）、`mock/metric-definitions.json`（口径唯一来源）。
- 由 `scripts/generate-mock.mjs` 以固定种子 `20261125` 确定性生成，可用 `node scripts/generate-mock.mjs` 重放；生成结果覆盖 2025-06 至 2026-11 共 18 个月、4 个会所（含 1 个筹备中）、4 个类别、12 门课程（2 门训练营）、268 个课期。
- 所有名称、数值、评分与线索均为虚构；不含真实企业名、真实人名、电话、邮箱或客户标识。
- 演示快照日：`2026-11-25`（页面徽标展示）。

## 7. 测试与验收

- `src/domain/stats.test.ts`：Vitest 单元测试（13 项），从 `mock/academy-stats.json` 原始课期明细独立重算 6 张指标卡、上一周期变化、12 个月趋势、排行聚合、筛选差异与空数据边界，并覆盖“上一周期无课期”“0 出勤时评价率为空”“趋势空月份保留”三个回归点。
- `scripts/check-stats.mjs`：不依赖页面代码的独立校验器，重新从 mock JSON 计算默认/近 30 天/单会所/单类别/空会所五组期望值，校验指标口径定义完整性，并含 5 个反例自检（出勤>报名、评分越界、重复课期 id、未知课程、删除口径必须被判失败）；输出 `artifacts/expected-stats.json` 供 e2e 使用。
- `scripts/e2e.mjs`：Playwright 无头浏览器（本机 Edge/Chrome）在固定时钟 2026-11-25、1440×1100 下断言 676 项：默认 6 卡数值/上一周期/箭头、趋势 12 个月逐月值、排行 10 列与默认降序、箭头与表头文字排序、卡片与表头 Tooltip（含键盘 focus）、会所与类别筛选后全区块重算、30 天快捷区间、筹备中会所空状态、重置、console 无错误。
- 截图：`docs/screens/ac1-academy-stats.png`（AC1 整页）、`ac1b-ranking-sort-asc.png`、`ac2-metric-tooltip.png`（AC2）、`ac3a-venue-hill.png`、`ac4-empty-state.png`；录屏：`docs/recordings/ac3-venue-switch.webm`（AC3，8–15 秒真实 WebM，`scripts/probe-webm.mjs` 用纯 Node EBML 解析校验容器、视频轨与时长，不依赖系统 ffprobe）。
- `npm run verify` 生成 `ACCEPTANCE.md` 与 `artifacts/acceptance.json`，记录每一步命令、日志、证据文件 SHA-256/字节数/生成时间，并校验证据均为本轮新生成（含“旧证据必须被拒绝”的反例）。

## 8. 已知限制与边界

- 数据为前端内置 mock，不连接真实后端；真实接口、权限、分页与缓存以「Mock 接口与对接点」为准，接入时需要替换 `fetchAcademyStats`。
- 趋势图口径固定为最近 12 个自然月，不受时间段筛选影响；如需让趋势跟随时间段，需要后端提供按区间聚合的趋势序列。
- 排行表最多 12 门课程（当前数据量），未实现服务端分页；数据量增大时应由接口分页或虚拟滚动承接。
- 演示时钟：页面以浏览器本地日期计算默认区间与 12 个月窗口；e2e/截图/录屏固定时钟为 2026-11-25 以保证证据可复现。
- 生产构建包含 ECharts，首次加载体积较大（已按 echarts/react/tdesign 拆分 vendor chunk，单 chunk 最大 1.05MB，低于 1.1MB 警告阈值）；如接入工作台 shell，可按需异步加载图表模块。
- 未接入真实 SSO/IAM；真实环境必须使用 S2-IAM 注入的数据范围，不能信任前端筛选参数。

## 9. 目录结构

```text
.
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ mock/
│  ├─ academy-stats.json
│  └─ metric-definitions.json
├─ src/
│  ├─ api/academyStats.ts
│  ├─ components/
│  │  ├─ EmptyState.tsx
│  │  ├─ FilterBar.tsx
│  │  ├─ MetricCard.tsx
│  │  ├─ RankingTable.tsx
│  │  ├─ TooltipHelp.tsx
│  │  └─ TrendChart.tsx
│  ├─ domain/
│  │  ├─ date.ts
│  │  ├─ format.ts
│  │  ├─ stats.test.ts
│  │  ├─ stats.ts
│  │  └─ types.ts
│  ├─ pages/AcademyStatsPage.tsx
│  ├─ App.tsx
│  ├─ designTokens.ts
│  ├─ main.tsx
│  └─ styles.css
├─ scripts/
│  ├─ build.mjs
│  ├─ capture-video.mjs
│  ├─ check-stats.mjs
│  ├─ e2e.mjs
│  ├─ find-browser.mjs
│  ├─ generate-mock.mjs
│  ├─ preview-server.mjs
│  ├─ probe-webm.mjs
│  └─ run_acceptance.mjs
├─ docs/
│  ├─ screens/       # 5 张验收截图
│  └─ recordings/    # AC3 会所切换录屏（WebM）
└─ artifacts/        # 验收日志、期望值、证据清单
```
