import * as Tone from 'tone'
import { toStandard } from 'songsheet'
import { chordToNotes, collectAllChords } from './chordUtils.ts'
import type { Song } from './types'

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

  scheduleSong(song: Song) {
    this.currentSong = song
    Tone.getTransport().cancel()

    // For playback, always use standard notation (letter roots) so MIDI works
    let playbackSong = song
    if (song.key) {
      playbackSong = toStandard(song, song.key)
    }

    const allChords = collectAllChords(playbackSong)
    if (allChords.length === 0) return

    const measureDur = Tone.Time('1m').toSeconds()
    this.measureDur = measureDur
    const beatDur = Tone.Time('4n').toSeconds()
    const eighthNoteDur = beatDur / 2

    allChords.forEach((item, i) => {
      const time = measureDur * i

      // Push chords are anticipated — sound an eighth note before the downbeat
      const chordTime = item.chord.push && time >= eighthNoteDur
        ? time - eighthNoteDur
        : time

      Tone.getTransport().schedule(t => {
        const notes = chordToNotes(item.chord)
        if (notes && this.synthRef) {
          this.synthRef.triggerAttackRelease(notes, '2n', t)
        }
      }, chordTime)

      // Highlight stays on the grid beat (not pushed early)
      Tone.getTransport().schedule(t => {
        Tone.getDraw().schedule(() => {
          this.callbacks.onPositionChange({
            structureIndex: item.structureIndex,
            lineIndex: item.lineIndex,
            markerIndex: item.markerIndex,
          })
        }, t)
      }, time)

      // Metronome: click on each beat of the measure
      const beatsInMeasure = Tone.getTransport().timeSignature as number
      for (let beat = 0; beat < beatsInMeasure; beat++) {
        Tone.getTransport().schedule(t => {
          if (this.callbacks.onMetronomeEnabledRead() && this.clickSynthRef) {
            this.clickSynthRef.triggerAttackRelease('32n', t)
          }
        }, time + beatDur * beat)
      }
    })

    // Schedule end-of-song stop
    const endTime = Tone.Time('1m').toSeconds() * allChords.length
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
    Tone.getTransport().timeSignature = song.timeSignature ? song.timeSignature.beats : 4
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

  setTimeSignature(beats: number) {
    Tone.getTransport().timeSignature = beats
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
