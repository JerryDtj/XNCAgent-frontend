/**
 * 解析后端返回的 RFC3339 时间戳（Go 的 time.RFC3339 带 6 位微秒，如
 * "2026-10-03T19:50:58.480345+08:00"）。
 *
 * Safari（所有版本）的 Date.parse 遇到超过 3 位的小数秒会返回 NaN，
 * 这里统一截断到毫秒再解析；解析失败返回 null 交由调用方兜底。
 */
export function parseServerTime(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }
  const normalized = value.replace(/\.(\d{3})\d+/, '.$1')
  const ts = Date.parse(normalized)
  return Number.isNaN(ts) ? null : ts
}
