# 验收报告

状态：**PASS**

- 开始时间：2026/11/26 14:42:42（Asia/Shanghai）
- 结束时间：2026/11/26 14:44:37
- 通过步骤：9/9
- 证据文件：10（含 artifacts/acceptance.json 自身）

## 执行步骤

| # | 步骤 | 结果 | 耗时 | 日志 |
| --- | --- | --- | --- | --- |
| 1 | 独立口径重算（从 mock JSON 重算 6 卡/上一周期/趋势/排行） | PASS | 230 ms | [`artifacts/logs/data.log`](artifacts/logs/data.log) |
| 2 | 反例校验（出勤>报名、评价越界、重复 id、未知课程、删口径必须被拒绝） | PASS | 181 ms | [`artifacts/logs/negative.log`](artifacts/logs/negative.log) |
| 3 | 独立类型检查 | PASS | 6910 ms | [`artifacts/logs/typecheck.log`](artifacts/logs/typecheck.log) |
| 4 | 生产构建（含类型检查） | PASS | 64016 ms | [`artifacts/logs/build.log`](artifacts/logs/build.log) |
| 5 | 单元测试（区间/上一周期/6 指标/空数据/格式化） | PASS | 2876 ms | [`artifacts/logs/unit.log`](artifacts/logs/unit.log) |
| 6 | 端到端验收（固定时钟 + 1440 宽 + 5 张证据截图） | PASS | 18526 ms | [`artifacts/logs/e2e.log`](artifacts/logs/e2e.log) |
| 7 | AC3 真实录屏（Playwright WebM，会所切换交互） | PASS | 22080 ms | [`artifacts/logs/video.log`](artifacts/logs/video.log) |
| 8 | 录屏探针（WebM 容器 + 8–15 秒时长） | PASS | 148 ms | [`artifacts/logs/probe.log`](artifacts/logs/probe.log) |
| 9 | 证据校验（SHA-256 / 字节 / 生成时间 / 反例：旧证据被拒绝） | PASS | 0 ms | - |

## 证据（SHA-256 / 字节 / 生成时间）

| 文件 | SHA-256 | 字节 | 生成时间 |
| --- | --- | --- | --- |
| [`docs/screens/ac1-academy-stats.png`](docs/screens/ac1-academy-stats.png) | `6f3e5a6f48f0b2f1ba0f84c80003b93cb002a09d0d320850f40b5d24fb69d391` | 171790 | 2026/11/26 14:44:00 |
| [`docs/screens/ac1b-ranking-sort-asc.png`](docs/screens/ac1b-ranking-sort-asc.png) | `b56bad131c767e5a09c5c3eaf2275a97babd379422989926f111bb202ed66288` | 172829 | 2026/11/26 14:44:04 |
| [`docs/screens/ac2-metric-tooltip.png`](docs/screens/ac2-metric-tooltip.png) | `ba2d72fdb5397a910f17f65a1dcdd0542b236d3b74b579ec5a3bffd45e6c6167` | 147837 | 2026/11/26 14:44:01 |
| [`docs/screens/ac3a-venue-hill.png`](docs/screens/ac3a-venue-hill.png) | `fac005b656b96ed26f6fe4fccb85b1c32428f3ced00f6c22d289f79bdfc607a0` | 167691 | 2026/11/26 14:44:06 |
| [`docs/screens/ac4-empty-state.png`](docs/screens/ac4-empty-state.png) | `f71ac792862fbd094f568470c7d19ab5c6929e619a1cbce6f658f242aa661629` | 84445 | 2026/11/26 14:44:08 |
| [`docs/recordings/ac3-venue-switch.webm`](docs/recordings/ac3-venue-switch.webm) | `358db7cf041d1499058bac023f389a32b00df78f4064ea954040b4e16af472a5` | 4348497 | 2026/11/26 14:44:31 |
| [`artifacts/expected-stats.json`](artifacts/expected-stats.json) | `8a04e9db6df39b6eaf7c0359e3b0e5fa12c41de848693a3ab83bffd522180e52` | 33627 | 2026/11/26 14:42:42 |
| [`artifacts/e2e-result.json`](artifacts/e2e-result.json) | `4539362ff3d8317fdd6f4d376586d29aa1b7e29ba2a3bbdc1522c2307b7e296f` | 1628 | 2026/11/26 14:44:09 |
| [`artifacts/video-result.json`](artifacts/video-result.json) | `fa5d1f566386fc0dccc6a70279cb3500d28c82f77ced15bf4f449974c10c5f3f` | 417 | 2026/11/26 14:44:32 |

## 验收点

- AC1：6 张指标卡 + 12 个月双轴趋势 + 10 列可排序排行 → `docs/screens/ac1-academy-stats.png`
- AC2：问号提示显示口径说明 → `docs/screens/ac2-metric-tooltip.png`
- AC3：切换会所后所有区块刷新 → `docs/recordings/ac3-venue-switch.webm`（8–15 秒，EBML 结构/时长探针校验）
- 扩展：排序升序、空会所空状态 → `ac1b-ranking-sort-asc.png`、`ac4-empty-state.png`

## 复现

```bash
node scripts/run_acceptance.mjs
```

脚本先写 RUNNING/FAIL，全部通过后写 PASS；证据必须由本次运行新生成，哈希/字节/时间从文件重算。
