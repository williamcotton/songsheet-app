import { describe, it, expect } from 'vitest'
import { graphql } from 'graphql'
import { createSchema } from '../../../src/shared/graphql/schema.ts'
import type { DataStore } from '../../../src/shared/graphql/types.ts'

function createMockDataStore(): DataStore {
  const songs = [
    { id: 'song-a', title: 'Song A', author: 'Author A', rawText: 'Song A text' },
    { id: 'song-b', title: 'Song B', author: 'Author B', rawText: 'Song B text' },
  ]

  return {
    async getSongs() {
      return songs.map(({ id, title, author }) => ({ id, title, author }))
    },
    async getSong(id: string) {
      return songs.find(s => s.id === id) ?? null
    },
    async updateSong(id: string, rawText: string) {
      const song = songs.find(s => s.id === id)
      if (!song) return null
      song.rawText = rawText
      return { ...song }
    },
  }
}

describe('GraphQL schema', () => {
  it('queries songs list', async () => {
    const schema = createSchema(createMockDataStore())
    const result = await graphql({
      schema,
      source: '{ songs { id title author } }',
    })
    expect(result.errors).toBeUndefined()
    expect(result.data?.songs).toHaveLength(2)
    expect((result.data?.songs as any)[0].id).toBe('song-a')
  })

  it('queries a single song by id', async () => {
    const schema = createSchema(createMockDataStore())
    const result = await graphql({
      schema,
      source: '{ song(id: "song-a") { id title rawText } }',
    })
    expect(result.errors).toBeUndefined()
    expect((result.data?.song as any).title).toBe('Song A')
    expect((result.data?.song as any).rawText).toBe('Song A text')
  })

  it('returns null for nonexistent song', async () => {
    const schema = createSchema(createMockDataStore())
    const result = await graphql({
      schema,
      source: '{ song(id: "missing") { id } }',
    })
    expect(result.errors).toBeUndefined()
    expect(result.data?.song).toBeNull()
  })

  it('mutates updateSong', async () => {
    const schema = createSchema(createMockDataStore())
    const result = await graphql({
      schema,
      source: `mutation { updateSong(id: "song-a", rawText: "new text") { id rawText } }`,
    })
    expect(result.errors).toBeUndefined()
    expect((result.data?.updateSong as any).rawText).toBe('new text')
  })

  it('returns errors for invalid query', async () => {
    const schema = createSchema(createMockDataStore())
    const result = await graphql({
      schema,
      source: '{ nonExistentField }',
    })
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
  })
})
