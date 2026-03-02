import { describe, it, expect } from 'vitest'
import type { GraphQLExecutor, GraphQLResult } from '../src/shared/types/index.ts'
import { render } from '../src/entry-server.tsx'

// Build a mock executor that returns canned data for known queries
function createMockExecutor(): GraphQLExecutor {
  return async (query: string, variables?: Record<string, any>): Promise<GraphQLResult> => {
    const q = query.trim()

    // Songs list query
    if (q.includes('songs') && !q.includes('song(')) {
      return {
        data: {
          songs: [
            { id: 'test-song', title: 'Test Song', author: 'Author' },
          ],
        },
      }
    }

    // Single song query
    if (q.includes('song(') && !q.includes('updateSong')) {
      const id = variables?.id
      if (id === 'test-song') {
        return {
          data: {
            song: {
              id: 'test-song',
              title: 'Test Song',
              author: 'Author',
              rawText: 'TEST SONG - AUTHOR\n\nVERSE:\nC  G\nHello\n',
            },
          },
        }
      }
      return { data: { song: null } }
    }

    // Update mutation
    if (q.includes('updateSong')) {
      return {
        data: {
          updateSong: {
            id: variables?.id,
            title: 'Updated',
            author: 'Author',
            rawText: variables?.rawText,
          },
        },
      }
    }

    return { data: null }
  }
}

describe('entry-server render', () => {
  it('GET /songs returns 200 with song list markup', async () => {
    const result = await render('/songs', 'GET', undefined, createMockExecutor())
    expect(result.statusCode).toBe(200)
    expect(result.appHtml).toContain('Test Song')
  })

  it('GET /songs/test-song returns 200 with song detail', async () => {
    const result = await render('/songs/test-song', 'GET', undefined, createMockExecutor())
    expect(result.statusCode).toBe(200)
    expect(result.appHtml).toContain('test-song')
  })

  it('GET /songs/nonexistent returns 404', async () => {
    const result = await render('/songs/nonexistent', 'GET', undefined, createMockExecutor())
    expect(result.statusCode).toBe(404)
    expect(result.appHtml).toContain('Song not found')
  })

  it('POST /songs/test-song/edit returns 302 redirect', async () => {
    const result = await render(
      '/songs/test-song/edit',
      'POST',
      { rawText: 'new content' },
      createMockExecutor(),
    )
    expect(result.statusCode).toBe(302)
    expect(result.redirect).toBe('/songs/test-song/edit')
  })

  it('GET /unknown-route returns 404', async () => {
    const result = await render('/unknown-route', 'GET', undefined, createMockExecutor())
    expect(result.statusCode).toBe(404)
  })

  it('GET / redirects to /songs', async () => {
    const result = await render('/', 'GET', undefined, createMockExecutor())
    expect(result.statusCode).toBe(302)
    expect(result.redirect).toBe('/songs')
  })

  it('populates graphqlCache with query results', async () => {
    const result = await render('/songs', 'GET', undefined, createMockExecutor())
    const keys = Object.keys(result.graphqlCache)
    expect(keys.length).toBeGreaterThan(0)
  })
})
