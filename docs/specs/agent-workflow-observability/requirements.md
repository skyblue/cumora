# Cumora Agent Workflow 可观测性需求

状态：Draft  
范围：Desktop Agent Workflow、Task 执行序列、Agent CLI 会话输出

## 1. 目标与对象边界

Cumora 需要把一次用户请求的协作过程完整呈现为：

```text
用户请求
  -> Workflow 编排
  -> Agent 节点分配多个 Task
  -> 每个 Task 的 Run
  -> Agent Session / CLI 输出
```

Workflow 图是一个包含 Agent 节点和 Task 节点的异构图。Agent 是执行者，Task 是可验收的工作项；Run 和 Session 是 Task 节点上的执行信息，不在 V1 中与 Agent/Task 并列成主流程节点。

```text
                   ┌── Agent A ── assigned ── Task A ──┐
Workflow request ──┤                                    ├── Task C
                   └── Agent B ── assigned ── Task B ──┘
                                      Task A ── depends_on ──> Task C
```

对象必须分开：

| 对象 | 含义 | 关键关系 |
| --- | --- | --- |
| Workflow | 一次完整的协作编排 | 包含多个 Task |
| Agent | Cumora 中的 Agent participant | 可负责或协作多个 Task |
| Task | 可分配、可验收的逻辑工作项 | 属于一个 Workflow，可有多个 Run |
| Run | Task 的一次执行尝试 | 关联一个 Task 和一个 Agent |
| Session | Agent CLI 的一次底层会话 | 关联一个 Run，保存 CLI 输出 |

`conversationId` 和 `runId` 只能作为上下文或执行记录，不能替代 `workflowId`、`taskId` 之间的关系。历史上没有显式 Workflow/Task 关联的 Run 应显示在“未关联活动”中，不应按会话或时间自动猜测归属。

## 2. Workflow 视图接入点与触发方式

### 2.1 接入点

首版接入 Cumora 现有 Agent Observability/活动区域，增加 `Workflow` 入口。右侧主区域必须是截图所示的只读 Workflow 图，而不是单纯的 Run 列表。Workflow、Task、Agent 关系由后端和 Agent 协作事件产生，页面只负责展示和定位详情：

- 左侧保留 Agent、状态、自动刷新等筛选能力。
- 右侧显示当前 Workflow 的 Agent/Task 关系图：Agent 节点与 Task 节点分层或分泳道排列。
- Agent 节点显示名称、角色、在线/工作状态和当前负责的 Task 数量。
- Task 节点显示标题、负责人、Task 状态、依赖满足情况和最近 Run 状态。
- Agent → Task 的连线表示 `assigned_to`；Task → Task 的箭头表示 `depends_on`。两种连线必须使用不同样式。
- 一个 Agent 可以负责多个 Task；一个 Task 可以有一个 owner 和多个 supporter，关系必须显式记录。
- 点击 Agent 节点进入 Agent 活动/Trace；点击 Task 节点进入 Task 详情和内部 Sequence；点击 Task 上的 Run 状态进入对应 Trace。
- 从 Task 节点进入 Task 详情；从 Run 状态进入已有 Trace 详情；从 Session 进入 CLI 视图。
- 对话或任务详情页只提供“查看 Workflow”入口，不复制一套流程图。
- 页面不提供创建 Task、分配 Agent、添加依赖、删除节点、拖拽连线或重排 DAG 的操作。
- 没有明确 Workflow 的历史 Run 进入 `Unlinked activity`，不混入 Task DAG。

后续若需要截图中的右侧活动抽屉，可复用同一 Workflow 组件和 API，不另建数据模型。

### 2.2 触发方式

Workflow 必须由明确事件创建或恢复：

1. 用户提交需要多 Agent 协作的请求时，创建一个 Workflow。
2. Planner 拆解出 Task 时，将 Task 挂入该 Workflow，并写入依赖关系。
3. 用户直接创建单个 Task 时，也创建单 Task Workflow，避免单任务走另一套模型。
4. Agent 接受或开始 Task 时，更新 Task/Workflow 状态并产生实时事件。
5. 用户从会话、Task 或历史记录打开页面时，只按显式 `workflowId` 恢复，不创建新 Workflow。

