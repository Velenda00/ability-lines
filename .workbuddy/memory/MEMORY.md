# 能力线 → 再塑法典 项目背景

## 项目概述
用户V酱的个人成长管理系统。V2版全局更名为"再塑法典"。
三大模块：思维枷锁-破 / 核心能力-铸 / 风采展示-显

## 技术栈
- 网页端 PWA（纯HTML/CSS/JS）
- IndexedDB本地存储
- GitHub Pages部署
- 小米13手机为主

## 核心架构
```
能力（可自定义命名）
  └── 专项
        ├── 行动（+ 备注 + 关联待办）
        ├── 问题（+ 备注 + 关联待办）
        ├── 学习（+ 备注）
        ├── 过程（已完成待办归档）
        └── 总结
```

## 数据模型（V2.1）
- 条目：note, createdFromTodoId, relatedProcessId, relatedTodoId（双向关联待办）
- 待办：note, generatedEntryIds, sourceThoughtId（来源思绪）
- 思绪：importance（权重）, note（备注）, relatedCapId/ProjId/EntryType/EntryId/TodoId（支持关联到具体条目）
- 解放脑/外交墙：importance（权重）
- 命名配置：新增homeTitle（首页标题独立控制，默认跟随topLevel）

## Git管理
- 开发目录：D:\VIBE\能力线
- Git目录：D:\VIBE\ability-lines
- 工作流：改能力线文件 → 同步到ability-lines → 双击git_setup.bat → 自动部署
- ⚠️ V酱要求不要自动上传，等她确认后再手动同步

## 开发状态
- 2026-05-06 V1：初始版本开发完成并部署
- 2026-05-08 V2更新：重命名、思绪关联、备注、排序修复、待办关联显示
- 2026-05-08 V2.1修复：恢复思绪权重、行为关联已完成待办、关联双向显示（含图标）、全排序统一、首页标题解耦
