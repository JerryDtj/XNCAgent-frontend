import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { MusicCard } from '../../chat/musicStore'
import { playPromptActive, subscribePlayPrompt } from '../../chat/sharedAudio'

type Props = {
  card: MusicCard
  audio: HTMLAudioElement | null
  onClose: (id: string) => void
}

type Dock = 'left' | 'right' | null

const DRAG_THRESHOLD = 8
const SNAP_EDGE = 16
const VIEWPORT_GAP = 8

function floatingPos(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(0, window.innerWidth - width - VIEWPORT_GAP)
  const maxY = Math.max(0, window.innerHeight - height)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

/** 触屏迷你播放器：卡片滚出视口后浮现，可拖放，贴边后只留播放键 */
export default function MiniMusicPlayer({ card, audio, onClose }: Props) {
  const [playing, setPlaying] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(playPromptActive)
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 220) : 12,
    y: typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 96) : 12,
  }))
  const [dock, setDock] = useState<Dock>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    dragging: boolean
    fromButton: boolean
  } | null>(null)
  const posRef = useRef(pos)
  const dockRef = useRef<Dock>(null)
  const suppressClickRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!audio) {
      setPlaying(false)
      return
    }
    const sync = () => setPlaying(!audio.paused)
    sync()
    audio.addEventListener('play', sync)
    audio.addEventListener('pause', sync)
    audio.addEventListener('ended', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      audio.removeEventListener('play', sync)
      audio.removeEventListener('pause', sync)
      audio.removeEventListener('ended', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [audio])

  useEffect(() => subscribePlayPrompt(() => setNeedsGesture(playPromptActive())), [])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || dockRef.current) {
      return
    }
    const width = el.offsetWidth
    const height = el.offsetHeight
    place(floatingPos(window.innerWidth - width - VIEWPORT_GAP, posRef.current.y, width, height), null)
  }, [])

  useEffect(() => {
    const onResize = () => {
      const el = rootRef.current
      if (!el || dockRef.current) {
        return
      }
      const next = floatingPos(posRef.current.x, posRef.current.y, el.offsetWidth, el.offsetHeight)
      place(next, null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function togglePlay() {
    if (!audio) {
      return
    }
    if (audio.paused) {
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }

  function place(next: { x: number; y: number }, nextDock: Dock) {
    posRef.current = next
    dockRef.current = nextDock
    setPos(next)
    setDock(nextDock)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }
    const target = event.target as HTMLElement
    const fromButton = Boolean(target.closest('button'))
    if (fromButton && dockRef.current == null) {
      return
    }
    const rect = rootRef.current?.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect?.left ?? posRef.current.x,
      originY: rect?.top ?? posRef.current.y,
      dragging: false,
      fromButton,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return
      }
      drag.dragging = true
      if (dockRef.current != null) {
        dockRef.current = null
        setDock(null)
      }
      try {
        rootRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // 指针已经结束时捕获会失败，拖放仍按坐标继续
      }
    }
    event.preventDefault()
    const width = rootRef.current?.offsetWidth ?? 200
    const height = rootRef.current?.offsetHeight ?? 56
    const next = floatingPos(drag.originX + dx, drag.originY + dy, width, height)
    posRef.current = next
    setPos(next)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    if (drag.dragging) {
      try {
        rootRef.current?.releasePointerCapture(event.pointerId)
      } catch {
        // 未捕获到指针时忽略
      }
      if (drag.fromButton) {
        suppressClickRef.current = true
      }
      const width = rootRef.current?.offsetWidth ?? 200
      const height = rootRef.current?.offsetHeight ?? 56
      const fitted = floatingPos(posRef.current.x, posRef.current.y, width, height)
      const leftGap = fitted.x
      const rightGap = window.innerWidth - (fitted.x + width)
      if (leftGap < SNAP_EDGE) {
        place({ x: 0, y: fitted.y }, 'left')
      } else if (rightGap < SNAP_EDGE) {
        place({ x: Math.max(0, window.innerWidth - width), y: fitted.y }, 'right')
      } else {
        place(fitted, null)
      }
    }
    dragRef.current = null
  }

  function onPlayClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    togglePlay()
  }

  const docked = dock != null
  const style =
    dock === 'right'
      ? { right: 0, left: 'auto', top: pos.y }
      : dock === 'left'
        ? { left: 0, right: 'auto', top: pos.y }
        : { left: pos.x, top: pos.y }

  return createPortal(
    <div
      ref={rootRef}
      className={docked ? `music-mini is-docked is-docked-${dock}` : 'music-mini'}
      style={style}
      role="group"
      aria-label="迷你播放器"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="music-mini-title" title={card.music.title}>
        {card.music.title}
      </span>
      <button
        type="button"
        className={needsGesture && !playing ? 'music-mini-play is-prompt' : 'music-mini-play'}
        aria-label={playing ? '暂停' : '播放'}
        onClick={onPlayClick}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button type="button" className="music-mini-close" aria-label="关闭迷你播放器" onClick={() => onClose(card.id)}>
        ×
      </button>
    </div>,
    document.body,
  )
}
