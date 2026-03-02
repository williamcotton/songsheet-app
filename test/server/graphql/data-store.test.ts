import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDataStore } from '../../../src/server/graphql/data-store.ts'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'songsheet-test-'))

  // Write a simple fixture song file
  fs.writeFileSync(
    path.join(tmpDir, 'my-song.txt'),
    'MY SONG - TEST AUTHOR\n\nVERSE:\nC   G   Am  F\nHello world\n',
  )
  fs.writeFileSync(
    path.join(tmpDir, 'another.txt'),
    'ANOTHER TUNE - SOMEONE\n\nC  G\nLa la la\n',
  )
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('createDataStore', () => {
  describe('getSongs', () => {
    it('returns sorted summaries with parsed title and author', async () => {
      const store = createDataStore(tmpDir)
      const songs = await store.getSongs()
      expect(songs).toHaveLength(2)
      // Sorted alphabetically by filename
      expect(songs[0].id).toBe('another')
      expect(songs[0].title).toBe('ANOTHER TUNE')
      expect(songs[0].author).toBe('SOMEONE')
      expect(songs[1].id).toBe('my-song')
      expect(songs[1].title).toBe('MY SONG')
      expect(songs[1].author).toBe('TEST AUTHOR')
    })
  })

  describe('getSong', () => {
    it('returns song data with rawText', async () => {
      const store = createDataStore(tmpDir)
      const song = await store.getSong('my-song')
      expect(song).not.toBeNull()
      expect(song!.id).toBe('my-song')
      expect(song!.title).toBe('MY SONG')
      expect(song!.rawText).toContain('Hello world')
    })

    it('returns null for nonexistent song', async () => {
      const store = createDataStore(tmpDir)
      const song = await store.getSong('nonexistent')
      expect(song).toBeNull()
    })
  })

  describe('updateSong', () => {
    it('writes file, re-parses, and returns updated data', async () => {
      const store = createDataStore(tmpDir)
      const newText = 'UPDATED TITLE - NEW AUTHOR\n\nG  D\nNew lyrics\n'
      const result = await store.updateSong('my-song', newText)
      expect(result).not.toBeNull()
      expect(result!.title).toBe('UPDATED TITLE')
      expect(result!.author).toBe('NEW AUTHOR')
      expect(result!.rawText).toBe(newText)

      // Verify file on disk
      const onDisk = fs.readFileSync(path.join(tmpDir, 'my-song.txt'), 'utf-8')
      expect(onDisk).toBe(newText)
    })

    it('returns null for nonexistent song', async () => {
      const store = createDataStore(tmpDir)
      const result = await store.updateSong('nonexistent', 'text')
      expect(result).toBeNull()
    })
  })
})