推荐事件：

```text
workflow.created
task.created
task.dependency_added
task.assigned
task.started
task.run_started
task.run_finished
workflow.completed / workflow.failed
```

### 2.3 默认展示规则

- 当前正在运行的 Workflow 优先。
- 没有运行中的 Workflow 时，显示最近一次 Workflow。
- 没有 Workflow 时，显示空状态，并提示从对话或 Agent 协作流程产生 Workflow。
- 页面更新优先使用 WebSocket/SSE；连接不可用时才使用有限频率轮询。
- 状态更新必须是幂等的，重复事件不能产生重复 Task 或 Run。

### 2.4 Workflow 图数据与节点要求

图的数据关系至少包括：

```text
workflowId
agentId <-> taskId       // assigned_to，owner/supporter
taskId -> taskId         // depends_on，阻塞关系
taskId -> runId          // executes，执行尝试
runId -> sessionId       // backed_by，底层 CLI 会话
```

要求：

- `assigned_to` 和 `depends_on` 都必须是后端持久化关系，不能由前端按时间、会话或 Agent 状态推断。
- `depends_on` 必须禁止环路；Task 只有在所有阻塞依赖完成后才能进入可执行状态。
- Agent 节点来自 Cumora participant；Task 节点来自 Workflow 下的 Task，不复制一份 Agent 或 Task 数据。
- Run/Session 的最新状态以徽标、进度条或节点详情附着在 Task 上；V1 不把它们画成第三类主节点。

每个 Agent 节点至少显示：

- Agent 名称和角色
- 在线、空闲、工作、离线状态
- owner/supporter 任务数量
- 当前执行中的 Task

每个 Task 节点至少显示：

- Task 标题
- owner Agent 和 supporter Agent
- `open / doing / done / dropped / blocked` 状态
- 依赖是否满足
- 当前 Run 状态和最近更新时间
- 失败、阻塞或等待原因

布局要求：

- 默认按 Workflow 阶段从左到右排列，阶段内可并行显示多个 Agent/Task。
- 图可滚动；如节点数量较多，可提供缩放，但不提供编辑模式。节点标题、Agent 名称和状态不能只用 `t1`、`t2` 等内部 ID 表示。
- 选中节点时高亮其相关 Agent、Task、依赖边和当前 Run。
- 连线只表示显式 `assigned_to` 或 `depends_on`。不得用创建时间、消息顺序或共享会话推断依赖。
- 所有节点、连线和状态均为只读；修改必须通过已有的对话、Planner、Agent CLI 或后端编排流程完成。

## 3. 单个 Task 的 Think / Tool Call 序列视图

### 3.1 入口与布局

点击 Workflow 中的 Task 节点后进入 Task 详情，详情至少包含：

- `Overview`：Task 基本信息、状态、Agent、Workflow 位置
- `Sequence`：Task 内部的执行序列图
- `CLI`：底层 Agent CLI 会话输出

序列视图采用成熟的垂直 Timeline/Trace 风格，而不是把所有内容堆进聊天消息流：

```text
Task queued
  -> Session opened
  -> Think summary
  -> Tool call: search
  -> Tool result: exit=0, duration=1.2s
  -> Think summary
  -> Tool call: write_file
  -> Tool result
  -> Final response
  -> Task completed
```

### 3.2 事件要求

每个事件必须有稳定顺序和来源：

```text
eventId, taskId, runId, sessionId, sequence,
kind, status, title, summary, data,
startedAt, finishedAt, durationMs
```

事件类型至少包括：

- `task.queued`
- `session.opened`
- `think.started`
- `think.summary`
- `tool.started`
- `tool.stdout`
- `tool.stderr`
- `tool.finished`
- `message.sent`
- `run.retrying`
- `task.completed`
- `task.failed`

展示要求：

- 按 `sequence` 排序，支持实时追加，不重新排列已经展示的历史事件。
- Think 节点显示安全的进度摘要、当前目标和下一步，不显示模型隐藏的完整 Chain of Thought。
- Tool Call 节点显示工具名、参数摘要、开始/结束时间、耗时、退出码和结果摘要。
- 大型参数、stdout、stderr 默认折叠，支持展开、复制和查看原始 JSON。
- Tool Call 的失败必须在序列图中保留，不能只显示最终 Task 失败。
- 并行 Tool Call 需要显示同一父步骤下的分支，并以全部分支完成作为该阶段完成条件。
- Retry 产生新的 Run，不覆盖旧 Run；用户可以切换查看不同尝试。
- 断线重连后按游标补齐事件，不能重复显示事件。

