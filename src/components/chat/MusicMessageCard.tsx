import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MusicCard } from '../../chat/musicStore'
import { holdSharedAudio, mountSharedAudio, playSharedAudio } from '../../chat/sharedAudio'
import type { MusicInfo } from '../../types/chat'

function MusicCopy({ music }: { music: MusicInfo }) {
  if (!music.notice) {
    return music.reason
  }
  return (
    <>
      {music.reason}
      <span className="music-notice">{music.notice}</span>
    </>
  )
}

type Props = {
  card: MusicCard
  /** 最新一首挂到页面共享 audio 上，才能接上发送时的 iOS 解锁 */
  shared?: boolean
  /** 供迷你播放器绑定同一 audio 元素 */
  onAudioReady?: (id: string, audio: HTMLAudioElement | null) => void
  onCardNode?: (id: string, node: HTMLElement | null) => void
}

/** 触屏/小屏：聊天流中的音乐伪消息卡片 */
export default function MusicMessageCard({ card, shared = false, onAudioReady, onCardNode }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!shared) {
      return
    }
    const slot = slotRef.current
    if (!slot) {
      return
    }
    mountSharedAudio(slot)
  })

  const readyRef = useRef(onAudioReady)
  readyRef.current = onAudioReady

  useEffect(() => {
    if (shared) {
      const audio = slotRef.current ? mountSharedAudio(slotRef.current) : null
      readyRef.current?.(card.id, audio)
      if (!audio) {
        return () => readyRef.current?.(card.id, null)
      }
      if (!card.autoplay) {
        holdSharedAudio(card.music.url)
        return () => readyRef.current?.(card.id, null)
      }
      void playSharedAudio(card.music.url)
      return () => readyRef.current?.(card.id, null)
    }
    readyRef.current?.(card.id, audioRef.current)
    return () => readyRef.current?.(card.id, null)
  }, [card.autoplay, card.id, card.music.url, shared])

  useEffect(() => {
    onCardNode?.(card.id, rootRef.current)
    return () => onCardNode?.(card.id, null)
  }, [card.id, onCardNode])

  return (
    <article
      ref={rootRef}
      className="chat-row is-agent is-music"
      data-message-id={card.id}
      data-music-card={card.id}
    >
      <img className="chat-avatar" src="/agent_head.png" alt="小喜子" />
      <div className="chat-stack">
        <div className="chat-bubble is-agent is-music">
          <p className="chat-text">
            <MusicCopy music={card.music} />
          </p>
          {shared ? (
            <div ref={slotRef} />
          ) : (
            <audio
              ref={audioRef}
              className="music-audio"
              controls
              src={card.music.url}
              preload="metadata"
            />
          )}
        </div>
      </div>
    </article>
  )
}
