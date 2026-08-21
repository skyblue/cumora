export const DEV_MOCK_USER_ID = 'yetone'
export const DEV_MOCK_COMPANY_ID = 'personal'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** The mock session is intentionally limited to the local development server. */
export function isDevMockAuthEnabled(nodeEnv: string, publicOrigin: string, remoteAddress = ''): boolean {
  if (nodeEnv !== 'development') return false
  try {
    const remoteHost = remoteAddress.replace(/^::ffff:/, '')
    return LOCAL_HOSTS.has(new URL(publicOrigin).hostname)
      && (!remoteAddress || LOCAL_HOSTS.has(remoteHost))
  } catch {
    return false
  }
}
