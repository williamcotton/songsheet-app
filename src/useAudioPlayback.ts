import { useState, useRef, useEffect, useCallback } from 'react'
import type { AudioEngine } from './audioEngine.ts'
import { findMeasureIndex, getMeasureRangeForSection } from './chordUtils.ts'
import type { Song, ActiveHighlight, PlaybackState } from './types'

export function useAudioPlayback(initialBpm: number = 72) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped')
  const [metronomeEnabled, setMetronomeEnabled] = useState(true)
  const [bpm, setBpm] = useState(initialBpm)
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null)
  const [vampSection, setVampSection] = useState<number | null>(null)

  const metronomeEnabledRef = useRef(false)
  const playbackStateRef = useRef<PlaybackState>('stopped')
  const vampSectionRef = useRef<number | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)

  // Derived values for backward compat
  const isPlaying = playbackState === 'playing'
  const isPaused = playbackState === 'paused'

  // Keep refs in sync with state to avoid stale closures in Tone.js callbacks
  useEffect(() => { metronomeEnabledRef.current = metronomeEnabled }, [metronomeEnabled])
  useEffect(() => { playbackStateRef.current = playbackState }, [playbackState])
  useEffect(() => { vampSectionRef.current = vampSection }, [vampSection])

  // Stable callback refs so the engine never gets stale closures
  const doStopPlayback = useCallback(() => {
    engineRef.current?.stop()
    setActiveHighlight(null)
    setPlaybackState('stopped')
    setVampSection(null)
  }, [])

  // Instantiate engine once (dynamic import keeps Tone.js out of SSR)
  useEffect(() => {
    let disposed = false
    import('./audioEngine.ts').then(({ AudioEngine }) => {
      if (disposed) return
      const engine = new AudioEngine({
        onPositionChange: (pos) => setActiveHighlight(pos),
        onPlaybackEnd: () => {
          engineRef.current?.stop()
          setActiveHighlight(null)
          setPlaybackState('stopped')
          setVampSection(null)
        },
        onMetronomeEnabledRead: () => metronomeEnabledRef.current,
      })
      engineRef.current = engine
    })
    return () => { disposed = true; engineRef.current?.dispose() }
  }, [])

  // Safari AudioContext resume workaround
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        await engineRef.current?.resumeContext(playbackStateRef.current === 'playing')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const startPlayback = useCallback(async (song: Song | null) => {
    if (!song) return
    if (playbackStateRef.current === 'paused') {
      engineRef.current?.resume()
      setPlaybackState('playing')
      return
    }
    if (playbackStateRef.current === 'playing') return
    await engineRef.current?.start(song, bpm)
    setPlaybackState('playing')
  }, [bpm])

  const pausePlayback = useCallback(() => {
    if (playbackStateRef.current !== 'playing') return
    engineRef.current?.pause()
    setPlaybackState('paused')
  }, [])

  const stopPlayback = useCallback(() => {
    doStopPlayback()
  }, [doStopPlayback])

  const seekTo = useCallback(async (song: Song, structureIndex: number, lineIndex: number) => {
    const measureIdx = findMeasureIndex(song.playback, structureIndex, lineIndex)
    if (measureIdx < 0) return

    if (playbackStateRef.current === 'stopped') {
      await engineRef.current?.start(song, bpm)
      setPlaybackState('playing')
    }
    engineRef.current?.seekTo(measureIdx)
  }, [bpm])

  const toggleVamp = useCallback((song: Song, structureIndex: number) => {
    if (vampSectionRef.current === structureIndex) {
      engineRef.current?.clearVamp()
      setVampSection(null)
      return
    }
    const range = getMeasureRangeForSection(song.playback, structureIndex)
    if (!range) return
    engineRef.current?.setVamp(range.start, range.end)
    setVampSection(structureIndex)
  }, [])

  const clearVamp = useCallback(() => {
    engineRef.current?.clearVamp()
    setVampSection(null)
  }, [])

  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm)
    engineRef.current?.setBpm(newBpm)
  }, [])

  const toggleMetronome = useCallback(() => {
    setMetronomeEnabled(v => !v)
  }, [])

  const reschedule = useCallback((song: Song) => {
    if (playbackStateRef.current !== 'stopped') {
      engineRef.current?.reschedule(song)
    }
  }, [])

  const setTimeSignature = useCallback((beats: number, value: number = 4) => {
    engineRef.current?.setTimeSignature(beats, value)
  }, [])

  return {
    isPlaying,
    isPaused,
    playbackState,
    metronomeEnabled,
    bpm,
    activeHighlight,
    vampSection,
    startPlayback,
    pausePlayback,
    stopPlayback,
    seekTo,
    toggleVamp,
    clearVamp,
    setBpm: handleBpmChange,
    toggleMetronome,
    reschedule,
    setTimeSignature,
  }
}
