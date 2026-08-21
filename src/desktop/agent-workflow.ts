export interface WorkflowRun {
  id: string
  agentName: string
  agentRole: string | null
  status: string
  stage: string | null
  summary: string | null
  error: string | null
  trigger: Record<string, unknown>
  startedAt: string
  updatedAt: string
  durationMs: number
}

export interface WorkflowGraph {
  anchorId: string | null
  source: string
  conversationIds: string[]
  runs: WorkflowRun[]
}

function conversationIds(run: WorkflowRun): string[] {
  const ids = run.trigger.conversationIds
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function sourceOf(run: WorkflowRun): string {
  return typeof run.trigger.source === 'string' && run.trigger.source.length > 0
    ? run.trigger.source
    : 'agent request'
}

/**
 * Agent runs are the durable workflow records Cumora has today. A shared
 * conversation id is the only reliable relationship between parallel runs,
 * so this builds the connected run group without inventing task edges.
 */
export function buildWorkflowGraph(runs: readonly WorkflowRun[], selectedId?: string | null): WorkflowGraph {
  const anchor = runs.find((run) => run.id === selectedId) ?? runs[0]
  if (!anchor) {
    return { anchorId: null, source: 'agent request', conversationIds: [], runs: [] }
  }

  const included = new Set<string>([anchor.id])
  const knownConversationIds = new Set(conversationIds(anchor))
  let changed = true
  while (changed) {
    changed = false
    for (const run of runs) {
      if (included.has(run.id)) continue
      const ids = conversationIds(run)
      if (!ids.some((id) => knownConversationIds.has(id))) continue
      included.add(run.id)
      for (const id of ids) knownConversationIds.add(id)
      changed = true
    }
  }

  return {
    anchorId: anchor.id,
    source: sourceOf(anchor),
    conversationIds: [...knownConversationIds],
    runs: runs.filter((run) => included.has(run.id)),
  }
}
