const LAST_SESSION_KEY = 'xnc:last_session'

export type LastSessionRecord = {
  userId: number
  sessionId: number | null
}

export function readLastSession(): LastSessionRecord | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<LastSessionRecord>
    if (typeof parsed.userId !== 'number') {
      return null
    }
    if (parsed.sessionId != null && typeof parsed.sessionId !== 'number') {
      return null
    }
    return { userId: parsed.userId, sessionId: parsed.sessionId ?? null }
  } catch {
    return null
  }
}

export function saveLastSession(userId: number, sessionId: number | null) {
  try {
    const record: LastSessionRecord = { userId, sessionId }
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(record))
  } catch {
    /* 写不进 localStorage 时保持当前页的会话，不打断聊天 */
  }
}
