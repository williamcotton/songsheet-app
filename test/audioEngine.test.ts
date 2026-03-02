import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Tone.js mock ---
const mockTransport = {
  bpm: { value: 120 },
  timeSignature: 4,
  position: 0,
  seconds: 0,
  state: 'stopped' as string,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  schedule: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  cancel: vi.fn(),
}

const mockDraw = {
  schedule: vi.fn((cb: () => void) => cb()),
}

const mockSynthInstance = {
  toDestination: vi.fn().mockReturnThis(),
  triggerAttackRelease: vi.fn(),
  releaseAll: vi.fn(),
  dispose: vi.fn(),
}

const mockNoiseSynthInstance = {
  toDestination: vi.fn().mockReturnThis(),
  triggerAttackRelease: vi.fn(),
  dispose: vi.fn(),
}

let mockRawContextState = 'running'

vi.mock('tone', () => ({
  PolySynth: vi.fn(() => mockSynthInstance),
  Synth: vi.fn(),
  NoiseSynth: vi.fn(() => mockNoiseSynthInstance),
  getTransport: () => mockTransport,
  getDraw: () => mockDraw,
  start: vi.fn(async () => {}),
  now: vi.fn(() => 0),
  getContext: () => ({
    rawContext: {
      get state() { return mockRawContextState },
      resume: vi.fn(async () => {}),
    },
  }),
  setContext: vi.fn(),
  Context: vi.fn(),
}))

vi.mock('songsheet', () => ({
  toStandard: vi.fn((song: any) => song),
}))

import { AudioEngine } from '../src/audioEngine.ts'
import type { Song } from 'songsheet'

function createTestSong(): Song {
  return {
    title: 'Test',
    author: '',
    structure: [
      {
        section: 'VERSE',
        lines: [
          {
            chords: [
              { root: 'C', type: '', bass: '', column: 0, nashville: false },
              { root: 'G', type: '', bass: '', column: 10, nashville: false },
            ],
            barLines: [],
            lyrics: 'test',
          },
        ],
        chords: [],
      },
    ],
    playback: [
      {
        measureIndex: 0,
        structureIndex: 0,
        lineIndex: 0,
        timeSignature: { beats: 4, value: 4 },
        chords: [
          { root: 'C', type: '', bass: '', beatStart: 0, durationInBeats: 2, markerIndex: 0 },
          { root: 'G', type: '', bass: '', beatStart: 2, durationInBeats: 2, markerIndex: 1 },
        ],
      },
      {
        measureIndex: 1,
        structureIndex: 0,
        lineIndex: 0,
        timeSignature: { beats: 4, value: 4 },
        chords: [
          { root: 'A', type: 'm', bass: '', beatStart: 0, durationInBeats: 4, markerIndex: 2 },
        ],
      },
    ],
  } as unknown as Song
}

