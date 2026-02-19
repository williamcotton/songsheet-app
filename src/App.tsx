import { useState, useRef, useEffect } from 'react'
import { parse, transpose } from '../../songsheet/index.js'
import * as Tone from 'tone'
import { chordToNotes, chordName, expressionToString, collectAllChords } from './chordUtils.ts'
import type { Song, Line, ActiveHighlight } from './types'

const SONGS = [
  { value: 'sleeping-on-the-road.txt', label: 'Sleeping on the Road' },
  { value: 'spent-some-time-in-buffalo.txt', label: 'Spent Some Time in Buffalo' },
  { value: 'riot-on-a-screen.txt', label: 'Riot on a Screen' },
]

export default function App() {
  const [originalSong, setOriginalSong] = useState<Song | null>(null)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [semitoneOffset, setSemitoneOffset] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(true)
  const [bpm, setBpm] = useState(72)
  const [selectedFile, setSelectedFile] = useState('')
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null)

  const synthRef = useRef<Tone.PolySynth | null>(null)
  const clickSynthRef = useRef<Tone.NoiseSynth | null>(null)
  const metronomeEnabledRef = useRef(false)
  const isPlayingRef = useRef(false)
  const scrollTargetRef = useRef(0)
  const scrollAnimRef = useRef<number | null>(null)
  const controlsRef = useRef<HTMLDivElement>(null)

  // Keep refs in sync with state to avoid stale closures in Tone.js callbacks
  useEffect(() => { metronomeEnabledRef.current = metronomeEnabled }, [metronomeEnabled])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Update scroll target when highlight changes
  useEffect(() => {
    if (!activeHighlight || scrollAnimRef.current === null) return
    const { structureIndex, lineIndex } = activeHighlight
    const sectionEl = document.querySelector(`.section[data-structure-index="${structureIndex}"]`)
    if (!sectionEl) return
    const scrollEl = (lineIndex >= 0)
      ? sectionEl.querySelector(`.line-pair[data-line-index="${lineIndex}"]`) || sectionEl
      : sectionEl
    const controlsHeight = controlsRef.current ? controlsRef.current.offsetHeight : 0
    let target = (scrollEl as HTMLElement).offsetTop - controlsHeight - window.innerHeight * 0.3
    target = Math.max(0, target)
    scrollTargetRef.current = target
  }, [activeHighlight])

  // Resume AudioContext when tab becomes visible again (Safari suspends it)
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const ctx = Tone.getContext().rawContext
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume()
        }
        // Safari can invalidate synth nodes after suspension — re-init if playing
        if (isPlayingRef.current) {
          initSynth()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) synthRef.current.dispose()
      if (clickSynthRef.current) clickSynthRef.current.dispose()
      Tone.getTransport().stop()
      Tone.getTransport().cancel()
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current)
      }
    }
  }, [])

  function initSynth() {
    if (synthRef.current) synthRef.current.dispose()
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      voice: Tone.Synth,
      options: {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
        volume: -8,
      }
    } as unknown as Partial<Tone.SynthOptions>)
    synthRef.current.toDestination()

    if (clickSynthRef.current) clickSynthRef.current.dispose()
    clickSynthRef.current = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -12,
    })
    clickSynthRef.current.toDestination()
  }

  function scheduleSong(song: Song) {
    Tone.getTransport().cancel()

    const allChords = collectAllChords(song)
    if (allChords.length === 0) return

    const measureDur = Tone.Time('1n').toSeconds()
    const beatDur = Tone.Time('4n').toSeconds()

    allChords.forEach((item, i) => {
      const time = measureDur * i
      Tone.getTransport().schedule(t => {
        const notes = chordToNotes(item.chord)
        if (notes && synthRef.current) {
          synthRef.current.triggerAttackRelease(notes, '2n', t)
        }
        Tone.getDraw().schedule(() => {
          setActiveHighlight({
            structureIndex: item.structureIndex,
            lineIndex: item.lineIndex,
            markerIndex: item.markerIndex,
          })
        }, t)
      }, time)

      // Metronome: 4 clicks per measure
      for (let beat = 0; beat < 4; beat++) {
        Tone.getTransport().schedule(t => {
          if (metronomeEnabledRef.current && clickSynthRef.current) {
            clickSynthRef.current.triggerAttackRelease('32n', t)
          }
        }, time + beatDur * beat)
      }
    })

    // Schedule end-of-song stop
    const endTime = Tone.Time('1n').toSeconds() * allChords.length
    Tone.getTransport().schedule(() => {
      Tone.getDraw().schedule(() => {
        doStopPlayback()
      }, Tone.now())
    }, endTime)
  }

  function startAutoScroll() {
    scrollTargetRef.current = window.scrollY
    function tick() {
      const diff = scrollTargetRef.current - window.scrollY
      if (Math.abs(diff) > 0.5) {
        window.scrollTo(0, window.scrollY + diff * 0.08)
      }
      scrollAnimRef.current = requestAnimationFrame(tick)
    }
    scrollAnimRef.current = requestAnimationFrame(tick)
  }

  function stopAutoScroll() {
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
    }
  }

  function doStopPlayback() {
    stopAutoScroll()
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
    if (synthRef.current) synthRef.current.releaseAll()
    setActiveHighlight(null)
    setIsPlaying(false)
  }

  async function startPlayback(song: Song | null) {
    if (!song || isPlayingRef.current) return

    await Tone.start()
    // Safari: explicitly resume raw context as fallback
    const ctx = Tone.getContext().rawContext
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume()
    }
    initSynth()
    Tone.getTransport().bpm.value = bpm
    Tone.getTransport().position = 0
    scheduleSong(song)
    Tone.getTransport().start()

    setIsPlaying(true)
    startAutoScroll()
  }

  async function handleSongChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const filename = e.target.value
    setSelectedFile(filename)

    if (isPlayingRef.current) doStopPlayback()

    if (filename) {
      const resp = await fetch('/songs/' + filename)
      const text = await resp.text()
      const parsed = parse(text)
      setOriginalSong(parsed)
      setSemitoneOffset(0)
      setCurrentSong(parsed)
      if (parsed.bpm) {
        setBpm(parsed.bpm)
        Tone.getTransport().bpm.value = parsed.bpm
      }
    } else {
      setOriginalSong(null)
      setCurrentSong(null)
    }
  }

  function handleBpmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    setBpm(val)
    Tone.getTransport().bpm.value = val
  }

  function applyTranspose(delta: number, origSong: Song | null, offset: number) {
    if (!origSong) return
    const newOffset = offset + delta
    setSemitoneOffset(newOffset)
    const newSong = newOffset === 0 ? origSong : transpose(origSong, newOffset)
    setCurrentSong(newSong)
    if (isPlayingRef.current) {
      scheduleSong(newSong)
    }
  }

  function transposeLabel(offset: number): string {
    if (offset === 0) return '0'
    return (offset >= 0 ? '+' : '') + offset
  }

  // ─── Rendering helpers ────────────────────────────────────────────

  function renderChordRow(line: Line, si: number, li: number, highlight: ActiveHighlight | null): React.ReactNode[] {
    const markers: { col: number; text: string }[] = []
    for (const chord of line.chords) {
      markers.push({ col: chord.column, text: chordName(chord) })
    }
    for (const col of line.barLines) {
      markers.push({ col, text: '|' })
    }
    markers.sort((a, b) => a.col - b.col)

    const elements: React.ReactNode[] = []
    let pos = 0
    markers.forEach((m, mi) => {
      if (m.col > pos) {
        elements.push('\u00A0'.repeat(m.col - pos))
      }
      const isActive = highlight &&
        highlight.structureIndex === si &&
        highlight.lineIndex === li &&
        highlight.markerIndex === mi
      elements.push(
        <span
          key={`${si}-${li}-${mi}`}
          className={'chord-marker' + (isActive ? ' active-marker' : '')}
          data-si={si}
          data-li={li}
          data-mi={mi}
        >
          {m.text}
        </span>
      )
      pos = m.col + m.text.length
    })
    return elements
  }

  function renderSongContent(song: Song | null, highlight: ActiveHighlight | null): React.ReactNode {
    if (!song) {
      return <p className="no-song">Select a song to get started.</p>
    }

    const elements: React.ReactNode[] = []

    elements.push(<div key="title" id="song-title">{song.title}</div>)
    elements.push(<div key="author" id="song-author">{song.author}</div>)

    song.structure.forEach((entry, si) => {
      const isSectionActive = highlight && highlight.structureIndex === si
      const label = entry.sectionType.charAt(0).toUpperCase() + entry.sectionType.slice(1)
      const indexLabel = entry.sectionIndex > 0 ? ' ' + (entry.sectionIndex + 1) : ''

      const sectionChildren: React.ReactNode[] = []
      sectionChildren.push(
        <div key="header" className="section-header">{label + indexLabel}</div>
      )

      if (entry.lines.length > 0) {
        entry.lines.forEach((line, li) => {
          const isLineActive = highlight &&
            highlight.structureIndex === si &&
            highlight.lineIndex === li

          const pairChildren: React.ReactNode[] = []

          if (line.chords.length > 0 || line.barLines.length > 0) {
            pairChildren.push(
              <div key="chords" className="chord-row">
                {renderChordRow(line, si, li, highlight)}
              </div>
            )
          }

          if (line.lyrics) {
            pairChildren.push(
              <div key="lyrics" className="lyric-row">{line.lyrics}</div>
            )
          }

          sectionChildren.push(
            <div
              key={`line-${li}`}
              className={'line-pair' + (isLineActive ? ' active-line' : '')}
              data-line-index={li}
            >
              {pairChildren}
            </div>
          )
        })

        if (entry.expression) {
          sectionChildren.push(
            <div key="expr" className="expression-label">
              {'(' + expressionToString(entry.expression) + ')'}
            </div>
          )
        }
      } else if (entry.chords.length > 0) {
        const chordChildren: React.ReactNode[] = []
        entry.chords.forEach((c, ci) => {
          if (ci > 0) chordChildren.push('  ')
          const isActive = highlight &&
            highlight.structureIndex === si &&
            highlight.lineIndex === -1 &&
            highlight.markerIndex === ci
          chordChildren.push(
            <span
              key={`${si}-d-${ci}`}
              className={'chord-marker' + (isActive ? ' active-marker' : '')}
              data-si={si}
              data-li={-1}
              data-mi={ci}
            >
              {chordName(c)}
            </span>
          )
        })
        if (entry.expression) {
          chordChildren.push(
            <span key="expr" className="expression-label">
              {'  (' + expressionToString(entry.expression) + ')'}
            </span>
          )
        }
        sectionChildren.push(
          <div key="directive-chords" className="directive-chords">
            {chordChildren}
          </div>
        )
      }

      elements.push(
        <div
          key={`section-${si}`}
          className={'section' + (isSectionActive ? ' active-section' : '')}
          data-structure-index={si}
        >
          {sectionChildren}
        </div>
      )
    })

    return elements
  }

  // ─── JSX ──────────────────────────────────────────────────────────

  return (
    <>
      <div id="controls" ref={controlsRef}>
        <select
          id="song-select"
          value={selectedFile}
          onChange={handleSongChange}
        >
          <option value="">Select a song...</option>
          {SONGS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="control-group">
          <button
            id="btn-play"
            disabled={!currentSong || isPlaying}
            onClick={() => startPlayback(currentSong)}
          >
            Play
          </button>
          <button
            id="btn-stop"
            disabled={!isPlaying}
            onClick={doStopPlayback}
          >
            Stop
          </button>
          <button
            id="btn-metronome"
            className={metronomeEnabled ? 'on' : ''}
            title="Toggle metronome"
            onClick={() => setMetronomeEnabled(v => !v)}
          >
            Met.
          </button>
        </div>

        <div className="control-group">
          <label>BPM</label>
          <input
            type="range"
            id="bpm-slider"
            min="40"
            max="160"
            value={bpm}
            onChange={handleBpmChange}
          />
          <span id="bpm-value">{bpm}</span>
        </div>

        <div className="control-group">
          <label>Transpose</label>
          <button
            id="btn-transpose-down"
            onClick={() => applyTranspose(-1, originalSong, semitoneOffset)}
          >
            -
          </button>
          <span id="transpose-value">{transposeLabel(semitoneOffset)}</span>
          <button
            id="btn-transpose-up"
            onClick={() => applyTranspose(1, originalSong, semitoneOffset)}
          >
            +
          </button>
        </div>
      </div>

      <div id="song-display">
        {renderSongContent(currentSong, activeHighlight)}
      </div>
    </>
  )
}
