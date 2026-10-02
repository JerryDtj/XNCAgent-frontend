import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSettings, putSettings } from '../../api/settings'

type Props = {
  open: boolean
  onClose: () => void
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [musicEnabled, setMusicEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const pendingRef = useRef(false)

  useEffect(() => {
    for (const src of ['/music_on.png', '/music_off.png']) {
      const img = new Image()
      img.src = src
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setError('')
    void getSettings()
      .then((data) => {
        if (!cancelled) {
          setMusicEnabled(data.music_enabled !== false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '设置加载失败')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const toggleMusic = useCallback(async () => {
    if (musicEnabled === null || pendingRef.current) {
      return
    }
    const next = !musicEnabled
    pendingRef.current = true
    setMusicEnabled(next)
    setError('')
    try {
      const saved = await putSettings(next)
      const confirmed = saved.music_enabled !== false
      if (confirmed !== next) {
        setMusicEnabled(confirmed)
      }
    } catch (err) {
      setMusicEnabled(!next)
      setError(err instanceof Error ? err.message : '设置保存失败')
    } finally {
      pendingRef.current = false
    }
  }, [musicEnabled])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="settings-layer" role="presentation" onClick={onClose}>
      <div
        className="settings-panel"
        role="dialog"
        aria-label="设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-panel-head">
          <h2>设置</h2>
          <button type="button" className="settings-close" aria-label="关闭设置" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-panel-body">
          {error ? <p className="settings-error">{error}</p> : null}
          <div className="settings-row">
            <div className="settings-row-main">
              <span className="settings-row-title">音乐播放</span>
              <span className="settings-row-hint">播放将使用网络流量</span>
            </div>
            {musicEnabled === null ? (
              <span className="settings-switch" aria-hidden="true" />
            ) : (
              <button
                type="button"
                className="settings-switch"
                role="switch"
                aria-checked={musicEnabled}
                aria-label="音乐播放"
                onClick={() => void toggleMusic()}
              >
                <img className="settings-switch-on" src="/music_on.png" alt="" hidden={!musicEnabled} />
                <img className="settings-switch-off" src="/music_off.png" alt="" hidden={musicEnabled} />
              </button>
            )}
          </div>
          {/* 后续设置项在此追加 settings-row */}
        </div>
      </div>
    </div>,
    document.body,
  )
}
