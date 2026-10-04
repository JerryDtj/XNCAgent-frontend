import { describe, expect, it } from 'vitest'
import { parseServerTime } from './serverTime'

describe('parseServerTime', () => {
  it('parses Go RFC3339 timestamps with microseconds', () => {
    // Go time.RFC3339 输出 6 位微秒，截断到毫秒后解析
    expect(parseServerTime('2026-10-03T19:50:58.480345+08:00')).toBe(
      Date.parse('2026-10-03T19:50:58.480+08:00'),
    )
  })

  it('keeps millisecond timestamps untouched', () => {
    expect(parseServerTime('2026-10-03T19:50:58.480+08:00')).toBe(
      Date.parse('2026-10-03T19:50:58.480+08:00'),
    )
  })

  it('parses timestamps without fractional seconds', () => {
    expect(parseServerTime('2026-10-03T19:50:58+08:00')).toBe(
      Date.parse('2026-10-03T19:50:58+08:00'),
    )
  })

  it('parses UTC timestamps with microseconds', () => {
    expect(parseServerTime('2026-10-03T11:50:58.480345Z')).toBe(
      Date.parse('2026-10-03T11:50:58.480Z'),
    )
  })

  it('returns null for empty or unparseable values', () => {
    expect(parseServerTime(null)).toBeNull()
    expect(parseServerTime(undefined)).toBeNull()
    expect(parseServerTime('')).toBeNull()
    expect(parseServerTime('not-a-date')).toBeNull()
  })
})
