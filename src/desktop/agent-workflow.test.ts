import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWorkflowGraph, type WorkflowRun } from './agent-workflow.js'

function run(id: string, conversationIds: string[], source = 'message.new'): WorkflowRun {
  return {
    id,
    agentName: id,
    agentRole: null,
    status: 'completed',
    stage: 'completed',
    summary: null,
    error: null,
    trigger: { source, conversationIds },
    startedAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:01.000Z',
    durationMs: 1000,
  }
}

test('groups runs that are connected through shared conversation ids', () => {
  const graph = buildWorkflowGraph([
    run('run-a', ['conversation-a']),
    run('run-b', ['conversation-a', 'conversation-b']),
    run('run-c', ['conversation-b']),
    run('run-isolated', ['conversation-x']),
  ], 'run-a')

  assert.deepEqual(graph.runs.map((item) => item.id), ['run-a', 'run-b', 'run-c'])
  assert.deepEqual(graph.conversationIds, ['conversation-a', 'conversation-b'])
})

test('keeps runs without conversation context isolated', () => {
  const graph = buildWorkflowGraph([
    run('run-a', []),
    run('run-b', []),
  ], 'run-a')

  assert.deepEqual(graph.runs.map((item) => item.id), ['run-a'])
  assert.equal(graph.source, 'message.new')
})

test('uses the newest run when no run is selected', () => {
  const graph = buildWorkflowGraph([
    run('run-new', ['conversation-a'], 'idle'),
    run('run-old', ['conversation-b'], 'background_scan'),
  ])

  assert.equal(graph.anchorId, 'run-new')
  assert.equal(graph.source, 'idle')
  assert.deepEqual(graph.runs.map((item) => item.id), ['run-new'])
})
