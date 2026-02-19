const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_TO_SEMITONE = {}
const FLAT_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }

NOTE_NAMES.forEach((n, i) => NOTE_TO_SEMITONE[n] = i)
Object.entries(FLAT_MAP).forEach(([flat, sharp]) => NOTE_TO_SEMITONE[flat] = NOTE_TO_SEMITONE[sharp])

const CHORD_INTERVALS = {
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

export function chordToNotes(chord) {
  if (!chord || !chord.root) return null
  const rootSemitone = NOTE_TO_SEMITONE[chord.root]
  if (rootSemitone === undefined) return null
  const intervals = CHORD_INTERVALS[chord.type] || CHORD_INTERVALS['']
  return intervals.map(interval => {
    const semitone = (rootSemitone + interval) % 12
    const octave = semitone < rootSemitone ? 4 : 3
    return NOTE_NAMES[semitone] + octave
  })
}

export function chordName(chord) {
  if (!chord || !chord.root) return ''
  return chord.root + chord.type
}

export function expressionToString(expr) {
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

export function collectAllChords(song) {
  const result = []
  song.structure.forEach((entry, si) => {
    if (entry.lines.length > 0) {
      entry.lines.forEach((line, li) => {
        const markers = []
        for (const chord of line.chords) {
          markers.push({ col: chord.column, type: 'chord', chord })
        }
        for (const col of line.barLines) {
          markers.push({ col, type: 'bar' })
        }
        markers.sort((a, b) => a.col - b.col)
        let currentChord = null
        markers.forEach((m, mi) => {
          if (m.type === 'chord') {
            currentChord = m.chord
            result.push({ chord: currentChord, structureIndex: si, lineIndex: li, markerIndex: mi })
          } else if (currentChord) {
            result.push({ chord: currentChord, structureIndex: si, lineIndex: li, markerIndex: mi })
          }
        })
      })
    } else {
      entry.chords.forEach((chord, ci) => {
        result.push({ chord, structureIndex: si, lineIndex: -1, markerIndex: ci })
      })
    }
  })
  return result
}
