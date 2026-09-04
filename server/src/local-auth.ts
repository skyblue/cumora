const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/^::ffff:/, '')
}

export function isLocalAuthBypassEnabled(nodeEnv: string, rawValue: string | undefined): boolean {
  return nodeEnv !== 'production' && /^(true|1|yes|on)$/i.test(rawValue?.trim() ?? '')
}

export function isLocalAuthRequestAllowed(args: {
  nodeEnv: string
  enabled: boolean
  publicOrigin: string
  remoteAddress: string
}): boolean {
  if (!args.enabled || args.nodeEnv === 'production') return false

  try {
    const publicHost = normalizeHost(new URL(args.publicOrigin).hostname)
    const remoteHost = normalizeHost(args.remoteAddress)
    return LOOPBACK_HOSTS.has(publicHost) && LOOPBACK_HOSTS.has(remoteHost)
  } catch {
    return false
  }
}
