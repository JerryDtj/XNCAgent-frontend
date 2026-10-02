/** 极短静音，用来在用户手势里解锁 iOS 的 audio 元素。 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

let audio: HTMLAudioElement | null = null
let generation = 0
let needsGesture = false
const promptListeners = new Set<() => void>()

function notifyPrompt() {
  promptListeners.forEach((listener) => listener())
}

function setNeedsGesture(next: boolean) {
  if (needsGesture === next) {
    return
  }
  needsGesture = next
  notifyPrompt()
}

function ensureAudio() {
  if (audio) {
    return audio
  }
  const element = document.createElement('audio')
  element.preload = 'auto'
  element.setAttribute('playsinline', 'true')
  element.setAttribute('webkit-playsinline', 'true')
  audio = element
  return element
}

/**
 * 必须在发送按钮的 touch/click 调用栈里同步执行。
 * play() 成功后立刻暂停，只为让之后的 meta 帧可以再 play()。
 */
export function unlockSharedAudio() {
  const element = ensureAudio()
  const gen = ++generation
  if (!element.src) {
    element.src = SILENT_WAV
  }
  const played = element.play()
  void played
    .then(() => {
      if (gen !== generation) {
        return
      }
      element.pause()
      try {
        element.currentTime = 0
      } catch {
        /* 静音源还没就绪时忽略 */
      }
    })
    .catch(() => undefined)
}

/** 把共享 audio 挂进音乐卡片，迷你播放器控制的是同一个元素。 */
export function mountSharedAudio(slot: HTMLElement) {
  const element = ensureAudio()
  element.controls = true
  element.className = 'music-audio'
  if (element.parentElement !== slot) {
    slot.appendChild(element)
  }
  return element
}

function assignSource(element: HTMLAudioElement, url: string) {
  const abs = new URL(url, window.location.href).href
  if (element.src !== abs) {
    element.src = url
  }
}

/** meta 到达后播放。被策略拒绝时不抛错，只点亮迷你播放器的播放键。 */
export function playSharedAudio(url: string) {
  const element = ensureAudio()
  generation += 1
  assignSource(element, url)
  return element
    .play()
    .then(() => {
      setNeedsGesture(false)
    })
    .catch(() => {
      setNeedsGesture(true)
    })
}

/** 恢复出来的卡片只挂上音源，保持暂停。 */
export function holdSharedAudio(url: string) {
  const element = ensureAudio()
  generation += 1
  assignSource(element, url)
  element.pause()
  return element
}

export function playPromptActive() {
  return needsGesture
}

export function subscribePlayPrompt(listener: () => void) {
  promptListeners.add(listener)
  return () => {
    promptListeners.delete(listener)
  }
}
