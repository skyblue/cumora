import type { ApiAgentEvent, ApiAgentRun } from '@/api/client'

export type AgentRunEventCategory = 'agent' | 'tool-call' | 'tool-result'

export interface SafeAgentEvent {
  id: string
  runId: string
  agentId: string
  kind: string
  level: ApiAgentEvent['level']
  title: string
  createdAt: string
  category: AgentRunEventCategory
  details: Record<string, unknown>
}

export interface AgentRunSession {
  engine: 'claude' | 'codex'
  sessionId: string
}

const SAFE_AGENT_FIELDS = ['hop', 'attempt', 'model', 'status', 'summary', 'reason', 'reasoningSummary', 'stage', 'responseId']
const SAFE_TOOL_CALL_FIELDS = ['hop', 'callId', 'name', 'tool', 'args', 'arguments', 'status', 'summary', 'reason', 'reasoningSummary']
const SAFE_TOOL_RESULT_FIELDS = [
  ...SAFE_TOOL_CALL_FIELDS,
  'ok',
  'durationMs',
  'display',
  'error',
  'output',
  'result',
]
const SENSITIVE_KEYS = new Set([
  'reasoning',
  'chainofthought',
  'thought',
  'thoughts',
  'rawreasoning',
  'hiddenreasoning',
  'thinking',
  'analysis',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizedKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase()
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizedKey(key))
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]'
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1))
  if (!isRecord(value)) return String(value)
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue
    result[key] = sanitizeValue(item, depth + 1)
  }
  return result
}

export function classifyAgentRunEvent(event: Pick<ApiAgentEvent, 'kind'>): AgentRunEventCategory {
  if (event.kind === 'tool.started') return 'tool-call'
  if (event.kind === 'tool.finished') return 'tool-result'
  return 'agent'
}

export function sortAgentRunEvents(events: ApiAgentEvent[]): ApiAgentEvent[] {
  return [...events].sort((a, b) => {
    const aTime = Date.parse(a.createdAt)
    const bTime = Date.parse(b.createdAt)
    const timeDifference = (Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime) - (Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime)
    return timeDifference || a.id.localeCompare(b.id)
  })
}

function safeDetailsFor(event: ApiAgentEvent, category: AgentRunEventCategory): Record<string, unknown> {
  const data = isRecord(event.data) ? event.data : {}
  if (event.kind === 'engine.session') {
    const engine = data.engine
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : ''
    return {
      ...(engine === 'claude' || engine === 'codex' ? { engine } : {}),
      ...(sessionId ? { sessionId } : {}),
    }
  }
  const fields = category === 'tool-call'
    ? SAFE_TOOL_CALL_FIELDS
    : category === 'tool-result'
      ? SAFE_TOOL_RESULT_FIELDS
      : SAFE_AGENT_FIELDS
  const details: Record<string, unknown> = {}
  for (const field of fields) {
    if (field in data) details[field] = sanitizeValue(data[field])
  }
  return details
}

export function projectObservableEvent(event: ApiAgentEvent): SafeAgentEvent {
  const category = classifyAgentRunEvent(event)
  return {
    id: event.id,
    runId: event.runId,
    agentId: event.agentId,
    kind: event.kind,
    level: event.level,
    title: event.title,
    createdAt: event.createdAt,
    category,
    details: safeDetailsFor(event, category),
  }
}

export function getAgentRunSession(events: ApiAgentEvent[]): AgentRunSession | null {
  for (const event of sortAgentRunEvents(events).reverse()) {
    if (event.kind !== 'engine.session' || !isRecord(event.data)) continue
    const engine = event.data.engine
    const sessionId = typeof event.data.sessionId === 'string' ? event.data.sessionId.trim() : ''
    if ((engine === 'claude' || engine === 'codex') && sessionId) return { engine, sessionId }
  }
  return null
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

export function buildResumeCommand(engine: string | null | undefined, sessionId: string | null | undefined): string | null {
  const id = typeof sessionId === 'string' ? sessionId.trim() : ''
  if (!id) return null
  if (engine === 'claude') return `claude --resume ${shellQuote(id)}`
  if (engine === 'codex') return `codex resume ${shellQuote(id)}`
  return null
}

function safeRunTrigger(trigger: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of ['source', 'engine']) {
    if (field in trigger) result[field] = sanitizeValue(trigger[field])
  }
  return result
}

export function formatAgentRunLogs(run: ApiAgentRun, events: ApiAgentEvent[]): string {
  const payload = {
    run: {
      id: run.id,
      agent: run.agentName,
      role: run.agentRole,
      status: run.status,
      stage: run.stage,
      summary: run.summary,
      error: run.error,
      trigger: safeRunTrigger(run.trigger),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
    },
    events: sortAgentRunEvents(events).map(projectObservableEvent),
  }
  return JSON.stringify(payload, null, 2)
}
