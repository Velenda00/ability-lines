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
        ├── 行动/学习（UI合并为"行为区"，数据层保持分离）
        ├── 问题
        ├── 过程（已完成待办归档）
        ├── 收获（原名"总结"）
        └── 关联关系（relations: 手动录入，discover/derive/harvest）
```

## 项目详情页（V3 三区布局）
- 行为区 = entries.action + entries.learning 合并展示
- 问题区 = entries.problem
- 收获区 = entries.review（displayLabel改为"收获"）
- 关联关系：项目级 `relations` 数组，手动录入（非自动推导）
- 关系图：SVG 贝塞尔曲线 + 固定色块节点（绿/橙/金/紫空心）+ 权重影响大小
- 界面特点：有机列表（无卡片边框）、左侧彩色竖线、三区彩色图标标题、浮动按钮

## 数据模型（V2.1）
- 条目：note, createdFromTodoId, relatedProcessId, relatedTodoId（双向关联待办）
- 待办：note, generatedEntryIds, sourceThoughtId（来源思绪）
- 思绪：importance（权重）, note（备注）, relatedCapId/ProjId/EntryType/EntryId/TodoId（支持关联到能力/专项/条目/待办）
- 关联关系（新增）：{id, fromId, toId, type} — type: discover/derive/harvest
- 习惯（V4.0）：text, importance, status(pool/active/archived), sourceType(behavior/liberation/direct), sourceCapId/ProjId/EntryId/EntryType/LiberationId, completedDates[], currentStreak, bestStreak
- 解放脑/外交墙：自由记录
- 命名配置：topLevel/ capability/ insight/ module1/module2/module3 全部可自定义

## Git管理
- 开发目录：D:\VIBE\能力线
- Git目录：D:\VIBE\ability-lines
- 工作流：改能力线文件 → 同步到ability-lines → 双击git_setup.bat → 自动部署
- ⚠️ V酱要求不要自动上传，等她确认后再手动同步

## 开发状态
- 2026-05-06 V1：初始版本开发完成并部署
- 2026-05-08 V2更新：重命名、思绪关联、备注、排序修复、待办关联显示
- 2026-05-08 V2.1：恢复思绪权重、行为关联已完成待办、关联双向显示（含图标）、全排序统一、首页标题解耦、PWA配置修复
- 2026-05-09 V2.2：修复思绪权重排序、能力/专项卡片显示关联思绪、待办权重编辑bug
- 2026-05-11 V2.3：新增GitHub云同步模块（js/sync.js），完全手动模式（拉取/推送按钮），操作前自动备份（最多5份），支持备份恢复
- 2026-05-13 V3.0：项目详情页重构为行为/问题/收获三区有机列表布局，新增relations关联系统，SVG关系图（可拖动）
- 2026-05-14 V3.1：列表显示权重+备注预览、备注支持换行、行动卡片新增创建待办/录入问题、待办tab关联行动树形选择器、关系图缩线+pill文字+鼠标拖动+节点点击+track改蓝色、关联弹窗类型筛选联动、收获-思绪双向同步（归入思绪开关+自动创建收获）、待办进度条放关系图前
- 2026-05-15 V4.0：目标模块替换为每日习惯模块，三tab（进行中/习惯池/归档库），支持每日打卡、连续天数统计、从行为条目/解放脑创建习惯、习惯池激活/归档流转，底部导航第3项改火焰图标
