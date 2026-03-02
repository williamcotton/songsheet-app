import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the audioEngine module
const mockEngine = {
  start: vi.fn(async () => true),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(async () => true),
  seekTo: vi.fn(),
  setBpm: vi.fn(),
  setVamp: vi.fn(),
  clearVamp: vi.fn(),
  reschedule: vi.fn(),
  setTimeSignature: vi.fn(),
  resumeContext: vi.fn(async () => true),
  dispose: vi.fn(),
}

vi.mock('../src/audioEngine.ts', () => ({
  AudioEngine: vi.fn().mockImplementation(() => mockEngine),
}))

import { useAudioPlayback } from '../src/useAudioPlayback.ts'
import type { Song } from 'songsheet'

function createTestSong(): Song {
  return {
    title: 'Test',
    author: '',
    bpm: 100,
    structure: [],
    playback: [
      {
        measureIndex: 0,
        structureIndex: 0,
        lineIndex: 0,
        timeSignature: { beats: 4, value: 4 },
        chords: [],
      },
    ],
  } as unknown as Song
}

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has correct initial state', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    // Wait for dynamic import to resolve
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    expect(result.current.playbackState).toBe('stopped')
    expect(result.current.metronomeEnabled).toBe(true)
    expect(result.current.bpm).toBe(72)
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.isPaused).toBe(false)
    expect(result.current.activeHighlight).toBeNull()
  })

  it('respects initialBpm', async () => {
    const { result } = renderHook(() => useAudioPlayback({ initialBpm: 140 }))
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })
    expect(result.current.bpm).toBe(140)
  })

  it('startPlayback transitions to playing', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    await act(async () => {
      await result.current.startPlayback(createTestSong())
    })

    expect(result.current.playbackState).toBe('playing')
    expect(result.current.isPlaying).toBe(true)
  })

  it('pausePlayback transitions to paused', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    await act(async () => {
      await result.current.startPlayback(createTestSong())
    })

    act(() => {
      result.current.pausePlayback()
    })

    expect(result.current.playbackState).toBe('paused')
    expect(result.current.isPaused).toBe(true)
  })

  it('resume from paused calls engine.resume', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    await act(async () => {
      await result.current.startPlayback(createTestSong())
    })

    act(() => {
      result.current.pausePlayback()
    })

    await act(async () => {
      await result.current.startPlayback(createTestSong())
    })

    expect(mockEngine.resume).toHaveBeenCalled()
    expect(result.current.playbackState).toBe('playing')
  })

  it('stopPlayback transitions to stopped and clears highlight', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    await act(async () => {
      await result.current.startPlayback(createTestSong())
    })

    act(() => {
      result.current.stopPlayback()
    })

    expect(result.current.playbackState).toBe('stopped')
    expect(result.current.activeHighlight).toBeNull()
  })

  it('setBpm updates bpm and calls engine', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    act(() => {
      result.current.setBpm(100)
    })

    expect(result.current.bpm).toBe(100)
    expect(mockEngine.setBpm).toHaveBeenCalledWith(100)
  })

  it('toggleMetronome toggles metronomeEnabled', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    expect(result.current.metronomeEnabled).toBe(true)

    act(() => {
      result.current.toggleMetronome()
    })

    expect(result.current.metronomeEnabled).toBe(false)

    act(() => {
      result.current.toggleMetronome()
    })

    expect(result.current.metronomeEnabled).toBe(true)
  })

  it('does not start playback with null song', async () => {
    const { result } = renderHook(() => useAudioPlayback())
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    await act(async () => {
      await result.current.startPlayback(null)
    })

    expect(result.current.playbackState).toBe('stopped')
  })
})
