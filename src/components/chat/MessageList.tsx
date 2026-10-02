import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  cardFollowsUser,
  closeMusicCard,
  latestMusicCard,
  listMusicCards,
  type MusicCard,
  subscribeMusic,
} from '../../chat/musicStore'
import type { ChatMessage } from '../../types/chat'
import MessageBubble from './MessageBubble'
import MiniMusicPlayer from './MiniMusicPlayer'
import MusicMessageCard from './MusicMessageCard'

type TimelineItem =
  | { kind: 'message'; key: string; message: ChatMessage; at: number }
  | { kind: 'music'; key: string; card: MusicCard; at: number }

type Props = {
  messages: ChatMessage[]
  busy: boolean
  restoring: boolean
  notice: string
  locateMessageId: string | null
  onLocateDone: () => void
  anchored: boolean
  hasEarlier: boolean
  loadingEarlier: boolean
  onLoadEarlier: () => void
  onJumpLatest: () => void
  onRetry: (id: string) => void
  /** 触屏/小屏时把音乐渲染进聊天流 */
  touchLayout: boolean
  musicSessionKey: string | null
}

const NEAR_BOTTOM_PX = 80

function isNearBottom(list: HTMLElement, previous: boolean) {
  if (list.clientHeight < 1) {
    return previous
  }
  return list.scrollHeight - list.scrollTop - list.clientHeight <= NEAR_BOTTOM_PX
}

/** 锁屏或布局未完成时矩形会变成 0，不能当成「卡片在视口里」。 */
function readCardVisible(node: HTMLElement, root: HTMLElement): boolean | null {
  if (document.visibilityState !== 'visible') {
    return null
  }
  const rootBox = root.getBoundingClientRect()
  const box = node.getBoundingClientRect()
  if (rootBox.height < 1 || box.height < 1) {
    return null
  }
  return box.bottom > rootBox.top + 1 && box.top < rootBox.bottom - 1
}

function buildTimeline(messages: ChatMessage[], cards: MusicCard[], includeMusic: boolean): TimelineItem[] {
  const items: TimelineItem[] = messages.map((message) => ({
    kind: 'message' as const,
    key: `m:${message.id}`,
    message,
    at: message.createdAt,
  }))
  if (includeMusic) {
    for (const card of cards) {
      const userIndex = messages.findIndex((message) => cardFollowsUser(card, message, messages))
      const at = userIndex >= 0 ? messages[userIndex].createdAt + 1 : card.createdAt
      items.push({ kind: 'music', key: `music:${card.id}`, card, at })
      const next = userIndex >= 0 ? messages[userIndex + 1] : undefined
      if (next && next.role !== 'user') {
        const agent = items.find((item) => item.kind === 'message' && item.message.id === next.id)
        if (agent && agent.at <= at) {
          agent.at = at + 1
        }
      }
    }
  }
  items.sort((a, b) => a.at - b.at || (a.kind === 'music' ? 1 : 0) - (b.kind === 'music' ? 1 : 0))
  return items
}

