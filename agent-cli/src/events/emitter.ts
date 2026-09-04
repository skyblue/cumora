export type RuntimeEventKind =
  | 'engine.session'
  | 'engine.failed'
  | 'tool.started'
  | 'tool.finished'

export type RuntimeEventLevel = 'info' | 'warn' | 'error'

export type RuntimeEventStage =
  | 'engine_session'
  | 'engine_failed'
  | 'tool_started'
  | 'tool_finished'

export type RuntimeEvent = {
  runId: string
  kind: RuntimeEventKind
  level: RuntimeEventLevel
  title: string
  data: Record<string, unknown>
  stage: RuntimeEventStage
}

export type RuntimeFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type EmitRuntimeEventOptions = {
  serverUrl: string
  token: string
  event: RuntimeEvent
  fetchImpl?: RuntimeFetch
  sleep?: (milliseconds: number) => Promise<void>
}

const RETRY_DELAY_MS = 500

function runtimeEventsUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/runtime/events`
}

/**
 * Best-effort producer for events emitted by the local agent daemon. Event
 * capture must not change whether the engine turn succeeds, so malformed
 * events and transport failures are dropped instead of thrown.
 */
export async function emitRuntimeEvent({
  serverUrl,
  token,
  event,
  fetchImpl = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: EmitRuntimeEventOptions): Promise<boolean> {
  if (!event.runId.trim()) return false
  if (!token.trim()) {
    console.warn('[agent-events] dropped event: missing runtime token')
    return false
  }

  const init: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response
    try {
      response = await fetchImpl(runtimeEventsUrl(serverUrl), init)
    } catch (error) {
      console.warn(`[agent-events] event POST failed: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
    if (response.ok) return true
    if (response.status < 500 || attempt === 1) {
      console.warn(`[agent-events] event POST dropped: HTTP ${response.status}`)
      return false
    }
    await sleep(RETRY_DELAY_MS)
  }

  return false
}
