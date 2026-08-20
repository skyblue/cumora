export interface EngineSessionEvent {
  kind: 'engine.session'
  level: 'info'
  title: string
  data: { engine: 'claude' | 'codex'; sessionId: string }
  stage: 'engine_session'
}

export interface EngineSessionEventInput {
  engine: string
  sessionId: string | null | undefined
}

/** Build the only session payload that is safe to persist in agent_events. */
export function buildEngineSessionEvent(input: EngineSessionEventInput): EngineSessionEvent | null {
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : ''
  if (!sessionId || (input.engine !== 'claude' && input.engine !== 'codex')) return null
  const engine = input.engine
  const label = engine[0].toUpperCase() + engine.slice(1)
  return {
    kind: 'engine.session',
    level: 'info',
    title: `${label} engine session available`,
    data: { engine, sessionId },
    stage: 'engine_session',
  }
}

export interface PreviousEngineSession {
  runId: string
  sessionId: string
}

/** Session ids are recorded at most once per run. A reset passes no id, so it
 * cannot accidentally re-publish the invalid target that was just discarded. */
export function shouldRecordEngineSession(args: {
  runId: string | null | undefined
  sessionId: string | null | undefined
  previous: PreviousEngineSession | null
}): boolean {
  const sessionId = typeof args.sessionId === 'string' ? args.sessionId.trim() : ''
  if (!args.runId || !sessionId) return false
  return args.previous?.runId !== args.runId || args.previous.sessionId !== sessionId
}
