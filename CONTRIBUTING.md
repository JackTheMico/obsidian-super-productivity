# Contributing / 贡献指南

Thanks for your interest in contributing to **Obsidian Super Productivity Sync**!
This document provides guidelines and workflows for contributors.

感谢你对 **Obsidian Super Productivity Sync** 的兴趣！本文档为贡献者提供指南和工作流程。

---

## Table of Contents / 目录

- [Code of Conduct / 行为准则](#code-of-conduct--行为准则)
- [How Can I Contribute? / 我能如何贡献？](#how-can-i-contribute--我能如何贡献)
- [Development Setup / 本地开发环境](#development-setup--本地开发环境)
- [Project Structure / 项目结构](#project-structure--项目结构)
- [Coding Conventions / 代码规范](#coding-conventions--代码规范)
- [Pull Request Process / PR 流程](#pull-request-process--pr-流程)
- [Commit Guidelines / Commit 规范](#commit-guidelines--commit-规范)
- [Release Process / 发布流程](#release-process--发布流程)

---

## Code of Conduct / 行为准则

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
By participating, you agree to uphold its standards.

本项目遵循 [贡献者公约](./CODE_OF_CONDUCT.md)。参与即表示你同意遵守其标准。

---

## How Can I Contribute? / 我能如何贡献？

### Report Bugs / 报告缺陷

Before reporting, check [existing issues](https://github.com/anomalyco/obsidian-super-productivity/issues)
to avoid duplicates. When filing a bug report, include:

在报告前请先查看[已有 issue](https://github.com/anomalyco/obsidian-super-productivity/issues)
以避免重复。报告缺陷时请包含：

- Plugin version / 插件版本
- Obsidian version / Obsidian 版本
- OS version / 操作系统版本
- Super Productivity version / Super Productivity 版本
- Steps to reproduce / 复现步骤
- DevTools console logs (if any) / 开发者工具控制台日志（如有）
- Whether SP REST API is enabled / SP REST API 是否已启用

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.yml).

请使用[缺陷报告模板](.github/ISSUE_TEMPLATE/bug_report.yml)。

### Suggest Features / 建议功能

Open a [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml).
Note that the Super Productivity REST API is **read-only** for tags and projects,
so features requiring tag/project creation via API are not feasible.

请提交[功能请求](.github/ISSUE_TEMPLATE/feature_request.yml)。
注意 Super Productivity REST API 对标签和项目是**只读**的，因此依赖 API 创建标签/项目的功能无法实现。

### Submit Code / 提交代码

Follow the [Pull Request Process](#pull-request-process--pr-流程) below.

请遵循下方的 [PR 流程](#pull-request-process--pr-流程)。

---

## Development Setup / 本地开发环境

### Prerequisites / 前提条件

- **Node.js** 18+ (LTS recommended)
- **npm** (ships with Node.js)
- **Super Productivity** running locally with REST API enabled
  (**Settings → Misc → Enable local REST API**)
- **Obsidian** for manual testing

### Setup Steps / 设置步骤

```bash
# 1. Clone the repository / 克隆仓库
git clone https://github.com/anomalyco/obsidian-super-productivity.git
cd obsidian-super-productivity

# 2. Install dependencies / 安装依赖
npm install

# 3. Start dev build (watch mode) / 启动开发构建（监听模式）
npm run dev

# 4. In Obsidian, load the plugin from your vault's plugins folder:
#    在 Obsidian 中，从 vault 的插件目录加载：
#    <your-vault>/.obsidian/plugins/obsidian-super-productivity/
#    Copy main.js, manifest.json, styles.css to that directory.
#    Reload Obsidian and enable the plugin.
```

The dev build will recompile `main.js` on every source change.
You can use a symlink or a copy script to sync `main.js` to your Obsidian vault.

开发构建会在源文件变化时重新编译 `main.js`。
可以使用符号链接或复制脚本将 `main.js` 同步到你的 Obsidian vault。

### Lint / 代码检查

```bash
npm run lint
```

Always run lint before committing. The CI will also check every PR.

提交前务必运行 lint。CI 也会检查每个 PR。

### Build / 构建

```bash
npm run build
```

Produces the production `main.js` (minified).

生成生产环境使用的 `main.js`（压缩版）。

---

## Project Structure / 项目结构

```
src/
├── main.ts                        # Entry point, lifecycle, command registration
├── settings.ts                    # Settings UI and defaults
├── api/
│   ├── types.ts                   # SP API type definitions
│   └── superProductivityApi.ts    # SP REST API client
├── sync/
│   ├── obsidianTaskParser.ts      # Markdown checkbox parsing & modification
│   └── taskSyncService.ts         # Core sync engine (push, poll, write-back)
├── ui/
│   └── spSuggest.ts               # Editor autocomplete for @tag/@due/@project
└── utils/
    ├── constants.ts               # Regex constants
    ├── deepLink.ts                # Obsidian deep link URI generation
    └── taskFields.ts              # Tag, date, and project resolution
```

Keep `main.ts` minimal — focus only on plugin lifecycle and command registration.
Add new features by creating new modules under `src/`.

保持 `main.ts` 精简——只关注插件生命周期和命令注册。
通过创建 `src/` 下的新模块来添加功能。

---

## Coding Conventions / 代码规范

### TypeScript

- Use **strict TypeScript** (`"strict": true` in `tsconfig.json`)
- Prefer `async/await` over promise chains
- No `any` types unless absolutely necessary; prefer `unknown` and type guards
- Use clear, descriptive names (no abbreviations except well-known ones like `id`, `url`, `api`)

### Code Style / 代码风格

- **2-space indentation** (configured in `eslint.config.mts`)
- **Semicolons** required
- Follow existing patterns when adding new features

### UI Text / 界面文字

- Use **sentence case** for all user-facing UI strings (first word capitalized, rest lowercase)
- Exception: proper nouns like "Super Productivity", acronyms like "API", "URL", "ID"
- Chinese descriptions: use `sp` (lowercase) when referring to Super Productivity
- Example: `"Test super productivity connection"` not `"Test Super Productivity Connection"`

### Imports / 导入

- Group imports: external (obsidian, etc.) first, then internal (`../`, `./`)
- No unused imports

### File Organization / 文件组织

- Split functionality into separate modules rather than putting everything in `main.ts`
- Each file should have a single, well-defined responsibility
- Keep files under ~200-300 lines; split if exceeded

### Bundle / 打包

- Do NOT import Node.js or Electron APIs — the plugin must work on mobile
- Everything must bundle into `main.js` via esbuild
- No runtime dependencies outside what esbuild bundles

---

## Pull Request Process / PR 流程

1. **Branch**: Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Develop**: Make your changes. Keep commits atomic and well-described.

3. **Test**: Manually test in Obsidian with Super Productivity running.

4. **Lint & Build**: Ensure both pass:
   ```bash
   npm run lint
   npm run build
   ```

5. **Commit**: Follow [Commit Guidelines](#commit-guidelines--commit-规范).

6. **Push & PR**:
   ```bash
   git push -u origin feat/your-feature-name
   ```
   Then open a Pull Request using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
   使用 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 提交 Pull Request。

7. **CI**: Ensure CI checks (lint, build) pass on your PR.

8. **Review**: Address reviewer feedback. Once approved, the PR will be merged.

### PR Checklist / PR 自检清单

- [ ] `npm run build` passes
- [ ] `npm run lint` passes (no new errors)
- [ ] Tested in Obsidian with SP running
- [ ] Updated `README.md` / docs if needed
- [ ] Followed coding conventions
- [ ] Used sentence case for UI text

---

## Commit Guidelines / Commit 规范

We recommend [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>
```

Types / 类型:

| Type       | Usage / 用途                         |
|------------|--------------------------------------|
| `feat`     | New feature / 新功能                  |
| `fix`      | Bug fix / 缺陷修复                    |
| `docs`     | Documentation / 文档                  |
| `refactor` | Code restructuring / 代码重构          |
| `test`     | Tests / 测试                          |
| `chore`    | Build/config/tooling / 构建/配置/工具  |
| `style`    | Formatting (no logic change) / 格式化  |

Examples / 示例:

```
feat: add @tag syntax for editor autocomplete
fix: handle g-flag regex crash in extractInlineField
docs: add CONTRIBUTING guide
refactor: split taskSyncService into smaller methods
```

For breaking changes, add `!` after the type / 破坏性变更在类型后加 `!`:

```
feat!: drop support for Obsidian <1.0
```

---

## Release Process / 发布流程

Maintainers use the following process:

1. Update `version` in `manifest.json` (SemVer)
2. Run `npm run build`
3. Create a Git tag matching the version
4. Push the tag → GitHub Actions creates a draft release
5. Publish the release, attaching `main.js`, `manifest.json`, `styles.css`

For users, see the [README](./README.md#installation--安装) for installation instructions.

使用者请参阅 [README](./README.md#installation--安装) 的安装说明。
