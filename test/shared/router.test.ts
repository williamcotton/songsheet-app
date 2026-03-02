import { describe, it, expect } from 'vitest'
import { Router } from '../../src/shared/router.ts'

describe('Router', () => {
  it('matches an exact path', () => {
    const router = new Router()
    const handler = async () => {}
    router.add('get', '/songs', handler)

    const result = router.match('get', '/songs')
    expect(result).not.toBeNull()
    expect(result!.handler).toBe(handler)
    expect(result!.params).toEqual({})
  })

  it('matches parameterized :id path', () => {
    const router = new Router()
    const handler = async () => {}
    router.add('get', '/songs/:id', handler)

    const result = router.match('get', '/songs/america')
    expect(result).not.toBeNull()
    expect(result!.params).toEqual({ id: 'america' })
  })

  it('filters by method', () => {
    const router = new Router()
    const getHandler = async () => {}
    const postHandler = async () => {}
    router.add('get', '/songs/:id/edit', getHandler)
    router.add('post', '/songs/:id/edit', postHandler)

    const getResult = router.match('get', '/songs/test/edit')
    expect(getResult!.handler).toBe(getHandler)

    const postResult = router.match('post', '/songs/test/edit')
    expect(postResult!.handler).toBe(postHandler)
  })

  it('returns null when no route matches', () => {
    const router = new Router()
    router.add('get', '/songs', async () => {})

    expect(router.match('get', '/unknown')).toBeNull()
    expect(router.match('post', '/songs')).toBeNull()
  })

  it('matches first route when multiple could match', () => {
    const router = new Router()
    const first = async () => {}
    const second = async () => {}
    router.add('get', '/songs/:id', first)
    router.add('get', '/songs/:slug', second)

    const result = router.match('get', '/songs/test')
    expect(result!.handler).toBe(first)
  })
})