export default function MessageList({
  messages,
  busy,
  restoring,
  notice,
  locateMessageId,
  onLocateDone,
  anchored,
  hasEarlier,
  loadingEarlier,
  onLoadEarlier,
  onJumpLatest,
  onRetry,
  touchLayout,
  musicSessionKey,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onLocateDone)
  const skipBottomRef = useRef(false)
  const stickRef = useRef(true)
  const sessionKeyRef = useRef(musicSessionKey)
  const firstIdRef = useRef<string | null>(null)
  const heightRef = useRef(0)
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const audioMap = useRef(new Map<string, HTMLAudioElement>())
  const nodeMap = useRef(new Map<string, HTMLElement>())
  const [, setMusicRev] = useState(0)
  const [cardNodesRev, setCardNodesRev] = useState(0)
  const [cardVisible, setCardVisible] = useState(true)
  const [boundAudio, setBoundAudio] = useState<HTMLAudioElement | null>(null)
  doneRef.current = onLocateDone

  useEffect(() => subscribeMusic(() => setMusicRev((value) => value + 1)), [])

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    const onScroll = () => {
      const near = isNearBottom(list, stickRef.current)
      stickRef.current = near
      setAwayFromBottom((prev) => (prev === !near ? prev : !near))
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    return () => list.removeEventListener('scroll', onScroll)
  }, [])

  function resumeFollow() {
    const list = listRef.current
    stickRef.current = true
    setAwayFromBottom(false)
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }

  const musicCards = listMusicCards(musicSessionKey)
  const latest = latestMusicCard(musicSessionKey)
  const timeline = buildTimeline(messages, musicCards, touchLayout)

  const onAudioReady = useCallback((id: string, audio: HTMLAudioElement | null) => {
    if (audio) {
      audioMap.current.set(id, audio)
    } else {
      audioMap.current.delete(id)
    }
    setBoundAudio(latest && !latest.closed ? (audioMap.current.get(latest.id) ?? null) : null)
  }, [latest])

  const onCardNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) {
      nodeMap.current.set(id, node)
    } else {
      nodeMap.current.delete(id)
    }
    setCardNodesRev((value) => value + 1)
  }, [])

  useEffect(() => {
    setBoundAudio(latest && !latest.closed ? (audioMap.current.get(latest.id) ?? null) : null)
  }, [latest])

  useEffect(() => {
    if (!touchLayout || !latest || latest.closed) {
      setCardVisible(true)
      return
    }
    const node = nodeMap.current.get(latest.id)
    const root = listRef.current
    if (!node || !root) {
      return
    }
    let cancelled = false
    const apply = () => {
      if (cancelled) {
        return
      }
      const visible = readCardVisible(node, root)
      if (visible == null) {
        return
      }
      setCardVisible(visible)
    }
    const applyAfterLayout = () => {
      apply()
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(apply)
      })
    }
    applyAfterLayout()
    const observer = new IntersectionObserver(() => apply(), {
      root,
      threshold: [0, 0.01],
    })
    observer.observe(node)
    root.addEventListener('scroll', apply, { passive: true })
    document.addEventListener('visibilitychange', applyAfterLayout)
    window.addEventListener('pageshow', applyAfterLayout)
    const settleTimer = window.setTimeout(apply, 300)
    return () => {
      cancelled = true
      observer.disconnect()
      root.removeEventListener('scroll', apply)
      document.removeEventListener('visibilitychange', applyAfterLayout)
      window.removeEventListener('pageshow', applyAfterLayout)
      window.clearTimeout(settleTimer)
    }
  }, [touchLayout, latest, musicCards.length, timeline.length, cardNodesRev])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }
    if (sessionKeyRef.current !== musicSessionKey) {
      sessionKeyRef.current = musicSessionKey
      stickRef.current = true
      setAwayFromBottom(false)
    }
    const firstId = timeline[0]?.key ?? null
    const prevFirst = firstIdRef.current
    const prepended =
      !restoring &&
      prevFirst != null &&
      firstId != null &&
      firstId !== prevFirst &&
      timeline.some((item) => item.key === prevFirst)
    if (prepended) {
      list.scrollTop += list.scrollHeight - heightRef.current
      skipBottomRef.current = true
    } else if (!restoring && locateMessageId) {
      const node = list.querySelector(`[data-message-id="${CSS.escape(locateMessageId)}"]`)
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ block: 'center' })
      }
    } else if (!restoring && !skipBottomRef.current && stickRef.current) {
      list.scrollTop = list.scrollHeight
    } else if (!restoring) {
      skipBottomRef.current = false
    }
    firstIdRef.current = firstId
    heightRef.current = list.scrollHeight
  }, [timeline, restoring, locateMessageId, musicSessionKey])

  useEffect(() => {
    if (!locateMessageId || restoring) {
      return
    }
    const list = listRef.current
    const node = list?.querySelector(`[data-message-id="${CSS.escape(locateMessageId)}"]`)
    if (!(node instanceof HTMLElement)) {
      if (messages.length > 0) {
        doneRef.current()
      }
      return
    }
    const timer = window.setTimeout(() => {
      skipBottomRef.current = true
      doneRef.current()
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [locateMessageId, restoring, messages])

  const showMini =
    touchLayout && latest != null && !latest.closed && !cardVisible

  return (
    <>
      <div className="chat-list-wrap">
      <div className="chat-list" ref={listRef}>
        {notice ? <p className="chat-empty">{notice}</p> : null}
        {restoring ? <p className="chat-empty">正在打开会话…</p> : null}
        {!notice && !restoring && messages.length === 0 && musicCards.length === 0 ? (
          <p className="chat-empty">说一句，小喜子接着聊。</p>
        ) : null}
        {anchored && hasEarlier ? (
          <button type="button" className="chat-history-nav" disabled={loadingEarlier} onClick={onLoadEarlier}>
            {loadingEarlier ? '加载中…' : '加载更早'}
          </button>
        ) : null}
        {timeline.map((item) =>
          item.kind === 'message' ? (
            <MessageBubble
              key={item.key}
              message={item.message}
              busy={busy}
              located={item.message.id === locateMessageId}
              onRetry={onRetry}
            />
          ) : (
            <MusicMessageCard
              key={item.key}
              card={item.card}
              shared={item.card.id === latest?.id && !item.card.closed}
              onAudioReady={onAudioReady}
              onCardNode={onCardNode}
            />
          ),
        )}
        {anchored ? (
          <button
            type="button"
            className="chat-history-nav"
            disabled={restoring}
            onClick={() => {
              stickRef.current = true
              setAwayFromBottom(false)
              onJumpLatest()
            }}
          >
            回到最新
          </button>
        ) : null}
      </div>
      {awayFromBottom && !anchored ? (
        <button type="button" className="chat-jump-latest" onClick={resumeFollow}>
          回到最新
        </button>
      ) : null}
      </div>
      {showMini && latest ? (
        <MiniMusicPlayer card={latest} audio={boundAudio} onClose={closeMusicCard} />
      ) : null}
    </>
  )
}
