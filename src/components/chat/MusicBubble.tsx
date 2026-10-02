import { useEffect, useRef } from 'react'
import type { MusicCard } from '../../chat/musicStore'
import type { MusicInfo } from '../../types/chat'

type Props = {
  card: MusicCard
  onClose: (id: string) => void
}

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

/** 桌面端：小人图标上方气泡 + 原生 audio */
export default function MusicBubble({ card, onClose }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || card.closed || !card.autoplay) {
      return
    }
    void audio.play().catch(() => undefined)
  }, [card.autoplay, card.closed, card.id, card.music.url])

  if (card.closed) {
    return null
  }

  return (
    <div className="music-bubble-wrap" role="status">
      <div className="music-bubble">
        <p className="music-bubble-text">
          <MusicCopy music={card.music} />
        </p>
        <button
          type="button"
          className="music-bubble-close"
          aria-label="关闭音乐提示"
          onClick={() => onClose(card.id)}
        >
          ×
        </button>
      </div>
      <audio ref={audioRef} className="music-audio" controls src={card.music.url} preload="auto" />
    </div>
  )
}
