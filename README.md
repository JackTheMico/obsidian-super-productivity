# Obsidian Super Productivity Sync

双向同步 Obsidian 任务（checkbox）与 [Super Productivity](https://github.com/johannesjo/super-productivity) 的插件。

## 功能

- **推送 (Obsidian → SP)**：将当前行或全文的 `- [ ]` 待办事项发送到 Super Productivity
- **回写 (SP → Obsidian)**：在 SP 中标记任务完成后，自动将 Obsidian 中对应的 `- [ ]` 改为 `- [x]`
- **双向状态同步**：在 Obsidian 中勾选/取消勾选后，自动同步到 SP；反之亦然
- **子任务支持**：Obsidian 中的缩进层级自动映射为 SP 的子任务
- **深链接**：在 SP 任务备注中嵌入 Obsidian deep link（点击直接跳回原笔记位置）

## 架构

```
┌──────────────────────────┐      HTTP POST /tasks       ┌──────────────────────┐
│    Obsidian Plugin       │ ──────────────────────────► │ Super Productivity  │
│                          │     (创建/更新任务)          │   Local REST API     │
│  ┌────────────────────┐  │                              │   :3876              │
│  │ Task Parser        │  │ ◄────────────────────────── │                      │
│  │ (解析 markdown)    │  │     Poll GET /tasks          │                      │
│  └────────────────────┘  │     (每30秒轮询状态变更)     │                      │
│  ┌────────────────────┐  │                              └──────────────────────┘
│  │ File Modifier      │  │  ← 检测到 SP 任务状态变化时，修改本地文件
│  │ (Vault.modify)     │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

由于 Super Productivity 没有 Webhook 机制，插件采用**轮询（Polling）** 方式检测状态变化。

## 任务关联机制

- 发送任务到 SP 时，在 Obsidian checkbox 行尾追加 `[sp_id:: <SP_TASK_ID>]`
- 轮询时通过 `sp_id` 关联两边任务
- 支持缩进表示父子关系（最多一级子任务，超过一级拍平）

## 设置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| SP API 地址 | `http://127.0.0.1:3876` | Super Productivity 的 REST API 地址 |
| 默认项目 ID | 空（收件箱） | 发送任务时的默认项目 |
| 轮询间隔 | 30 秒 | 状态同步的轮询频率 |
| 自动创建深链接 | 开启 | 在 SP 备注中嵌入 Obsidian 链接 |
| 启用轮询 | 开启 | 是否启动定时轮询 |
| 子任务同步 | 开启 | 是否将缩进层级映射为 SP 子任务 |

## 命令

| 命令 | 说明 |
|---|---|
| Send current task to Super Productivity | 发送光标所在行的 checkbox |
| Send all tasks to Super Productivity | 发送当前文件所有未完成的 checkbox |
| Force sync now | 立即执行一次完整同步 |
| Test SP connection | 测试 API 连接 |

## 开发

### 项目结构

```
src/
├── main.ts                        # 插件入口，生命周期，命令注册
├── settings.ts                    # 设置界面与默认值
├── api/
│   ├── types.ts                   # SP API 类型定义
│   └── superProductivityApi.ts    # SP REST API 客户端
├── sync/
│   ├── obsidianTaskParser.ts      # Markdown checkbox 解析/修改
│   └── taskSyncService.ts         # 核心同步引擎
└── utils/
    ├── constants.ts               # 常量定义
    └── deepLink.ts                # Obsidian URI 生成
```

### 构建

```bash
npm install
npm run dev    # 开发模式（监听文件变化）
npm run build  # 生产构建
npm run lint   # ESLint 检查
```

## 安装

1. 在 Obsidian 中启用插件
2. 在 Super Productivity 中启用 **Settings → Misc → Enable local REST API**
3. 在插件设置中填写 SP API 地址（默认 `http://127.0.0.1:3876`）
4. 点击「测试连接」确认
