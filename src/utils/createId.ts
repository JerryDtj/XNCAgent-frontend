const UUID_V4 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'

function randomNibble(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f
  }
  return Math.floor(Math.random() * 16)
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return UUID_V4.replace(/[xy]/g, (c) => {
    const r = randomNibble()
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
