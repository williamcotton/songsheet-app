import { useState, useRef, useEffect, useMemo } from 'react'
import { parse, transpose, toNashville, toStandard } from 'songsheet'
import { chordName, chordDisplayText, expressionToString } from './chordUtils.ts'
import { useAudioPlayback } from './useAudioPlayback.ts'
import { useAutoScroll } from './useAutoScroll.ts'
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
  const [selectedFile, setSelectedFile] = useState('')
  const [nashvilleMode, setNashvilleMode] = useState(false)

  const controlsRef = useRef<HTMLDivElement>(null)

  const audio = useAudioPlayback()
  const { scrollTo } = useAutoScroll({ isScrolling: audio.isPlaying })

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
    if (!audio.activeHighlight) return
    const { structureIndex, lineIndex } = audio.activeHighlight
    const sectionEl = document.querySelector(`.section[data-structure-index="${structureIndex}"]`)
    if (!sectionEl) return
    const scrollEl = (lineIndex >= 0)
      ? sectionEl.querySelector(`.line-pair[data-line-index="${lineIndex}"]`) || sectionEl
      : sectionEl
    const controlsHeight = controlsRef.current ? controlsRef.current.offsetHeight : 0
    let target = (scrollEl as HTMLElement).offsetTop - controlsHeight - window.innerHeight * 0.3
    target = Math.max(0, target)
    if (audio.isPlaying) {
      scrollTo(target)
    } else {
      // When paused or seeking while paused, jump instantly
      window.scrollTo(0, target)
    }
  }, [audio.activeHighlight, audio.isPlaying, scrollTo])

  async function handleSongChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const filename = e.target.value
    setSelectedFile(filename)

    if (audio.playbackState !== 'stopped') audio.stopPlayback()

    if (filename) {
      const resp = await fetch('/songs/' + filename)
      const text = await resp.text()
      const parsed = parse(text)
      setOriginalSong(parsed)
      setSemitoneOffset(0)
      setCurrentSong(parsed)
      if (parsed.bpm) {
        audio.setBpm(parsed.bpm)
      }
      audio.setTimeSignature(parsed.timeSignature ? parsed.timeSignature.beats : 4)
    } else {
      setOriginalSong(null)
      setCurrentSong(null)
    }
  }

  function applyTranspose(delta: number, origSong: Song | null, offset: number) {
    if (!origSong) return
    const newOffset = offset + delta
    setSemitoneOffset(newOffset)
    const newSong = newOffset === 0 ? origSong : transpose(origSong, newOffset)
    setCurrentSong(newSong)
    audio.reschedule(newSong)
  }

  function transposeLabel(offset: number): string {
    if (offset === 0) return '0'
    return (offset >= 0 ? '+' : '') + offset
  }

  // ─── Click-to-seek & vamp handlers ──────────────────────────────

  function handleSongClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!currentSong) return
    if (e.detail > 1) return // ignore double-clicks

    const target = e.target as HTMLElement
    const linePair = target.closest('.line-pair') as HTMLElement | null
    const section = target.closest('.section') as HTMLElement | null
    if (!section) return

    const si = parseInt(section.dataset.structureIndex ?? '', 10)
    if (isNaN(si)) return

    let li = 0
    if (linePair) {
      li = parseInt(linePair.dataset.lineIndex ?? '0', 10)
    } else {
      // Clicked on directive-chords or section header area
      li = -1
    }

    audio.seekTo(currentSong, si, li)
  }

  function handleSectionDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!currentSong) return
    const target = e.target as HTMLElement
    const header = target.closest('.section-header') as HTMLElement | null
    if (!header) return
    const section = header.closest('.section') as HTMLElement | null
    if (!section) return
    const si = parseInt(section.dataset.structureIndex ?? '', 10)
    if (isNaN(si)) return
    audio.toggleVamp(currentSong, si)
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
      const isVamped = audio.vampSection === si
      const label = entry.sectionType.charAt(0).toUpperCase() + entry.sectionType.slice(1)
      const indexLabel = entry.sectionIndex > 0 ? ' ' + (entry.sectionIndex + 1) : ''

      const sectionChildren: React.ReactNode[] = []
      sectionChildren.push(
        <div key="header" className="section-header">
          {label + indexLabel}
          {isVamped && <span className="vamp-badge">looping</span>}
        </div>
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
          className={'section' + (isSectionActive ? ' active-section' : '') + (isVamped ? ' vamped-section' : '')}
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
          {audio.isPlaying ? (
            <button
              id="btn-pause"
              onClick={audio.pausePlayback}
            >
              Pause
            </button>
          ) : (
            <button
              id="btn-play"
              disabled={!currentSong}
              onClick={() => audio.startPlayback(currentSong)}
            >
              {audio.isPaused ? 'Resume' : 'Play'}
            </button>
          )}
          <button
            id="btn-stop"
            disabled={audio.playbackState === 'stopped'}
            onClick={audio.stopPlayback}
          >
            Stop
          </button>
          <button
            id="btn-metronome"
            className={audio.metronomeEnabled ? 'on' : ''}
            title="Toggle metronome"
            onClick={audio.toggleMetronome}
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
            value={audio.bpm}
            onChange={e => audio.setBpm(parseInt(e.target.value, 10))}
          />
          <span id="bpm-value">{audio.bpm}</span>
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

      <div id="song-display" onClick={handleSongClick} onDoubleClick={handleSectionDoubleClick}>
        {renderSongContent(displaySong, audio.activeHighlight)}
      </div>
    </>
  )
}
