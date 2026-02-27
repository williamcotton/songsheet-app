import * as Tone from 'tone'
import { toStandard } from 'songsheet'
import { chordToNotes } from './chordUtils.ts'
import type { Song, TimeSignature } from './types'

export interface PlaybackPosition {
  structureIndex: number
  lineIndex: number
  markerIndex: number
}

export interface AudioEngineCallbacks {
  onPositionChange: (position: PlaybackPosition) => void
  onPlaybackEnd: () => void
  onMetronomeEnabledRead: () => boolean
}

export class AudioEngine {
  private static readonly CHORD_RELEASE_GAP_SECONDS = 0.8
  private static readonly MIN_CHORD_DURATION_SECONDS = 0.03
  private synthRef: Tone.PolySynth | null = null
  private clickSynthRef: Tone.NoiseSynth | null = null
  private callbacks: AudioEngineCallbacks
  private currentSong: Song | null = null
  private measureDur: number = 0

  constructor(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks
  }

  private initSynth() {
    if (this.synthRef) this.synthRef.dispose()
    this.synthRef = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      voice: Tone.Synth,
      options: {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
        volume: -8,
      }
    } as unknown as Partial<Tone.SynthOptions>)
    this.synthRef.toDestination()

    if (this.clickSynthRef) this.clickSynthRef.dispose()
    this.clickSynthRef = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -12,
    })
    this.clickSynthRef.toDestination()
  }

  private getSongTimeSignature(song: Song): TimeSignature {
    return song.timeSignature || { beats: 4, value: 4 }
  }

  private getBeatDurationSeconds(timeSignature: TimeSignature): number {
    const quarterNoteDur = 60 / Tone.getTransport().bpm.value
    return quarterNoteDur * (4 / timeSignature.value)
  }

  private getMeasureDurationSeconds(timeSignature: TimeSignature): number {
    return this.getBeatDurationSeconds(timeSignature) * timeSignature.beats
  }

  private withReleaseGap(durationSeconds: number): number {
    return Math.max(
      AudioEngine.MIN_CHORD_DURATION_SECONDS,
      durationSeconds - AudioEngine.CHORD_RELEASE_GAP_SECONDS
    )
  }

  scheduleSong(song: Song) {
    this.currentSong = song
    Tone.getTransport().cancel()

    // For playback, always use standard notation (letter roots) so MIDI works
    let playbackSong = song
    if (song.key) {
      playbackSong = toStandard(song, song.key)
    }

    const playback = playbackSong.playback
    if (!playback || playback.length === 0) return

    const timeSignature = this.getSongTimeSignature(song)
    const measureDur = this.getMeasureDurationSeconds(timeSignature)
    this.measureDur = measureDur

    for (const measure of playback) {
      const measureStart = measureDur * measure.measureIndex
      const beatDur = measureDur / measure.timeSignature.beats
      const eighthNoteDur = beatDur / 2

      for (const chord of measure.chords) {
        const chordTime = measureStart + chord.beatStart * beatDur

        // Push chords: sound an eighth note early
        const soundTime = chord.push && chordTime >= eighthNoteDur
          ? chordTime - eighthNoteDur
          : chordTime

        // Determine note duration
        let noteDur: string | number = this.withReleaseGap(chord.durationInBeats * beatDur)
        if (chord.diamond) {
          noteDur = this.withReleaseGap(measureDur)
        } else if (chord.stop) {
          noteDur = '16n'  // short staccato
        }

        Tone.getTransport().schedule(t => {
          const notes = chordToNotes(chord)
          if (notes && this.synthRef) {
            this.synthRef.triggerAttackRelease(notes, noteDur, t)
          }
        }, soundTime)

        Tone.getTransport().schedule(t => {
          Tone.getDraw().schedule(() => {
            this.callbacks.onPositionChange({
              structureIndex: measure.structureIndex,
              lineIndex: measure.lineIndex,
              markerIndex: chord.markerIndex ?? 0,
            })
          }, t)
        }, soundTime)
      }

      // Metronome: click on each beat of the measure
      const beatsInMeasure = measure.timeSignature.beats
      for (let beat = 0; beat < beatsInMeasure; beat++) {
        Tone.getTransport().schedule(t => {
          if (this.callbacks.onMetronomeEnabledRead() && this.clickSynthRef) {
            this.clickSynthRef.triggerAttackRelease('32n', t)
          }
        }, measureStart + beatDur * beat)
      }
    }

    // Schedule end-of-song stop
    const endTime = measureDur * playback.length
    Tone.getTransport().schedule(() => {
      Tone.getDraw().schedule(() => {
        this.callbacks.onPlaybackEnd()
      }, Tone.now())
    }, endTime)
  }

  async start(song: Song, bpm: number) {
    await Tone.start()
    // Safari: explicitly resume raw context as fallback
    const ctx = Tone.getContext().rawContext
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume()
    }
    this.initSynth()
    Tone.getTransport().bpm.value = bpm
    const timeSignature = song.timeSignature
    Tone.getTransport().timeSignature = timeSignature ? [timeSignature.beats, timeSignature.value] : 4
    Tone.getTransport().position = 0
    this.scheduleSong(song)
    Tone.getTransport().start()
  }

  stop() {
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
    Tone.getTransport().loop = false
    if (this.synthRef) this.synthRef.releaseAll()
    this.currentSong = null
  }

  reschedule(song: Song) {
    this.scheduleSong(song)
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm
  }

  setTimeSignature(beats: number, value: number = 4) {
    Tone.getTransport().timeSignature = value === 4 ? beats : [beats, value]
  }

  pause() {
    Tone.getTransport().pause()
    if (this.synthRef) this.synthRef.releaseAll()
  }

  resume() {
    Tone.getTransport().start()
  }

  seekTo(chordIndex: number) {
    if (this.synthRef) this.synthRef.releaseAll()
    if (this.currentSong) {
      this.scheduleSong(this.currentSong)
    }
    Tone.getTransport().seconds = this.measureDur * chordIndex
  }

  setVamp(startChordIndex: number, endChordIndex: number) {
    Tone.getTransport().loopStart = this.measureDur * startChordIndex
    Tone.getTransport().loopEnd = this.measureDur * endChordIndex
    Tone.getTransport().loop = true
  }

  clearVamp() {
    Tone.getTransport().loop = false
  }

  async resumeContext(isPlaying: boolean) {
    const ctx = Tone.getContext().rawContext
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume()
    }
    // Safari can invalidate synth nodes after suspension — re-init if playing
    if (isPlaying) {
      this.initSynth()
    }
  }

  dispose() {
    if (this.synthRef) this.synthRef.dispose()
    if (this.clickSynthRef) this.clickSynthRef.dispose()
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
  }
}
