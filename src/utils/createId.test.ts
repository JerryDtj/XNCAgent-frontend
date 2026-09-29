import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './createId'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID })
    expect(createId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to UUID v4 when randomUUID is missing', () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    const id = createId()
    expect(id).toMatch(UUID_V4)
    expect(createId()).not.toBe(id)
  })
})