### 3.3 状态与颜色

Task 状态、Run 状态、Tool 状态必须分开：

- Task：`open / doing / done / dropped / blocked`
- Run：`queued / running / completed / failed / cancelled`
- Tool：`pending / running / succeeded / failed`

不能直接用 Run 的 `completed` 覆盖 Task 的 `done`；Task 是否完成还需要满足验收条件和依赖关系。

## 4. Task Session ID 与 Agent CLI 视图

### 4.1 ID 关系

Task 详情中必须明确展示并支持复制：

```text
workflowId
taskId
runId
sessionId
agentId
```

关系约束：

- 一个 Task 可以有多个 Run。
- 一个 Run 对应一个 Session；如果底层 CLI 重连或恢复，Session ID 保持不变。
- 一个 Session 只属于一个 Run，避免不同 Task 的输出串线。
- Session 的退出码、结束原因和最后心跳必须持久化。

### 4.2 CLI 视图

`CLI` 视图提供 Agent CLI 的低层、只读输出：

- 显示命令、工作目录、Worktree/分支、Agent、Provider/Model、启动时间、结束时间、退出码。
- 分离 stdout 和 stderr，并保留每行的时间戳或事件序号。
- 支持实时跟随、暂停跟随、搜索、复制、下载原始日志。
- 支持 ANSI 颜色和基本终端格式；无法渲染的控制字符必须安全转义。
- 输出过大时采用虚拟列表和游标分页，不一次性加载完整日志。
- 页面刷新或断线后可根据 `sessionId + cursor` 继续读取。
- CLI 输出与 Sequence 事件互相定位：点击 Tool Call 可跳到对应输出范围，点击输出可回到对应事件。
- V1 不提供向正在运行的 CLI 注入输入、执行任意命令、重启或取消 Session 的能力；这些属于后续受权限控制的操作。

CLI 原始输出不等于模型隐藏思维。展示范围是 Agent CLI 实际产生的 stdout/stderr 和结构化事件；服务端必须在持久化和返回前做 Token、密钥、Cookie、Authorization Header、环境变量等敏感信息脱敏。

### 4.3 推荐接口

```text
GET  /workflows/:workflowId
GET  /workflows/:workflowId/tasks
GET  /tasks/:taskId
GET  /tasks/:taskId/runs
GET  /runs/:runId/events?cursor=...
GET  /sessions/:sessionId/output?cursor=...
WS   /sessions/:sessionId/stream
```

Workflow API 返回 Task 和 dependency；Task API 返回 Run；Run API 返回 Sequence；Session API 返回 CLI output。各层不把下一层的数据复制成另一套事实来源。

## 5. MVP 验收标准

- 用户创建一次协作请求后，能看到一个有稳定 `workflowId` 的 Workflow。
- Workflow 图中的每个节点都是实际 Task，连线都是显式 dependency。
- 点击 Task 能看到 Agent、Task 状态、当前/历史 Run 和完整 Sequence。
- Sequence 能区分 Think summary、Tool Call、Tool Result、stdout、stderr、最终结果。
- 点击 CLI 能看到对应 `sessionId` 的实时和历史底层输出。
- Run 重试不会覆盖旧记录；刷新和断线重连不会重复或丢失事件。
- 无法关联 Workflow 的旧 Run 会进入未关联活动，不会被静默归入某个 Task。
- 不暴露隐藏 Chain of Thought，不泄露命令参数、环境变量和 CLI 输出中的敏感信息。

## 6. 非目标

- 当前阶段不实现 DAG 编辑器，也不提供任何 Workflow/Task 图内编辑操作。
- V1 不把 conversation、message、run 自动推断成 Task dependency。
- V1 不提供 CLI 交互控制、取消、重试按钮；先完成可观测性闭环。
- V1 不要求把所有历史 Run 迁移成虚假的 Workflow/Task 关系。
