---
name: update-readme-after-changes
description: Summarize user-facing changes after code modifications and propose concise, paste-ready updates for README.md. Use when the user mentions updating README, maintaining README after code changes, 每次变动代码后更新README, or asks to summarize changes into documentation.
---

# Update README After Changes

## When to Use

Apply this skill when:

- 代码有变更后，用户希望把“值得写进 `README.md` 的更新点”补进去
- 用户说“更新一下 README / 文档 / 使用说明 / feature 列表”
- PR/commit 已完成，需要写对外说明（面向使用者，而不是开发者的内部笔记）

## Default Behavior

- 优先只写 **用户可感知** 的变化：功能、行为、配置、使用方式、兼容性、迁移步骤、已知限制。
- 对纯重构/改目录/改变量名等 **不影响用户使用** 的变动，默认不写进 README（除非它带来性能/体积/稳定性等可说明收益）。
- 输出应当是 **可直接粘贴** 到 `README.md` 的片段（尽量复用现有 README 的标题与语气）。
- 若 README 结构不适合追加，先给出“建议放置位置”（如 Features / Getting Started / .env / Architecture / Changelog）。

## Workflow

1. 收集变更范围（优先看 diff/文件列表/commit 信息），把变更归类到下面几类：
   - 新增/调整功能（Feature）
   - 使用方式变化（Usage）
   - 配置与环境变量（Config / `.env`）
   - API/路由/命令变更（API / CLI）
   - 兼容性与迁移（Breaking / Migration）
   - 性能/稳定性/安全（Perf / Reliability / Security）
2. 从每一类里提炼“用户需要知道的 1–3 个点”：
   - 写 **结果与影响**：用户现在能做什么/需要怎么做/会有什么不同
   - 补最小必要细节：新增的命令、参数、环境变量、入口路径、示例代码
3. 映射到 README 的现有章节：
   - 能挂在已有章节就挂（例如 `.env Updates`、`✨ Features`、`Getting Started`）
   - 如果缺少承载位置，新增一个轻量章节：`## Changelog` 或 `## Updates`
4. 产出可粘贴片段，并保持一致性：
   - 标题风格、列表风格、术语（同一概念不混用多种叫法）
   - 示例尽量短小，避免占据太多 README 篇幅

## What Counts as “Worth Updating”

优先写入：

- 新能力：新增页面、组件、AI 能力、支持的新 provider、流式输出等
- 使用方式变化：启动命令、路由、入口文件、用户交互变化
- 新/变更的环境变量与配置项（尤其是必须设置的）
- Breaking changes：旧用法不再可用、默认行为改变、需要迁移
- 重要修复：影响结果正确性/数据丢失/安全隐患的修复

通常不写入：

- 纯格式化、纯重命名、纯目录整理且不影响使用
- 仅对开发者有意义的细节（除非 README 本身也面向开发者贡献）

## Output Template (Paste-ready)

根据变更类型，选择以下一种或组合输出，直接给出可粘贴 Markdown。

### 1) Add to `✨ Features`

```markdown
### <Feature area>
- <一句话说明新增/变化的能力（面向使用者）>
- <如有必要：限制/默认值/注意事项>
```

### 2) Add to `.env Updates` / Config

```markdown
## .env Updates

```env
<NEW_ENV>=<description_or_example>
```

- <何时必须设置/默认行为>
```

### 3) Add to `Getting Started` / Usage

```markdown
## Getting Started

```bash
<new or updated command>
```

- <关键说明：何时运行/需要什么前置条件>
```

### 4) Add a lightweight `Changelog` section

```markdown
## Updates

### <YYYY-MM-DD>
- **Added**: <新增能力>
- **Changed**: <行为/默认值变化>
- **Fixed**: <关键修复（用户影响）>
- **Breaking**: <破坏性变更与迁移提示（如有）>
```

## Quality Checklist

- 输出能直接粘贴到 `README.md`，不需要读者再猜“怎么用”
- 每条更新都说明 **影响面**（对谁、在什么场景下）
- 避免把内部实现细节当成更新点
- 若存在 breaking change，必须包含 **迁移步骤或替代方案**
