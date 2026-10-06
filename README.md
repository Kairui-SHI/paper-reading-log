# Paper Reading Log

一个使用 GitHub Pages 发布的个人论文阅读日志。每天的记录以 Markdown
保存，首页会自动按日期展示。

## 如何添加记录

## 本地编辑室

在仓库目录首次运行 `npm install`，之后运行 `npm start`，浏览器打开
<http://127.0.0.1:4317>。也可双击 `editor/start-editor.cmd`。

左侧可以搜索、新建或选择笔记，中间编辑 Markdown，右侧实时预览。支持图片链接、表格和
`$...$` / `$$...$$` 数学公式。按 Ctrl / Cmd + S 保存草稿。

点击「整理格式」可规范纯文本标题、列表和段落空行，整理结果会先显示在编辑区和预览中，
不会自动保存或发布。点击「撤销整理」可恢复整理前的正文。该按钮不调用 AI、不改写观点；
代码块、数学公式和已有表格会保留。

草稿保存在本机 `.editor-drafts`，不会出现在网站上。发布按钮会写入 `_notes` 并推送 GitHub。
默认使用本机 Git 登录；如果未配置，在「发布设置」输入仅授权此仓库 Contents 读写权限的
GitHub fine-grained token。令牌只在当前页面内存中使用，不写入文件。
远程笔记发生变化时会拒绝覆盖，请先同步仓库后重新载入笔记。

编辑室仅在本机运行，不会作为公开写入入口部署到 GitHub Pages。

## 在聊天中记录

正文没有固定格式，可以自由写一段话、列表、公式或任意 Markdown 内容。文件顶部只需
保留标题和日期等用于网页展示的信息。日常记录可以直接通过 Codex 添加和更新。

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
