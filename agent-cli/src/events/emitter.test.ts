import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emitRuntimeEvent, type RuntimeEvent, type RuntimeFetch } from './emitter.js'

const event: RuntimeEvent = {
  runId: 'run-123',
  kind: 'engine.session',
  level: 'info',
  title: 'Claude engine session available',
  data: { engine: 'claude', sessionId: 'session-123' },
  stage: 'engine_session',
}

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response
}

test('emits a runtime event with the authenticated JSON contract', async () => {
  const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = []
  const fetchImpl: RuntimeFetch = async (input, init) => {
    requests.push({ input, init })
    return response(200)
  }

  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example/',
    token: 'runtime-token',
    event,
    fetchImpl,
  }), true)
  assert.equal(requests.length, 1)
  assert.equal(String(requests[0].input), 'http://dev.example/runtime/events')
  assert.equal(requests[0].init?.method, 'POST')
  assert.deepEqual(requests[0].init?.headers, {
    Authorization: 'Bearer runtime-token',
    'Content-Type': 'application/json',
  })
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), event)
})

test('retries one transient 5xx and succeeds without blocking on a fixed delay', async () => {
  const statuses = [500, 200]
  let sleeps = 0
  const fetchImpl: RuntimeFetch = async () => response(statuses.shift() ?? 200)

  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example',
    token: 'runtime-token',
    event,
    fetchImpl,
    sleep: async () => { sleeps += 1 },
  }), true)
  assert.equal(sleeps, 1)
})

test('does not retry a client error and drops a persistent server error', async () => {
  let calls = 0
  const fetchImpl: RuntimeFetch = async () => {
    calls += 1
    return response(400)
  }
  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example',
    token: 'runtime-token',
    event,
    fetchImpl,
  }), false)
  assert.equal(calls, 1)

  calls = 0
  const persistentFailure: RuntimeFetch = async () => {
    calls += 1
    return response(503)
  }
  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example',
    token: 'runtime-token',
    event,
    fetchImpl: persistentFailure,
    sleep: async () => {},
  }), false)
  assert.equal(calls, 2)
})

test('drops malformed run ids and network failures without throwing', async () => {
  let calls = 0
  const fetchImpl: RuntimeFetch = async () => {
    calls += 1
    throw new Error('socket closed')
  }
  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example',
    token: 'runtime-token',
    event: { ...event, runId: '   ' },
    fetchImpl,
  }), false)
  assert.equal(calls, 0)
  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example',
    token: 'runtime-token',
    event,
    fetchImpl,
  }), false)
  assert.equal(calls, 1)
})

test('drops events when the runtime token is missing', async () => {
  let calls = 0
  const fetchImpl: RuntimeFetch = async () => {
    calls += 1
    return response(200)
  }

  assert.equal(await emitRuntimeEvent({
    serverUrl: 'http://dev.example',
    token: '  ',
    event,
    fetchImpl,
  }), false)
  assert.equal(calls, 0)
})
