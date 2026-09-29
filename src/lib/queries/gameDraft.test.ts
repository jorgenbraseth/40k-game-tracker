import { afterEach, describe, expect, it, vi } from 'vitest'
import { commitDraft, discardDraft, hasPendingChanges, isDrafting, startDraft, writeOrQueue } from './gameDraft'

const GAME = 'game-1'

afterEach(() => discardDraft(GAME))

describe('gameDraft', () => {
  it('runs writes immediately when no draft is open', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    await writeOrQueue(GAME, write)
    expect(write).toHaveBeenCalledOnce()
    expect(isDrafting(GAME)).toBe(false)
  })

  it('queues writes while drafting and replays them in order on commit', async () => {
    const calls: number[] = []
    startDraft(GAME)
    await writeOrQueue(GAME, async () => void calls.push(1))
    await writeOrQueue(GAME, async () => void calls.push(2))
    expect(calls).toEqual([])
    expect(hasPendingChanges(GAME)).toBe(true)

    await commitDraft(GAME)
    expect(calls).toEqual([1, 2])
    expect(isDrafting(GAME)).toBe(false)
  })

  it('keeps the failed write and everything after it queued, so Save can be retried', async () => {
    const calls: string[] = []
    let failOnce = true
    startDraft(GAME)
    await writeOrQueue(GAME, async () => void calls.push('a'))
    await writeOrQueue(GAME, async () => {
      if (failOnce) {
        failOnce = false
        throw new Error('offline')
      }
      calls.push('b')
    })
    await writeOrQueue(GAME, async () => void calls.push('c'))

    await expect(commitDraft(GAME)).rejects.toThrow('offline')
    expect(calls).toEqual(['a'])
    expect(isDrafting(GAME)).toBe(true)

    await commitDraft(GAME)
    expect(calls).toEqual(['a', 'b', 'c'])
    expect(isDrafting(GAME)).toBe(false)
  })

  it('drops queued writes on discard', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    startDraft(GAME)
    await writeOrQueue(GAME, write)
    discardDraft(GAME)
    expect(isDrafting(GAME)).toBe(false)
    await commitDraft(GAME)
    expect(write).not.toHaveBeenCalled()
  })
})
