import { describe, it, expect } from 'vitest'
import type { Song, Chord, Expression, PlaybackMeasure } from 'songsheet'
import type { ChordPlaybackItem } from '../src/types.ts'
import {
  chordToNotes,
  chordName,
  chordDisplayText,
  chordDisplayWidth,
  expressionToString,
  findChordIndex,
  getChordRangeForSection,
  findMeasureIndex,
  getMeasureRangeForSection,
  collectAllChords,
} from '../src/chordUtils.ts'

function chord(root: string, type = '', extra: Record<string, any> = {}): Chord {
  return { root, type, bass: '', column: 0, nashville: false, ...extra } as Chord
}

describe('chordToNotes', () => {
  it('returns notes for a major chord', () => {
    const notes = chordToNotes(chord('C'))
    expect(notes).toEqual(['C3', 'E3', 'G3'])
  })

  it('returns notes for a minor chord', () => {
    const notes = chordToNotes(chord('A', 'm'))
    expect(notes).toEqual(['A3', 'C4', 'E4'])
  })

  it('returns notes for a 7th chord', () => {
    const notes = chordToNotes(chord('G', '7'))
    expect(notes).toEqual(['G3', 'B3', 'D4', 'F4'])
  })

  it('adds bass note for slash chord', () => {
    const notes = chordToNotes(chord('C', '', { bass: 'E' }))
    expect(notes).toEqual(['E2', 'C3', 'E3', 'G3'])
  })

  it('returns null for Nashville chord', () => {
    expect(chordToNotes(chord('1', '', { nashville: true }))).toBeNull()
  })

  it('returns null for null input', () => {
    expect(chordToNotes(null as unknown as Chord)).toBeNull()
  })

  it('returns null for chord with no root', () => {
    expect(chordToNotes({ root: '', type: '', bass: '', column: 0 } as Chord)).toBeNull()
  })

  it('returns null for unknown root', () => {
    expect(chordToNotes(chord('X'))).toBeNull()
  })

  it('handles flat notes via flat map', () => {
    const notes = chordToNotes(chord('Bb'))
    expect(notes).toEqual(['A#3', 'D4', 'F4'])
  })
})

describe('chordName', () => {
  it('returns name for basic chord', () => {
    expect(chordName(chord('G'))).toBe('G')
  })

  it('includes type', () => {
    expect(chordName(chord('A', 'm7'))).toBe('Am7')
  })

  it('includes slash bass', () => {
    expect(chordName(chord('C', '', { bass: 'B' }))).toBe('C/B')
  })

  it('returns empty string for null chord', () => {
    expect(chordName(null as unknown as Chord)).toBe('')
  })
})

describe('chordDisplayText', () => {
  it('returns plain chord name', () => {
    expect(chordDisplayText(chord('G'))).toBe('G')
  })

  it('wraps diamond chords in angle brackets', () => {
    expect(chordDisplayText(chord('G', '', { diamond: true }))).toBe('<G>')
  })

  it('prefixes push chords with caret', () => {
    expect(chordDisplayText(chord('C', '', { push: true }))).toBe('^C')
  })

  it('suffixes stop chords with exclamation', () => {
    expect(chordDisplayText(chord('G', '', { stop: true }))).toBe('G!')
  })

  it('handles push + stop', () => {
    expect(chordDisplayText(chord('C', '', { push: true, stop: true }))).toBe('^C!')
  })

  it('formats splitMeasure chords', () => {
    const c = chord('A', '', {
      splitMeasure: [
        { root: 'A', type: '', bass: '', column: 0 } as Chord,
        { root: 'B', type: 'm', bass: '', column: 0 } as Chord,
      ],
    })
    expect(chordDisplayText(c)).toBe('[A Bm]')
  })
})

describe('chordDisplayWidth', () => {
  it('returns length of display text', () => {
    expect(chordDisplayWidth(chord('G'))).toBe(1)
    expect(chordDisplayWidth(chord('Am', '7'))).toBe(3)
    expect(chordDisplayWidth(chord('G', '', { diamond: true }))).toBe(3)
  })
})

describe('expressionToString', () => {
  it('returns empty string for null', () => {
    expect(expressionToString(null)).toBe('')
  })

  it('formats section_ref', () => {
    const expr: Expression = { type: 'section_ref', name: 'verse' }
    expect(expressionToString(expr)).toBe('VERSE')
  })

  it('formats chord_list', () => {
    const expr: Expression = {
      type: 'chord_list',
      chords: [chord('G'), chord('C')],
    }
    expect(expressionToString(expr)).toBe('G C')
  })

  it('formats sequence', () => {
    const expr: Expression = {
      type: 'sequence',
      items: [
        { type: 'section_ref', name: 'verse' },
        { type: 'section_ref', name: 'chorus' },
      ],
    }
    expect(expressionToString(expr)).toBe('VERSE, CHORUS')
  })

  it('formats repeat', () => {
    const expr: Expression = {
      type: 'repeat',
      body: { type: 'section_ref', name: 'verse' },
      count: 3,
    }
    expect(expressionToString(expr)).toBe('VERSE*3')
  })
})

