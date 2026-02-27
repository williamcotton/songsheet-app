import type { Chord, BarLine, Expression, Song, ChordPlaybackItem, PlaybackMeasure } from './types'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_TO_SEMITONE: Record<string, number> = {}
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }

NOTE_NAMES.forEach((n, i) => NOTE_TO_SEMITONE[n] = i)
Object.entries(FLAT_MAP).forEach(([flat, sharp]) => NOTE_TO_SEMITONE[flat] = NOTE_TO_SEMITONE[sharp])

const CHORD_INTERVALS: Record<string, number[]> = {
  '':     [0, 4, 7],
  'm':    [0, 3, 7],
  '7':    [0, 4, 7, 10],
  'm7':   [0, 3, 7, 10],
  'maj7': [0, 4, 7, 11],
  'dim':  [0, 3, 6],
  'aug':  [0, 4, 8],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
}

export function chordToNotes(chord: Chord): string[] | null {
  if (!chord || !chord.root) return null
  if (chord.nashville) return null
  const rootSemitone = NOTE_TO_SEMITONE[chord.root]
  if (rootSemitone === undefined) return null
  const intervals = CHORD_INTERVALS[chord.type] || CHORD_INTERVALS['']
  const notes = intervals.map(interval => {
    const semitone = (rootSemitone + interval) % 12
    const octave = semitone < rootSemitone ? 4 : 3
    return NOTE_NAMES[semitone] + octave
  })
  if (chord.bass) {
    const bassSemitone = NOTE_TO_SEMITONE[chord.bass]
    if (bassSemitone !== undefined) {
      notes.unshift(NOTE_NAMES[bassSemitone] + 2)
    }
  }
  return notes
}

export function chordName(chord: Chord): string {
  if (!chord || !chord.root) return ''
  return chord.root + chord.type + (chord.bass ? '/' + chord.bass : '')
}

export function chordDisplayText(chord: Chord): string {
  const name = chordName(chord)
  if (chord.diamond) return '<' + name + '>'
  if (chord.push) return '^' + name + (chord.stop ? '!' : '')
  if (chord.stop) return name + '!'
  if (chord.splitMeasure) {
    return '[' + chord.splitMeasure.map(c => c.root + c.type + (c.bass ? '/' + c.bass : '')).join(' ') + ']'
  }
  return name
}

export function chordDisplayWidth(chord: Chord): number {
  return chordDisplayText(chord).length
}

export function expressionToString(expr: Expression | null): string {
  if (!expr) return ''
  switch (expr.type) {
    case 'section_ref':
      return expr.name.toUpperCase()
    case 'chord_list':
      return expr.chords.map(c => chordName(c)).join(' ')
    case 'sequence':
      return expr.items.map(expressionToString).join(', ')
    case 'repeat':
      return expressionToString(expr.body) + '*' + expr.count
    default:
      return ''
  }
}

export function findChordIndex(allChords: ChordPlaybackItem[], structureIndex: number, lineIndex: number): number {
  return allChords.findIndex(
    item => item.structureIndex === structureIndex && item.lineIndex === lineIndex
  )
}

export function getChordRangeForSection(allChords: ChordPlaybackItem[], structureIndex: number): { start: number; end: number } | null {
  let start = -1
  let end = -1
  for (let i = 0; i < allChords.length; i++) {
    if (allChords[i].structureIndex === structureIndex) {
      if (start === -1) start = i
      end = i + 1
    }
  }
  if (start === -1) return null
  return { start, end }
}

export function findMeasureIndex(playback: PlaybackMeasure[], structureIndex: number, lineIndex: number): number {
  return playback.findIndex(
    m => m.structureIndex === structureIndex && m.lineIndex === lineIndex
  )
}

export function getMeasureRangeForSection(playback: PlaybackMeasure[], structureIndex: number): { start: number; end: number } | null {
  let start = -1
  let end = -1
  for (let i = 0; i < playback.length; i++) {
    if (playback[i].structureIndex === structureIndex) {
      if (start === -1) start = i
      end = i + 1
    }
  }
  if (start === -1) return null
  return { start, end }
}

export function collectAllChords(song: Song): ChordPlaybackItem[] {
  const result: ChordPlaybackItem[] = []
  song.structure.forEach((entry, si) => {
    if (entry.lines.length > 0) {
      entry.lines.forEach((line, li) => {
        const markers: ({ col: number; type: 'chord'; chord: Chord } | { col: number; type: 'bar'; barChord?: Chord })[] = []
        for (const chord of line.chords) {
          markers.push({ col: chord.column, type: 'chord', chord })
        }
        for (const bar of line.barLines) {
          const entry: { col: number; type: 'bar'; barChord?: Chord } = { col: bar.column, type: 'bar' }
          if (bar.chord) entry.barChord = bar.chord
          markers.push(entry)
        }
        markers.sort((a, b) => a.col - b.col)
        let currentChord: Chord | null = null
        markers.forEach((m, mi) => {
          if (m.type === 'chord') {
            currentChord = m.chord
            // Expand split measures into multiple playback items
            if (currentChord.splitMeasure && currentChord.splitMeasure.length > 0) {
              currentChord.splitMeasure.forEach(sc => {
                result.push({ chord: sc, structureIndex: si, lineIndex: li, markerIndex: mi })
              })
            } else {
              result.push({ chord: currentChord, structureIndex: si, lineIndex: li, markerIndex: mi })
            }
          } else {
            // Bar line: use parser-provided chord (carries across lines), or currentChord
            const playChord = m.barChord || currentChord
            if (playChord) {
              result.push({ chord: playChord, structureIndex: si, lineIndex: li, markerIndex: mi })
            }
          }
        })
      })
    } else {
      entry.chords.forEach((chord, ci) => {
        if (chord.splitMeasure && chord.splitMeasure.length > 0) {
          chord.splitMeasure.forEach(sc => {
            result.push({ chord: sc, structureIndex: si, lineIndex: -1, markerIndex: ci })
          })
        } else {
          result.push({ chord, structureIndex: si, lineIndex: -1, markerIndex: ci })
        }
      })
    }
  })
  return result
}
