import { useState, useRef, useEffect, useCallback } from 'react'
import { AudioEngine } from './audioEngine.ts'
import type { Song, ActiveHighlight } from './types'

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(true)
  const [bpm, setBpm] = useState(72)
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null)

  const metronomeEnabledRef = useRef(false)
  const isPlayingRef = useRef(false)
  const engineRef = useRef<AudioEngine | null>(null)

  // Keep refs in sync with state to avoid stale closures in Tone.js callbacks
  useEffect(() => { metronomeEnabledRef.current = metronomeEnabled }, [metronomeEnabled])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Stable callback refs so the engine never gets stale closures
  const doStopPlayback = useCallback(() => {
    engineRef.current?.stop()
    setActiveHighlight(null)
    setIsPlaying(false)
  }, [])

  // Instantiate engine once
  useEffect(() => {
    const engine = new AudioEngine({
      onPositionChange: (pos) => setActiveHighlight(pos),
      onPlaybackEnd: () => {
        engineRef.current?.stop()
        setActiveHighlight(null)
        setIsPlaying(false)
      },
      onMetronomeEnabledRead: () => metronomeEnabledRef.current,
    })
    engineRef.current = engine
    return () => engine.dispose()
  }, [])

  // Safari AudioContext resume workaround
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        await engineRef.current?.resumeContext(isPlayingRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const startPlayback = useCallback(async (song: Song | null) => {
    if (!song || isPlayingRef.current) return
    await engineRef.current?.start(song, bpm)
    setIsPlaying(true)
  }, [bpm])

  const stopPlayback = useCallback(() => {
    doStopPlayback()
  }, [doStopPlayback])

  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm)
    engineRef.current?.setBpm(newBpm)
  }, [])

  const toggleMetronome = useCallback(() => {
    setMetronomeEnabled(v => !v)
  }, [])

  const reschedule = useCallback((song: Song) => {
    if (isPlayingRef.current) {
      engineRef.current?.reschedule(song)
    }
  }, [])

  const setTimeSignature = useCallback((beats: number) => {
    engineRef.current?.setTimeSignature(beats)
  }, [])

  return {
    isPlaying,
    metronomeEnabled,
    bpm,
    activeHighlight,
    startPlayback,
    stopPlayback,
    setBpm: handleBpmChange,
    toggleMetronome,
    reschedule,
    setTimeSignature,
  }
}
