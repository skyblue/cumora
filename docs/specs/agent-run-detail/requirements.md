---
feature: agent-run-detail
workflow: orca-feat-builder
created: 2026-08-21
status: approved
approved_by: yetone
approved_at: 2026-08-21
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
5. 用户点击 Copy all logs 时，系统应将当前 run 的全部已持久化事件按原始时间顺序复制到剪切板，不得只复制当前筛选结果，并应对成功和剪切板权限失败给出反馈。
6. 详情区域应明确区分未选中 run、加载中、事件请求失败、暂无事件和筛选结果为空；请求失败时不得用旧 run 的事件冒充当前结果。
7. 自动刷新更新 run 列表或事件时，应按 run id 保持当前选择和筛选状态稳定；当前 run 仍在运行时，耗时应继续从开始时间计算。
8. 详情只能展示当前租户 API 返回的选中 run 及其事件；不存在或不属于当前租户的 run 应沿用现有 not found/权限边界，不得通过详情接口泄漏事件。
9. v0 不新增事件数量上限、分页或截断协议；详情接口返回当前 run 的完整事件集合，未来如需限流或分页应另开后端设计并同步更新复制语义。

### US-2: 从详情连接到对应的 Agent CLI 会话

**As a** 需要诊断 BYOA Agent 的开发者

**I want** 在 Run 详情中看到 engine session id，并获得对应 CLI 的 resume 命令

**so that** 我可以在本地 Claude 或 Codex CLI 中 attach 到同一上下文做底层观察。

**Acceptance Criteria**:

1. BYOA Claude/Codex run 在 engine 报告非空且仍有效的 session id 后，应在该 run 详情中显示 engine 和 session id；同一 run 只展示最新有效值。
2. 如果 engine 在本次 run 结束前因 stale resume、上下文溢出或其他明确原因重置 session，详情不得展示被丢弃的旧 id；没有新的有效 id 时显示不可用。
3. 对 Claude，系统应生成可复制的 `claude --resume <id>` 命令；对 Codex，系统应生成可复制的 `codex resume <id>` 命令。
4. 用户点击 resume 命令的复制按钮时，系统只能写入剪切板并显示反馈，不得在桌面或服务器执行该命令。
5. 对旧 daemon、Cumora Cloud、缺少 session id 或不支持 resume 的 engine，系统应显示“不可用/未提供”状态，不得生成伪造 id 或错误命令。

## Non-Goals

- 不实现 Workflow DAG 的编辑、节点操作、重试、停止或其他运行控制。
- 不将原始 chain-of-thought、隐藏 reasoning token 或供应商内部思维内容展示给用户；只允许可观测状态、事件摘要和工具输入/输出。
- 不新增通用实时日志流、跨 Run 聚合查询或新的 Devtools 权限体系；继续使用现有 run/event API 和自动刷新。
- 不在 v0 引入事件数量上限、分页或 `events.truncated` 协议；沿用现有数据库保留策略和详情接口契约。

## 安全与数据边界

- 事件详情和 Copy all logs 必须使用同一份安全投影；不得把原始 `data`、prompt、model output、reasoning、chain-of-thought 或同义字段直接渲染或复制。
- 安全投影按事件类别使用显式字段白名单；未知事件保留事件壳和安全元数据，但未知 payload 不得因为“方便调试”而整体透传。
- 事件标题、run summary 和 error 只作为纯文本展示/复制，不解析 Markdown 或 HTML；事件生产方不得把原始 prompt 或思维内容写入这些字段。
- session 事件只允许保存 engine 和非空 session id，不保存 prompt、token、环境变量、凭据或本地 session 文件内容。
- `engine.session` 事件 contract 固定为 `kind=engine.session`、`level=info`、`title='<Engine> engine session available'`、`stage=engine_session`、`data={engine:'claude'|'codex',sessionId:string}`；`sessionId` 去除首尾空白后必须非空，事件标题不得包含 session id。

## 成功标准

- 聚焦测试覆盖事件排序/筛选、Think 字段过滤、复制边界和 Claude/Codex resume，并在目标环境通过。
- 手工 smoke 能完成一次 run 选择、详情展开、四种筛选、全量复制和键盘操作；自动刷新不会跳选或混用旧事件。
- 至少验证旧 daemon/无 session、session reset、事件请求失败、筛选为空和剪切板失败五类非成功路径，并且 UI 给出明确状态。
- 任意详情或复制路径都不出现原始 prompt、model output、chain-of-thought、凭据或本地 session 文件内容；未知事件 payload 不整体透传。

## 下游依赖

- `docs/specs/cumora-self-evolve/` 的 `observe.ts` 可以只读消费 `agent_runs`/`agent_events` 作为观测源，但不得依赖前端投影或 daemon 本地文件；本 spec 的 event kind 和 session contract 是下游需要遵守的稳定边界。

## Open Questions

- None.
