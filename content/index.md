# Markdown 互链示例

这个页面用于演示文档之间的直接跳转能力。

## 站内相对链接

- [跳转到 Linux 命令文档](./docs/linux/command.md)
- [跳转到 Git 文档](./docs/base/git.md)
- [跳转到项目页](./docs/projects/index.md)

## 跨目录与上级路径

- [从当前目录跳到 Claude Code 指南](./docs/claude-code/cc.md)
- [跳转到 Linux 索引](./docs/linux/index.md)

## 锚点跳转

- [跳到本页「注意事项」](#注意事项)
- [跳到网络文档指定章节](./docs/base/network.md#网络配置)

## 外链（会触发 link safety 确认）

- [访问 Streamdown Link Safety 文档](https://streamdown.ai/docs/link-safety)

## 注意事项

1. 站内链接建议统一写成相对路径，优先使用 `.md` 后缀。
2. 章节锚点请和标题保持一致，避免特殊字符过多。
3. 外部链接会弹出安全确认框，这是预期行为。