describe('AudioEngine', () => {
  let engine: AudioEngine
  const onPositionChange = vi.fn()
  const onPlaybackEnd = vi.fn()
  const onMetronomeEnabledRead = vi.fn(() => true)

  beforeEach(() => {
    vi.clearAllMocks()
    mockTransport.bpm.value = 120
    mockTransport.seconds = 0
    mockTransport.state = 'stopped'
    mockTransport.loop = false
    mockRawContextState = 'running'

    engine = new AudioEngine({
      onPositionChange,
      onPlaybackEnd,
      onMetronomeEnabledRead,
    })
  })

  describe('scheduleSong', () => {
    it('schedules chord, highlight, metronome, and end events at expected times', async () => {
      const song = createTestSong()
      const started = await engine.start(song, 120)
      expect(started).toBe(true)
      vi.clearAllMocks()
      engine.scheduleSong(song)

      expect(mockTransport.cancel).toHaveBeenCalledTimes(1)
      expect(mockTransport.schedule).toHaveBeenCalledTimes(15)

      const scheduledEvents = mockTransport.schedule.mock.calls.map(([callback, time]) => ({
        callback: callback as (time: number) => void,
        time: time as number,
      }))

      // measure 0: C sound/highlight at 0, G sound/highlight at 1, metronome beats at 0/0.5/1/1.5
      // measure 1: Am sound/highlight at 2, metronome beats at 2/2.5/3/3.5
      // end event: 4.001
      expect(scheduledEvents.map(event => event.time)).toEqual([
        0, 0, 1, 1, 0, 0.5, 1, 1.5,
        2, 2, 2, 2.5, 3, 3.5,
        4.001,
      ])

      // Run all scheduled events to assert callback side effects.
      for (const event of scheduledEvents) {
        event.callback(event.time)
      }

      expect(mockSynthInstance.triggerAttackRelease).toHaveBeenCalledTimes(3)
      const synthCalls = mockSynthInstance.triggerAttackRelease.mock.calls
      expect(synthCalls[0]?.[1]).toBeCloseTo(0.2)
      expect(synthCalls[0]?.[2]).toBe(0)
      expect(synthCalls[1]?.[1]).toBeCloseTo(0.2)
      expect(synthCalls[1]?.[2]).toBe(1)
      expect(synthCalls[2]?.[1]).toBeCloseTo(1.2)
      expect(synthCalls[2]?.[2]).toBe(2)

      expect(onPositionChange).toHaveBeenCalledTimes(3)
      expect(onPositionChange).toHaveBeenNthCalledWith(1, {
        structureIndex: 0,
        lineIndex: 0,
        markerIndex: 0,
      })
      expect(onPositionChange).toHaveBeenNthCalledWith(2, {
        structureIndex: 0,
        lineIndex: 0,
        markerIndex: 1,
      })
      expect(onPositionChange).toHaveBeenNthCalledWith(3, {
        structureIndex: 0,
        lineIndex: 0,
        markerIndex: 2,
      })

      expect(onMetronomeEnabledRead).toHaveBeenCalledTimes(8)
      expect(mockNoiseSynthInstance.triggerAttackRelease).toHaveBeenCalledTimes(8)
      expect(mockNoiseSynthInstance.triggerAttackRelease.mock.calls).toEqual([
        ['32n', 0],
        ['32n', 0.5],
        ['32n', 1],
        ['32n', 1.5],
        ['32n', 2],
        ['32n', 2.5],
        ['32n', 3],
        ['32n', 3.5],
      ])

      expect(onPlaybackEnd).toHaveBeenCalledTimes(1)
    })
  })

  describe('start', () => {
    it('starts transport with BPM and schedules song', async () => {
      const song = createTestSong()
      const result = await engine.start(song, 100)
      expect(result).toBe(true)
      expect(mockTransport.bpm.value).toBe(100)
      expect(mockTransport.start).toHaveBeenCalled()
      expect(mockTransport.schedule).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('stops transport, cancels events, releases synth', async () => {
      const song = createTestSong()
      await engine.start(song, 120)
      vi.clearAllMocks()

      engine.stop()
      expect(mockTransport.stop).toHaveBeenCalled()
      expect(mockTransport.cancel).toHaveBeenCalled()
      expect(mockSynthInstance.releaseAll).toHaveBeenCalled()
    })
  })

  describe('pause', () => {
    it('pauses transport and releases synth', async () => {
      const song = createTestSong()
      await engine.start(song, 120)
      vi.clearAllMocks()

      engine.pause()
      expect(mockTransport.pause).toHaveBeenCalled()
      expect(mockSynthInstance.releaseAll).toHaveBeenCalled()
    })
  })

  describe('seekTo', () => {
    it('sets transport.seconds based on measure duration', async () => {
      const song = createTestSong()
      await engine.start(song, 120)
      // BPM=120 → quarter = 0.5s → measure (4/4) = 2s
      engine.seekTo(1)
      expect(mockTransport.seconds).toBe(2)
    })
  })

  describe('setVamp / clearVamp', () => {
    it('enables and disables transport loop', async () => {
      const song = createTestSong()
      await engine.start(song, 120)

      engine.setVamp(0, 2)
      expect(mockTransport.loop).toBe(true)
      expect(mockTransport.loopStart).toBe(0)
      // 2s per measure × 2 = 4
      expect(mockTransport.loopEnd).toBe(4)

      engine.clearVamp()
      expect(mockTransport.loop).toBe(false)
    })
  })

  describe('setBpm', () => {
    it('updates transport BPM', () => {
      engine.setBpm(140)
      expect(mockTransport.bpm.value).toBe(140)
    })
  })

  describe('resume', () => {
    it('starts transport when context is running', async () => {
      mockRawContextState = 'running'
      const result = await engine.resume()
      expect(result).toBe(true)
      expect(mockTransport.start).toHaveBeenCalled()
    })
  })

  describe('ensureContextRunning (via resumeContext)', () => {
    it('no-ops when context is running', async () => {
      mockRawContextState = 'running'
      const result = await engine.resumeContext(false)
      expect(result).toBe(true)
    })
  })

  describe('dispose', () => {
    it('disposes synths and stops transport', async () => {
      const song = createTestSong()
      await engine.start(song, 120)
      vi.clearAllMocks()

      engine.dispose()
      expect(mockSynthInstance.dispose).toHaveBeenCalled()
      expect(mockNoiseSynthInstance.dispose).toHaveBeenCalled()
      expect(mockTransport.stop).toHaveBeenCalled()
      expect(mockTransport.cancel).toHaveBeenCalled()
    })
  })
})
