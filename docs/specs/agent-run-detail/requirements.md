---
feature: agent-run-detail
workflow: orca-feat-builder
created: 2026-08-21
---

# Requirements: agent-run-detail

## User Stories

### US-1: 查看单次 Agent Run 的执行详情

**As a** 使用 Cumora Devtools 的开发者

**I want** 选中一个 Agent 的单次 Run 后查看完整但安全的执行详情

**so that** 我可以判断它为什么处于当前状态、执行了哪些工具动作，以及耗时和事件规模是否异常。

**Acceptance Criteria**:

1. 系统应在现有 Agent Observability 运行列表中打开单个 run 的只读详情，并展示运行状态、Agent 名称与角色、run id、Task/stage 或摘要、trigger、创建时间、结束时间（若已结束）、耗时和事件数量。
2. 系统应按事件创建时间升序展示该 run 的 Agent、Tool Call、Tool Result 事件；相同时间的事件应使用事件 id 保持确定性顺序。
3. 用户切换 All、Agent、Tool Call、Tool Result 筛选后，系统应只隐藏不匹配的事件，并在筛选结果为空时显示明确的空状态。
4. 用户展开事件时，系统应展示该事件的状态、标题、工具参数/结果或可观测摘要；Think 内容不得包含原始思维链。
5. 用户点击 Copy all logs 时，系统应将当前 run 的全部事件按原始时间顺序复制到剪切板，不得只复制当前筛选结果，并应对成功和剪切板权限失败给出反馈。

### US-2: 从详情连接到对应的 Agent CLI 会话

**As a** 需要诊断 BYOA Agent 的开发者

**I want** 在 Run 详情中看到 engine session id，并获得对应 CLI 的 resume 命令

**so that** 我可以在本地 Claude 或 Codex CLI 中 attach 到同一上下文做底层观察。

**Acceptance Criteria**:

1. BYOA Claude/Codex run 在 engine 报告非空 session id 后，应在详情中显示 engine 和 session id。
2. 对 Claude，系统应生成可复制的 `claude --resume <id>` 命令；对 Codex，系统应生成可复制的 `codex resume <id>` 命令。
3. 用户点击 resume 命令的复制按钮时，系统只能写入剪切板并显示反馈，不得在桌面或服务器执行该命令。
4. 对旧 daemon、Cumora Cloud、缺少 session id 或不支持 resume 的 engine，系统应显示“不可用/未提供”状态，不得生成伪造 id 或错误命令。

## Non-Goals

- 不实现 Workflow DAG 的编辑、节点操作、重试、停止或其他运行控制。
- 不将原始 chain-of-thought、隐藏 reasoning token 或供应商内部思维内容展示给用户；只允许可观测状态、事件摘要和工具输入/输出。
- 不新增通用实时日志流、跨 Run 聚合查询或新的 Devtools 权限体系；继续使用现有 run/event API 和自动刷新。

## Open Questions

- None.
