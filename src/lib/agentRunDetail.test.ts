import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ApiAgentEvent, ApiAgentRun } from '@/api/client'
import {
  buildResumeCommand,
  classifyAgentRunEvent,
  formatAgentRunLogs,
  getAgentRunSession,
  projectObservableEvent,
  sortAgentRunEvents,
} from './agentRunDetail'

const run: ApiAgentRun = {
  id: 'run-1',
  agentId: 'agent-1',
  agentName: 'Atlas',
  agentRole: 'Researcher',
  agentAvatarUrl: null,
  companyId: 'company-1',
  status: 'completed',
  stage: 'done',
  summary: 'Finished the task',
  error: null,
  trigger: { source: 'byoa', engine: 'claude' },
  inputMessageIds: [],
  inboxCount: 1,
  toolCallCount: 1,
  tokenCount: 20,
  fingerprint: null,
  startedAt: '2026-08-21T10:00:00.000Z',
  updatedAt: '2026-08-21T10:00:03.000Z',
  finishedAt: '2026-08-21T10:00:03.000Z',
  durationMs: 3000,
}

function event(overrides: Partial<ApiAgentEvent>): ApiAgentEvent {
  return {
    id: 'event-1',
    runId: run.id,
    agentId: run.agentId,
    kind: 'agent.status',
    level: 'info',
    title: 'Agent status',
    data: {},
    createdAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  }
}

test('classifies session, tool, and unknown events without dropping unknown events', () => {
  assert.equal(classifyAgentRunEvent(event({ kind: 'engine.session' })), 'agent')
  assert.equal(classifyAgentRunEvent(event({ kind: 'tool.started' })), 'tool-call')
  assert.equal(classifyAgentRunEvent(event({ kind: 'tool.finished' })), 'tool-result')
  assert.equal(classifyAgentRunEvent(event({ kind: 'turn.compacted' })), 'agent')
})

test('sorts events by createdAt and then id deterministically', () => {
  const events = [
    event({ id: 'z', createdAt: '2026-08-21T10:00:02.000Z' }),
    event({ id: 'b', createdAt: '2026-08-21T10:00:01.000Z' }),
    event({ id: 'a', createdAt: '2026-08-21T10:00:01.000Z' }),
  ]
  assert.deepEqual(sortAgentRunEvents(events).map((item) => item.id), ['a', 'b', 'z'])
  assert.deepEqual(events.map((item) => item.id), ['z', 'b', 'a'])
})

test('projects tool payloads while removing reasoning and chain-of-thought fields', () => {
  const projected = projectObservableEvent(event({
    kind: 'tool.finished',
    title: 'search completed',
    data: {
      callId: 'call-1',
      name: 'search',
      args: { query: 'cumora', thought: 'private plan', nested: { reasoning: 'secret' } },
      output: { results: ['one'], chainOfThought: 'secret' },
      status: 'ok',
      reasoningSummary: 'allowed summary',
    },
  }))

  assert.equal(projected.category, 'tool-result')
  assert.deepEqual(projected.details, {
    callId: 'call-1',
    name: 'search',
    args: { query: 'cumora', nested: {} },
    output: { results: ['one'] },
    status: 'ok',
    reasoningSummary: 'allowed summary',
  })
  assert.doesNotMatch(JSON.stringify(projected), /private plan|secret/)
})

test('agent events expose observable summaries but never raw model input or output', () => {
  const projected = projectObservableEvent(event({
    kind: 'model.response',
    data: {
      hop: 2,
      model: 'gpt-5',
      status: 'completed',
      summary: 'Model completed with a tool call',
      outputText: 'hidden internal output',
      input: [{ role: 'user', content: 'private prompt' }],
      thought: 'hidden thought',
    },
  }))

  assert.deepEqual(projected.details, {
    hop: 2,
    model: 'gpt-5',
    status: 'completed',
    summary: 'Model completed with a tool call',
  })
  assert.doesNotMatch(JSON.stringify(projected), /hidden internal output|private prompt|hidden thought/)
})

test('copy logs always use the full sorted event set, independent of display filtering', () => {
  const events = [
    event({ id: 'tool', kind: 'tool.finished', title: 'tool completed', data: { output: 'kept' }, createdAt: '2026-08-21T10:00:02.000Z' }),
    event({ id: 'agent', kind: 'agent.status', title: 'agent working', data: { summary: 'kept' }, createdAt: '2026-08-21T10:00:01.000Z' }),
  ]
  const filtered = events.filter((item) => classifyAgentRunEvent(item) === 'tool-result')
  const allLogs = formatAgentRunLogs(run, events)
  const filteredLogs = formatAgentRunLogs(run, filtered)

  assert.match(allLogs, /agent working/)
  assert.match(allLogs, /tool completed/)
  assert.ok(allLogs.indexOf('agent working') < allLogs.indexOf('tool completed'))
  assert.doesNotMatch(filteredLogs, /agent working/)
})

test('builds shell-safe Claude and Codex resume commands and rejects unavailable sessions', () => {
  assert.equal(buildResumeCommand('claude', "session id's"), "claude --resume 'session id'\\''s'")
  assert.equal(buildResumeCommand('codex', 'thread-42'), "codex resume 'thread-42'")
  assert.equal(buildResumeCommand('grok', 'thread-42'), null)
  assert.equal(buildResumeCommand('claude', '   '), null)
  assert.equal(buildResumeCommand(null, 'thread-42'), null)
})

test('uses the latest valid session event and ignores missing or unsupported sessions', () => {
  const events = [
    event({ id: 'invalid', kind: 'engine.session', data: { engine: 'claude', sessionId: '' } }),
    event({ id: 'claude', kind: 'engine.session', data: { engine: 'claude', sessionId: 'claude-1' } }),
    event({ id: 'unsupported', kind: 'engine.session', data: { engine: 'grok', sessionId: 'grok-1' } }),
    event({ id: 'codex', kind: 'engine.session', data: { engine: 'codex', sessionId: 'codex-1' } }),
  ]
  assert.deepEqual(getAgentRunSession(events), { engine: 'codex', sessionId: 'codex-1' })
  assert.equal(getAgentRunSession([event({ kind: 'engine.session', data: {} })]), null)
})
