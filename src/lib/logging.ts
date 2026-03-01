import { API_CONFIG } from '@/config/api'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogPayload {
  source: string
  event: string
  level: LogLevel
  details?: Record<string, unknown>
  timestamp: string
}

const LOG_ENDPOINT = `${API_CONFIG.BASE_URL}/api/logs`

/**
 * Forward no-due flow events to the backend so they appear in the terminal logs.
 */
export function logNoDueEvent(
  event: string,
  details?: Record<string, unknown>,
  level: LogLevel = 'info'
): void {
  const payload: LogPayload = {
    source: 'no-due-flow',
    event,
    level,
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
  }

  fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn('[logNoDueEvent] Failed to forward log', error)
    }
  })
}
