import { readChatStream } from '../hooks/useStreamingChat'
import type { ChatMessage, MusicInfo, ReplyMode } from '../types/chat'
import { createId } from '../utils/createId'
import { addMusicCard, adoptMusicSession, musicSessionKey } from './musicStore'

export type LiveTurn = {
  token: string
  sessionId: number | null
  messages: ChatMessage[]
  agentId: string
  running: boolean
  controller: AbortController
}

type StartArgs = {
  sessionId: number | null
  draftToken: string | null
  messages: ChatMessage[]
  agentId: string
  text: string
  mode: ReplyMode
  onSession: (sessionId: number) => void
  onError?: (err: unknown) => void
}

const bySession = new Map<number, LiveTurn>()
const byDraft = new Map<string, LiveTurn>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError'
}

export function subscribeLiveTurns(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function lookupTurn(sessionId: number | null, draftToken: string | null) {
  if (sessionId != null) {
    return bySession.get(sessionId) ?? null
  }
  if (draftToken) {
    return byDraft.get(draftToken) ?? null
  }
  return null
}

function putTurn(turn: LiveTurn) {
  if (turn.sessionId != null) {
    bySession.set(turn.sessionId, turn)
    return
  }
  byDraft.set(turn.token, turn)
}

function settle(turn: LiveTurn, status: ChatMessage['status'], error?: string) {
  turn.running = false
  turn.messages = turn.messages.flatMap((item) => {
    if (item.id !== turn.agentId) {
      return [item]
    }
    if ((item.status === 'streaming' || item.status === 'sending') && !item.content && status === 'done') {
      return []
    }
    return [{ ...item, status, createdAt: Date.now(), error }]
  })
  emit()
}

function adoptSession(turn: LiveTurn, sessionId: number, onSession: (sessionId: number) => void) {
  if (turn.sessionId === sessionId && bySession.get(sessionId) === turn) {
    onSession(sessionId)
    return
  }
  const draftToken = turn.sessionId == null ? turn.token : null
  byDraft.delete(turn.token)
  turn.sessionId = sessionId
  bySession.set(sessionId, turn)
  if (draftToken) {
    adoptMusicSession(draftToken, sessionId)
  }
  onSession(sessionId)
  emit()
}

function noteMusic(turn: LiveTurn, music: MusicInfo) {
  const key = musicSessionKey(turn.sessionId, turn.sessionId == null ? turn.token : null)
  if (!key) {
    return
  }
  let userCreatedAt = Date.now()
  let anchorText = ''
  for (let i = turn.messages.length - 1; i >= 0; i -= 1) {
    const item = turn.messages[i]
    if (item.role === 'user') {
      userCreatedAt = item.createdAt
      anchorText = item.content
      break
    }
  }
  addMusicCard(key, music, userCreatedAt + 1, anchorText)
}

function appendDelta(turn: LiveTurn, chunk: string) {
  turn.messages = turn.messages.map((item) =>
    item.id === turn.agentId ? { ...item, content: item.content + chunk } : item,
  )
  emit()
}

export function startLiveTurn({
  sessionId,
  draftToken,
  messages,
  agentId,
  text,
  mode,
  onSession,
  onError,
}: StartArgs) {
  const previous = lookupTurn(sessionId, draftToken)
  previous?.controller.abort()
  if (previous?.sessionId != null) {
    bySession.delete(previous.sessionId)
  }
  if (previous && previous.sessionId == null) {
    byDraft.delete(previous.token)
  }

  const token = draftToken ?? createId()
  const controller = new AbortController()
  const turn: LiveTurn = {
    token,
    sessionId,
    messages,
    agentId,
    running: true,
    controller,
  }
  putTurn(turn)
  emit()

  const body = { message: text, session_id: sessionId }
  void runTurn(turn, body, mode, onSession, onError)
}

async function runTurn(
  turn: LiveTurn,
  body: { message: string; session_id: number | null },
  mode: ReplyMode,
  onSession: (sessionId: number) => void,
  onError?: (err: unknown) => void,
) {
  let buffered = ''
  try {
    await readChatStream(body, turn.controller.signal, {
      onSession(id) {
        adoptSession(turn, id, onSession)
      },
      onMeta(music) {
        noteMusic(turn, music)
      },
      onDelta(chunk) {
        if (mode === 'stream') {
          appendDelta(turn, chunk)
          return
        }
        buffered += chunk
      },
      onDone() {
        if (mode === 'complete' && buffered) {
          turn.messages = turn.messages.map((item) =>
            item.id === turn.agentId ? { ...item, content: buffered } : item,
          )
        }
        settle(turn, 'done')
      },
      onError(err) {
        settle(turn, 'error', err.message)
      },
    })
  } catch (err) {
    if (turn.controller.signal.aborted || isAbort(err)) {
      return
    }
    onError?.(err)
    const detail = err instanceof Error ? err.message : '发送失败'
    settle(turn, 'error', detail)
  } finally {
    if (turn.running) {
      turn.running = false
      emit()
    }
  }
}

export function stopLiveTurn(sessionId: number | null, draftToken: string | null) {
  const turn = lookupTurn(sessionId, draftToken)
  if (!turn || !turn.running) {
    return
  }
  turn.controller.abort()
  settle(turn, 'done')
}

export function stopAllLiveTurns() {
  const turns = [...bySession.values(), ...byDraft.values()]
  for (const turn of turns) {
    if (!turn.running) {
      continue
    }
    turn.controller.abort()
    settle(turn, 'done')
  }
}

export function forgetTurn(sessionId: number) {
  const turn = bySession.get(sessionId)
  if (!turn || turn.running) {
    return
  }
  bySession.delete(sessionId)
  emit()
}