describe('findChordIndex', () => {
  const items: ChordPlaybackItem[] = [
    { chord: chord('C'), structureIndex: 0, lineIndex: 0, markerIndex: 0 },
    { chord: chord('G'), structureIndex: 0, lineIndex: 1, markerIndex: 1 },
    { chord: chord('Am'), structureIndex: 1, lineIndex: 0, markerIndex: 0 },
  ]

  it('finds matching chord', () => {
    expect(findChordIndex(items, 0, 1)).toBe(1)
  })

  it('returns -1 when not found', () => {
    expect(findChordIndex(items, 5, 0)).toBe(-1)
  })
})

describe('getChordRangeForSection', () => {
  const items: ChordPlaybackItem[] = [
    { chord: chord('C'), structureIndex: 0, lineIndex: 0, markerIndex: 0 },
    { chord: chord('G'), structureIndex: 0, lineIndex: 1, markerIndex: 1 },
    { chord: chord('Am'), structureIndex: 1, lineIndex: 0, markerIndex: 0 },
    { chord: chord('F'), structureIndex: 1, lineIndex: 1, markerIndex: 1 },
  ]

  it('returns range for section', () => {
    expect(getChordRangeForSection(items, 0)).toEqual({ start: 0, end: 2 })
    expect(getChordRangeForSection(items, 1)).toEqual({ start: 2, end: 4 })
  })

  it('returns null for missing section', () => {
    expect(getChordRangeForSection(items, 5)).toBeNull()
  })
})

describe('findMeasureIndex', () => {
  const playback: PlaybackMeasure[] = [
    { measureIndex: 0, structureIndex: 0, lineIndex: 0, chords: [], timeSignature: { beats: 4, value: 4 } },
    { measureIndex: 1, structureIndex: 0, lineIndex: 1, chords: [], timeSignature: { beats: 4, value: 4 } },
    { measureIndex: 2, structureIndex: 1, lineIndex: 0, chords: [], timeSignature: { beats: 4, value: 4 } },
  ]

  it('finds matching measure', () => {
    expect(findMeasureIndex(playback, 1, 0)).toBe(2)
  })

  it('returns -1 when not found', () => {
    expect(findMeasureIndex(playback, 5, 0)).toBe(-1)
  })
})

describe('getMeasureRangeForSection', () => {
  const playback: PlaybackMeasure[] = [
    { measureIndex: 0, structureIndex: 0, lineIndex: 0, chords: [], timeSignature: { beats: 4, value: 4 } },
    { measureIndex: 1, structureIndex: 0, lineIndex: 1, chords: [], timeSignature: { beats: 4, value: 4 } },
    { measureIndex: 2, structureIndex: 1, lineIndex: 0, chords: [], timeSignature: { beats: 4, value: 4 } },
  ]

  it('returns range for section', () => {
    expect(getMeasureRangeForSection(playback, 0)).toEqual({ start: 0, end: 2 })
  })

  it('returns null for missing section', () => {
    expect(getMeasureRangeForSection(playback, 5)).toBeNull()
  })
})

describe('collectAllChords', () => {
  it('collects chords from lines with barlines', () => {
    const song = {
      structure: [
        {
          lines: [
            {
              chords: [chord('C', '', { column: 0 }), chord('G', '', { column: 10 })],
              barLines: [{ column: 20, chord: chord('G') }] as any[],
              lyrics: '',
            },
          ],
          chords: [],
          section: 'VERSE',
        },
      ],
    } as unknown as Song
    const result = collectAllChords(song)
    expect(result.length).toBe(3) // C, G, barline-G
    expect(result[0].chord.root).toBe('C')
    expect(result[1].chord.root).toBe('G')
    expect(result[2].chord.root).toBe('G')
  })

  it('expands splitMeasure chords in lines', () => {
    const song = {
      structure: [
        {
          lines: [
            {
              chords: [
                chord('A', '', {
                  column: 0,
                  splitMeasure: [
                    { root: 'A', type: '', bass: '', column: 0 } as Chord,
                    { root: 'B', type: '', bass: '', column: 0 } as Chord,
                  ],
                }),
              ],
              barLines: [] as any[],
              lyrics: '',
            },
          ],
          chords: [],
          section: 'VERSE',
        },
      ],
    } as unknown as Song
    const result = collectAllChords(song)
    expect(result.length).toBe(2)
    expect(result[0].chord.root).toBe('A')
    expect(result[1].chord.root).toBe('B')
  })

  it('collects chords from entries without lines', () => {
    const song = {
      structure: [
        {
          lines: [],
          chords: [chord('D'), chord('E', 'm')],
          section: 'INTRO',
        },
      ],
    } as unknown as Song
    const result = collectAllChords(song)
    expect(result.length).toBe(2)
    expect(result[0].chord.root).toBe('D')
    expect(result[0].lineIndex).toBe(-1)
    expect(result[1].chord.root).toBe('E')
  })
})
