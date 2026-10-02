import type { MusicInfo } from '../types/chat'
import { createId } from '../utils/createId'

export type MusicCard = {
  id: string
  sessionKey: string
  music: MusicInfo
  /** 排序时间：该轮用户消息 createdAt + 1ms，插在用户消息和助手回答之间 */
  createdAt: number
  /** 该轮用户原文。历史消息改用服务端时间后，靠它找回同一轮 */
  anchorText: string
  /** 用户关闭后不再弹出气泡 / 迷你播放器 */
  closed: boolean
  /** 重新加载恢复的卡片为 false，音频保持暂停 */
  autoplay: boolean
}

const MUSIC_STORAGE_KEY = 'xnc:music-cards'

const bySession = new Map<string, MusicCard[]>()
const listeners = new Set<() => void>()

type StoredCard = {
  id: string
  sessionKey: string
  title: string
  url: string
  scene: string
  reason: string
  notice?: string
  closed: boolean
  createdAt: number
  anchorText: string
}

function persistCards() {
  const rows: StoredCard[] = []
  for (const cards of bySession.values()) {
    for (const card of cards) {
      rows.push({
        id: card.id,
        sessionKey: card.sessionKey,
        title: card.music.title,
        url: card.music.url,
        scene: card.music.scene,
        reason: card.music.reason,
        notice: card.music.notice,
        closed: card.closed,
        createdAt: card.createdAt,
        anchorText: card.anchorText,
      })
    }
  }
  try {
    sessionStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    /* 隐私模式写不进去时，本次刷新前仍用内存里的卡片 */
  }
}

function hydrateCards() {
  try {
    const raw = sessionStorage.getItem(MUSIC_STORAGE_KEY)
    if (!raw) {
      return
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return
    }
    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const row = item as Partial<StoredCard>
      if (typeof row.id !== 'string' || typeof row.sessionKey !== 'string') {
        continue
      }
      if (typeof row.title !== 'string' || typeof row.url !== 'string') {
        continue
      }
      const card: MusicCard = {
        id: row.id,
        sessionKey: row.sessionKey,
        music: {
          title: row.title,
          url: row.url,
          scene: typeof row.scene === 'string' ? row.scene : '',
          reason: typeof row.reason === 'string' ? row.reason : '',
          notice: typeof row.notice === 'string' ? row.notice : undefined,
        },
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : Date.now(),
        anchorText: typeof row.anchorText === 'string' ? row.anchorText : '',
        closed: row.closed === true,
        autoplay: false,
      }
      const prev = bySession.get(card.sessionKey) ?? []
      prev.push(card)
      bySession.set(card.sessionKey, prev)
    }
  } catch {
    /* 损坏的记录直接丢掉，不影响进聊天 */
  }
}

function emit() {
  persistCards()
  listeners.forEach((listener) => listener())
}

hydrateCards()

export function musicSessionKey(sessionId: number | null, draftToken: string | null) {
  if (sessionId != null) {
    return `s:${sessionId}`
  }
  if (draftToken) {
    return `d:${draftToken}`
  }
  return null
}

export function subscribeMusic(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function listMusicCards(sessionKey: string | null): MusicCard[] {
  if (!sessionKey) {
    return []
  }
  return bySession.get(sessionKey) ?? []
}

/**
 * 这张卡是否应该紧跟在这条用户消息后面。
 * 当场用 createdAt = 用户消息 + 1ms 对上；历史重载后用户/助手落库时间相同，改按原文找回该轮。
 */
export function cardFollowsUser(
  card: MusicCard,
  message: { role: string; createdAt: number; content: string },
  messages: Array<{ role: string; createdAt: number; content: string }>,
) {
  if (message.role !== 'user') {
    return false
  }
  if (card.createdAt === message.createdAt + 1) {
    return true
  }
  const exact = messages.some((item) => item.role === 'user' && card.createdAt === item.createdAt + 1)
  if (exact || !card.anchorText || message.content !== card.anchorText) {
    return false
  }
  const target = card.createdAt - 1
  let bestAt = Number.NEGATIVE_INFINITY
  let bestDist = Number.POSITIVE_INFINITY
  for (const item of messages) {
    if (item.role !== 'user' || item.content !== card.anchorText) {
      continue
    }
    const dist = Math.abs(item.createdAt - target)
    if (dist < bestDist || (dist === bestDist && item.createdAt > bestAt)) {
      bestDist = dist
      bestAt = item.createdAt
    }
  }
  return message.createdAt === bestAt
}

/** 同一会话最近一首（含已关闭，调用方自行过滤） */
export function latestMusicCard(sessionKey: string | null): MusicCard | null {
  const cards = listMusicCards(sessionKey)
  return cards.length > 0 ? cards[cards.length - 1] : null
}

export function addMusicCard(
  sessionKey: string,
  music: MusicInfo,
  createdAt = Date.now(),
  anchorText = '',
): MusicCard {
  const card: MusicCard = {
    id: createId(),
    sessionKey,
    music,
    createdAt,
    anchorText,
    closed: false,
    autoplay: true,
  }
  const prev = bySession.get(sessionKey) ?? []
  bySession.set(sessionKey, [...prev, card])
  emit()
  return card
}

export function closeMusicCard(id: string) {
  for (const [key, cards] of bySession) {
    const index = cards.findIndex((item) => item.id === id)
    if (index < 0) {
      continue
    }
    const next = cards.map((item, i) => (i === index ? { ...item, closed: true } : item))
    bySession.set(key, next)
    emit()
    return
  }
}

/**
 * 草稿会话拿到正式 session_id 后，把音乐卡片迁过去。
 * createdAt / anchorText 原样保留，排序不因迁移重算。
 */
export function adoptMusicSession(draftToken: string, sessionId: number) {
  const from = musicSessionKey(null, draftToken)
  const to = musicSessionKey(sessionId, null)
  if (!from || !to || from === to) {
    return
  }
  const cards = bySession.get(from)
  if (!cards || cards.length === 0) {
    return
  }
  bySession.delete(from)
  const existing = bySession.get(to) ?? []
  bySession.set(
    to,
    [...existing, ...cards.map((item) => ({ ...item, sessionKey: to }))],
  )
  emit()
}

export function clearMusicSession(sessionKey: string) {
  if (!bySession.has(sessionKey)) {
    return
  }
  bySession.delete(sessionKey)
  emit()
}
