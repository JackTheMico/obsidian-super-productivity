# Obsidian Super Productivity Sync

双向同步 Obsidian 任务（checkbox）与 [Super Productivity](https://github.com/johannesjo/super-productivity) 的插件。

A plugin that bidirectionally syncs Obsidian tasks (checkboxes) with [Super Productivity](https://github.com/johannesjo/super-productivity).

## 功能 | Features

- **推送 (Obsidian → SP)**：将当前行或全文的 `- [ ]` 待办事项发送到 Super Productivity
  **Push (Obsidian → SP)**: Send the current line or the whole file's `- [ ]` todos to Super Productivity.
- **回写 (SP → Obsidian)**：在 SP 中标记任务完成后，自动将 Obsidian 中对应的 `- [ ]` 改为 `- [x]`
  **Write-back (SP → Obsidian)**: When a task is completed in SP, the corresponding `- [ ]` in Obsidian is automatically changed to `- [x]`.
- **双向状态同步**：在 Obsidian 中勾选/取消勾选后，自动同步到 SP；反之亦然
  **Bidirectional status sync**: Checking/unchecking in Obsidian syncs to SP automatically, and vice versa.
- **子任务支持**：Obsidian 中的缩进层级自动映射为 SP 的子任务
  **Subtask support**: Indentation levels in Obsidian are automatically mapped to SP subtasks.
- **深链接**：在 SP 任务备注中嵌入 Obsidian deep link（点击直接跳回原笔记位置）
  **Deep link**: Embeds an Obsidian deep link in the SP task notes (click to jump back to the note).
- **标签/计划日期/项目同步**：通过内联字段 `@tags:` `@schedule:` `@project:` 将标签、计划日期、所属项目一并推送到 SP
  **Tags / scheduled date / project sync**: Inline fields `@tags:` `@schedule:` `@project:` push tags, scheduled date, and project to SP together.
- **停止编辑自动同步**：停止修改当前文件（防抖等待）后，自动将该文件未同步的任务推送到 SP
  **Auto-sync on idle**: After you stop editing the current file (debounce wait), unsynced tasks in that file are pushed to SP automatically.

## 架构 | Architecture

```
┌──────────────────────────┐      HTTP POST /tasks       ┌──────────────────────┐
│    Obsidian Plugin       │ ──────────────────────────► │ Super Productivity  │
│                          │     (创建/更新任务)          │   Local REST API     │
│  ┌────────────────────┐  │      (create/update task)   │   :3876              │
│  │ Task Parser        │  │ ◄────────────────────────── │                      │
│  │ (解析 markdown)    │  │     Poll GET /tasks          │                      │
│  │ (parse markdown)   │  │     (每30秒轮询状态变更)     │                      │
│  └────────────────────┘  │     (poll every 30s)        │                      │
│  ┌────────────────────┐  │                              └──────────────────────┘
│  │ File Modifier      │  │  ← 检测到 SP 任务状态变化时，修改本地文件
│  │ (Vault.modify)     │  │  ← modifies local file when SP task status changes
│  └────────────────────┘  │
└──────────────────────────┘
```

由于 Super Productivity 没有 Webhook 机制，插件采用**轮询（Polling）** 方式检测状态变化。

Because Super Productivity has no Webhook mechanism, the plugin uses **Polling** to detect status changes.

## 任务关联机制 | Task linking

- 发送任务到 SP 时，在 Obsidian checkbox 行尾追加 `[sp_id:: <SP_TASK_ID>]`
  When sending a task to SP, the plugin appends `[sp_id:: <SP_TASK_ID>]` to the end of the Obsidian checkbox line.
- 轮询时通过 `sp_id` 关联两边任务
  During polling, tasks on both sides are linked via `sp_id`.
- 支持缩进表示父子关系（最多一级子任务，超过一级拍平）
  Indentation represents parent-child relationships (one subtask level; deeper levels are flattened).

## 任务元数据（标签 / 截止日期 / 项目） | Task metadata (tags / due date / project)

使用 dataview 风格的内联字段，写在 checkbox 行中任意位置，发送时会被自动剥离、不会进入 SP 任务正文：

Use dataview-style inline fields anywhere in the checkbox line. They are automatically stripped on send and never enter the SP task body:

```markdown
- [ ] 写周报 @tags:work,report @schedule:2026-07-15 @project:工作
- [ ] 下午三点开会 @schedule:2026-07-12T15:00 @project:会议
- [ ] 明天要交 @schedule:明天
- [ ] 读书笔记 @tags:reading            # 多个标签用逗号或 | 分隔
    - [ ] 整理大纲 @project:工作         # 缩进表示 SP 子任务
```

推送成功后，插件会在行尾自动追加关联 ID（用于轮询回写）：

After a successful push, the plugin appends the link ID to the line end (used for polling write-back):

```markdown
- [ ] 写周报 @tags:work,report @schedule:2026-07-15 @project:工作 [sp_id:: abc123]
```

- `tags`：逗号或 `|` 分隔，按标题匹配 SP 中**已存在**的标签；未命中的标签会被跳过并提示
  `tags`: Comma- or `|`-separated; matched by title against **existing** SP tags. Unmatched tags are skipped with a notice.
- `schedule`：支持绝对日期 `YYYY-MM-DD`（全天）、`YYYY-MM-DDTHH:MM`（带时间），也支持相对写法 `今天`/`明天`/`周一`..`周日`（英文 `today`/`tomorrow`/weekday names 亦可）
  `schedule`: Absolute date `YYYY-MM-DD` (all-day), `YYYY-MM-DDTHH:MM` (with time), and relative `今天`/`明天`/`周一`..`周日` (also `today`/`tomorrow`/weekday names).
- `project`：按标题匹配 SP 中**已存在**的项目；未命中则回退到「默认项目 ID」设置
  `project`: Matched by title against **existing** SP projects; falls back to the "Default project ID" setting when unmatched.
- 停止编辑当前文件数秒（防抖）后，未同步的任务会自动推送到 SP（可在设置中关闭）
  After a few seconds of idle editing (debounce), unsynced tasks are pushed to SP automatically (can be disabled in settings).

> 注意：Super Productivity 本地 REST API 对标签与项目仅提供只读列表，无法经 API 新建，因此标签/项目须先在 SP 中创建好。
> Note: The Super Productivity local REST API exposes tags and projects as read-only lists and cannot create them via the API, so tags/projects must already exist in SP first.

仅 **Obsidian → SP** 方向同步这些字段（推送任务时写入）。

These fields sync in the **Obsidian → SP** direction only (written when pushing tasks).

## 已知限制 | Known Limitations

- **`@due` / `[due:: ...]` 暂不支持**：Super Productivity Local REST API (v3.01) 的 `plannedAt` 字段在创建/更新任务时不生效。`dueWithTime` 字段虽在 API 文档中标注为 "due date with time"，但实际在 SP 客户端中表现为**排期/计划日期**（出现在 Today View、Schedule View、Planner View）。因此当前插件将 `@schedule:` 映射到 `dueWithTime`，作为计划/排期日期使用。
- **`@schedule:` 语法映射到 `dueWithTime`**：这是目前唯一可用的设置任务计划日期的方式。若 SP 未来修复 `plannedAt`，将迁移回正确字段。
- 相关 Issue：[#2](https://github.com/JackTheMico/obsidian-super-productivity/issues/2) - Local REST API plannedAt 字段无效，dueWithTime 实际为排期日期

---

These fields sync in the **Obsidian → SP** direction only (written when pushing tasks).

## Known Limitations

- **`@due` / `[due:: ...]` not supported**: Super Productivity Local REST API (v3.01) `plannedAt` field doesn't work when creating/updating tasks. The `dueWithTime` field, though documented as "due date with time", actually behaves as the **scheduling/planned date** in SP client (appears in Today View, Schedule View, Planner View). Currently the plugin maps `@schedule:` to `dueWithTime` for planned date.
- **`@schedule:` syntax maps to `dueWithTime`**: This is the only working way to set a task's planned date. If SP fixes `plannedAt` in the future, migration will happen.
- Related Issue: [#2](https://github.com/JackTheMico/obsidian-super-productivity/issues/2) - Local REST API plannedAt field not working, dueWithTime actually used for scheduling

## 设置 | Settings

| 设置项 Setting | 默认值 Default | 说明 Description |
|---|---|---|
| SP API 地址 / SP API URL | `http://127.0.0.1:3876` | Super Productivity 的 REST API 地址 / The REST API URL of Super Productivity |
| 默认项目 ID / Default project ID | 空（收件箱）/ empty (Inbox) | 发送任务时的默认项目 / Default project when sending tasks |
| 轮询间隔 / Polling interval | 30 秒 / 30s | 状态同步的轮询频率 / Polling frequency for status sync |
| 自动创建深链接 / Auto-create deep link | 开启 / on | 在 SP 备注中嵌入 Obsidian 链接 / Embed Obsidian link in SP notes |
| 启用轮询 / Enable polling | 开启 / on | 是否启动定时轮询 / Whether to run periodic polling |
| 子任务同步 / Subtask sync | 开启 / on | 是否将缩进层级映射为 SP 子任务 / Map indentation to SP subtasks |
| 同步标签 / Sync tags | 开启 / on | 是否将 `@tag:` 同步为 SP 标签 / Sync `@tag:` to SP tags |
| 停止编辑自动同步 / Auto-sync on idle | 开启 / on | 停止编辑当前文件后自动推送未同步任务 / Auto-push unsynced tasks after editing stops |
| 自动同步防抖 / Auto-sync debounce | 3 秒 / 3s | 停止编辑后等待多久再自动同步 / Wait time before auto-sync triggers |

## 命令 | Commands

| 命令 Command | 说明 Description |
|---|---|
| Send current task to Super Productivity | 发送光标所在行的 checkbox / Send the checkbox on the current line |
| Send all tasks to Super Productivity | 发送当前文件所有未完成的 checkbox / Send all unfinished checkboxes in the current file |
| Force sync now | 立即执行一次完整同步 / Run a full sync immediately |
| Test SP connection | 测试 API 连接 / Test the API connection |

## 开发 | Development

### 项目结构 | Project structure

```
src/
├── main.ts                        # 插件入口，生命周期，命令注册 / Entry, lifecycle, commands
├── settings.ts                    # 设置界面与默认值 / Settings UI and defaults
├── api/
│   ├── types.ts                   # SP API 类型定义 / SP API type definitions
│   └── superProductivityApi.ts    # SP REST API 客户端 / SP REST API client
├── sync/
│   ├── obsidianTaskParser.ts      # Markdown checkbox 解析/修改 / Markdown checkbox parsing
│   └── taskSyncService.ts         # 核心同步引擎 / Core sync engine
└── utils/
    ├── constants.ts               # 常量定义 / Constants
    ├── deepLink.ts                # Obsidian URI 生成 / Obsidian URI generation
    └── taskFields.ts              # 标签/日期/项目解析 / Tag/date/project parsing
```

### 构建 | Build

```bash
npm install
npm run dev    # 开发模式（监听文件变化）/ Dev mode (watch)
npm run build  # 生产构建 / Production build
npm run lint   # ESLint 检查 / ESLint check
```

### 贡献 | Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on bug reports,
feature requests, development setup, coding conventions, and pull request process.

详细的缺陷报告、功能请求、本地开发、代码规范与 PR 流程请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 安装 | Installation

1. 在 Obsidian 中启用插件
   Enable the plugin in Obsidian.
2. 在 Super Productivity 中启用 **Settings → Misc → Enable local REST API**
   In Super Productivity, enable **Settings → Misc → Enable local REST API**.
3. 在插件设置中填写 SP API 地址（默认 `http://127.0.0.1:3876`）
   In the plugin settings, fill in the SP API URL (default `http://127.0.0.1:3876`).
4. 点击「测试连接」确认
   Click "Test connection" to confirm.
