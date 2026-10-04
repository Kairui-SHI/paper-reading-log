# Paper Reading Log

一个使用 GitHub Pages 发布的个人论文阅读日志。每天的记录以 Markdown
保存，首页会自动按日期展示。

## 如何添加记录

最方便的方式是在网站首页点击“写今天的记录”，直接使用 GitHub 网页编辑器。
正文没有固定格式，可以自由写一段话、列表、公式或任意 Markdown 内容。文件顶部只需
保留标题和日期等用于网页展示的信息。

也可以复制 [`templates/paper-note.md`](templates/paper-note.md)，将副本保存到 `_notes`，
例如 `_notes/2026-10-04-paper-title.md`。保存提交后首页会自动更新。

建议文件名使用 `YYYY-MM-DD-short-title.md`，方便按日期查找。

## 目录结构

```text
paper-reading-log/
├── _layouts/
├── _notes/
├── assets/css/
├── README.md
└── templates/
    └── paper-note.md
```

## 发布

在仓库的 **Settings → Pages** 中选择 **Deploy from a branch**，分支选择
`main`，目录选择 `/ (root)` 即可。
