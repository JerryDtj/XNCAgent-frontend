import { useEffect, useState } from 'react'

/** 触屏 / 小屏：宽度 ≤768 或 pointer:coarse（覆盖 h5、iPad、iPhone） */
export function useTouchLayout() {
  const [touch, setTouch] = useState(() => detect())

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 768px)')
    const coarse = window.matchMedia('(pointer: coarse)')
    const sync = () => setTouch(detect())
    narrow.addEventListener('change', sync)
    coarse.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      narrow.removeEventListener('change', sync)
      coarse.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return touch
}

function detect() {
  return window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches
}
