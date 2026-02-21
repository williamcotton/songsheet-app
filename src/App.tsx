import { useState, useRef, useEffect, useMemo } from 'react'
import { parse, transpose, toNashville, toStandard } from 'songsheet'
import * as Tone from 'tone'
import { chordToNotes, chordName, chordDisplayText, expressionToString, collectAllChords } from './chordUtils.ts'
import type { Song, Line, Chord, ActiveHighlight } from './types'

const SONGS = [
  { value: 'sleeping-on-the-road.txt', label: 'Sleeping on the Road' },
  { value: 'spent-some-time-in-buffalo.txt', label: 'Spent Some Time in Buffalo' },
  { value: 'riot-on-a-screen.txt', label: 'Riot on a Screen' },
  { value: 'america.txt', label: 'America' },
  { value: 'a-way-out-online.txt', label: 'A Way Out Online' },
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
  const [nashvilleMode, setNashvilleMode] = useState(false)

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

  // Derive displaySong: applies Nashville conversion for rendering
  const displaySong = useMemo(() => {
    if (!currentSong) return null
    const key = currentSong.key
    if (!key) return currentSong
    if (nashvilleMode) return toNashville(currentSong, key)
    return toStandard(currentSong, key)
  }, [currentSong, nashvilleMode])

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

    // For playback, always use standard notation (letter roots) so MIDI works
    let playbackSong = song
    if (song.key) {
      playbackSong = toStandard(song, song.key)
    }

    const allChords = collectAllChords(playbackSong)
    if (allChords.length === 0) return

    const measureDur = Tone.Time('1m').toSeconds()
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
        if (notes && synthRef.current) {
          synthRef.current.triggerAttackRelease(notes, '2n', t)
        }
      }, chordTime)

      // Highlight stays on the grid beat (not pushed early)
      Tone.getTransport().schedule(t => {
        Tone.getDraw().schedule(() => {
          setActiveHighlight({
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
          if (metronomeEnabledRef.current && clickSynthRef.current) {
            clickSynthRef.current.triggerAttackRelease('32n', t)
          }
        }, time + beatDur * beat)
      }
    })

    // Schedule end-of-song stop
    const endTime = Tone.Time('1m').toSeconds() * allChords.length
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
    Tone.getTransport().timeSignature = song.timeSignature ? song.timeSignature.beats : 4
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
      Tone.getTransport().timeSignature = parsed.timeSignature ? parsed.timeSignature.beats : 4
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

  function renderChordMarker(chord: Chord, si: number, li: number, mi: number, highlight: ActiveHighlight | null): React.ReactNode {
    const isActive = highlight &&
      highlight.structureIndex === si &&
      highlight.lineIndex === li &&
      highlight.markerIndex === mi
    const name = chordName(chord)
    const nashvilleClass = chord.nashville ? ' chord-nashville' : ''

    if (chord.diamond) {
      return (
        <span
          key={`${si}-${li}-${mi}`}
          className={'chord-marker chord-diamond' + (isActive ? ' active-marker' : '') + nashvilleClass}
          data-si={si} data-li={li} data-mi={mi}
        >
          <span className="chord-decorator">{'<'}</span>{name}<span className="chord-decorator">{'>'}</span>
        </span>
      )
    }
    if (chord.push) {
      return (
        <span
          key={`${si}-${li}-${mi}`}
          className={'chord-marker chord-push' + (isActive ? ' active-marker' : '') + nashvilleClass}
          data-si={si} data-li={li} data-mi={mi}
        >
          <span className="chord-decorator">{'^'}</span>{name}{chord.stop && <span className="chord-decorator">{'!'}</span>}
        </span>
      )
    }
    if (chord.stop && !chord.push) {
      return (
        <span
          key={`${si}-${li}-${mi}`}
          className={'chord-marker chord-stop' + (isActive ? ' active-marker' : '') + nashvilleClass}
          data-si={si} data-li={li} data-mi={mi}
        >
          {name}<span className="chord-decorator">{'!'}</span>
        </span>
      )
    }
    if (chord.splitMeasure) {
      const inner = chord.splitMeasure.map(c => c.root + c.type + (c.bass ? '/' + c.bass : '')).join(' ')
      return (
        <span
          key={`${si}-${li}-${mi}`}
          className={'chord-marker chord-split' + (isActive ? ' active-marker' : '') + nashvilleClass}
          data-si={si} data-li={li} data-mi={mi}
        >
          <span className="chord-decorator">{'['}</span>{inner}<span className="chord-decorator">{']'}</span>
        </span>
      )
    }

    return (
      <span
        key={`${si}-${li}-${mi}`}
        className={'chord-marker' + (isActive ? ' active-marker' : '') + nashvilleClass}
        data-si={si} data-li={li} data-mi={mi}
      >
        {name}
      </span>
    )
  }

  function renderChordRow(line: Line, si: number, li: number, highlight: ActiveHighlight | null): React.ReactNode[] {
    const markers: { col: number; chord?: Chord; isBar?: boolean }[] = []
    for (const chord of line.chords) {
      markers.push({ col: chord.column, chord })
    }
    for (const bar of line.barLines) {
      markers.push({ col: bar.column, isBar: true })
    }
    markers.sort((a, b) => a.col - b.col)

    const elements: React.ReactNode[] = []
    let pos = 0
    markers.forEach((m, mi) => {
      if (m.col > pos) {
        elements.push(' '.repeat(m.col - pos))
      }
      if (m.isBar) {
        const isBarActive = highlight &&
          highlight.structureIndex === si &&
          highlight.lineIndex === li &&
          highlight.markerIndex === mi
        elements.push(
          <span key={`${si}-${li}-bar-${mi}`} className={'chord-marker' + (isBarActive ? ' active-marker' : '')}>|</span>
        )
        pos = m.col + 1
      } else if (m.chord) {
        elements.push(renderChordMarker(m.chord, si, li, mi, highlight))
        pos = m.col + chordDisplayText(m.chord).length
      }
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
              className={'chord-marker' + (isActive ? ' active-marker' : '') + (c.nashville ? ' chord-nashville' : '')}
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

        <div className="control-group">
          <button
            id="btn-nashville"
            className={nashvilleMode ? 'on' : ''}
            disabled={!currentSong?.key}
            title="Toggle Nashville Number System"
            onClick={() => setNashvilleMode(v => !v)}
          >
            NNS
          </button>
        </div>
      </div>

      <div id="song-display">
        {renderSongContent(displaySong, activeHighlight)}
      </div>
    </>
  )
}
