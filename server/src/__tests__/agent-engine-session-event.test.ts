import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEngineSessionEvent,
  shouldRecordEngineSession,
} from '../agents/computer/session-observability.js'

test('builds a minimal engine.session event for a non-empty Claude/Codex id', () => {
  assert.deepEqual(buildEngineSessionEvent({ engine: 'claude', sessionId: ' claude-1 ' }), {
    kind: 'engine.session',
    level: 'info',
    title: 'Claude engine session available',
    data: { engine: 'claude', sessionId: 'claude-1' },
    stage: 'engine_session',
  })
  assert.deepEqual(buildEngineSessionEvent({ engine: 'codex', sessionId: 'thread-1' })?.data, {
    engine: 'codex',
    sessionId: 'thread-1',
  })
})

test('does not fabricate an event for missing ids or unsupported engines', () => {
  assert.equal(buildEngineSessionEvent({ engine: 'claude', sessionId: null }), null)
  assert.equal(buildEngineSessionEvent({ engine: 'codex', sessionId: '   ' }), null)
  assert.equal(buildEngineSessionEvent({ engine: 'grok', sessionId: 'grok-1' }), null)
})

test('deduplicates an id within a run but permits the same id in a new run', () => {
  assert.equal(shouldRecordEngineSession({ runId: 'run-1', sessionId: 'session-1', previous: null }), true)
  assert.equal(shouldRecordEngineSession({ runId: 'run-1', sessionId: 'session-1', previous: { runId: 'run-1', sessionId: 'session-1' } }), false)
  assert.equal(shouldRecordEngineSession({ runId: 'run-2', sessionId: 'session-1', previous: { runId: 'run-1', sessionId: 'session-1' } }), true)
  assert.equal(shouldRecordEngineSession({ runId: 'run-1', sessionId: null, previous: null }), false)
})

test('does not retain a stale id after a reset', () => {
  const stale = buildEngineSessionEvent({ engine: 'claude', sessionId: 'stale-id' })
  assert.ok(stale)
  assert.equal(shouldRecordEngineSession({ runId: 'run-1', sessionId: null, previous: { runId: 'run-1', sessionId: 'stale-id' } }), false)
})
