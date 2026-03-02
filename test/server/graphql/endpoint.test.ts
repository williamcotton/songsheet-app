import { describe, it, expect, vi } from 'vitest'
import { createGraphQLEndpoint } from '../../../src/server/graphql/endpoint.ts'
import { createSchema } from '../../../src/shared/graphql/schema.ts'
import type { DataStore } from '../../../src/shared/graphql/types.ts'

function createMockDataStore(): DataStore {
  return {
    async getSongs() {
      return [{ id: 'test', title: 'Test Song', author: 'Author' }]
    },
    async getSong(id: string) {
      if (id === 'test') return { id: 'test', title: 'Test Song', author: 'Author', rawText: 'text' }
      return null
    },
    async updateSong() {
      return null
    },
  }
}

function createMockRes() {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(data: any) {
      res.body = data
      return res
    },
  }
  return res
}

describe('createGraphQLEndpoint', () => {
  it('returns 200 with data for valid query', async () => {
    const schema = createSchema(createMockDataStore())
    const handler = createGraphQLEndpoint(schema)
    const req = { body: { query: '{ songs { id title } }' } } as any
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.songs).toHaveLength(1)
    expect(res.body.data.songs[0].id).toBe('test')
  })

  it('returns 400 for missing query', async () => {
    const schema = createSchema(createMockDataStore())
    const handler = createGraphQLEndpoint(schema)
    const req = { body: {} } as any
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.errors[0].message).toBe('Missing query')
  })

  it('returns 400 for empty query string', async () => {
    const schema = createSchema(createMockDataStore())
    const handler = createGraphQLEndpoint(schema)
    const req = { body: { query: '   ' } } as any
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.errors[0].message).toBe('Missing query')
  })

  it('forwards variables to GraphQL', async () => {
    const schema = createSchema(createMockDataStore())
    const handler = createGraphQLEndpoint(schema)
    const req = {
      body: {
        query: 'query Song($id: String!) { song(id: $id) { id title } }',
        variables: { id: 'test' },
      },
    } as any
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.song.title).toBe('Test Song')
  })
})
