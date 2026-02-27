// Chord types
export interface Chord {
  root: string
  type: string
  bass?: string
  nashville?: boolean
  diamond?: boolean
  push?: boolean
  stop?: boolean
  splitMeasure?: Chord[]
}

export interface PositionedChord extends Chord {
  column: number
}

export interface Character {
  character: string
  chord?: Chord
  barLine?: true
}

export interface BarLine {
  column: number
  chord?: Chord
}

export interface Line {
  chords: PositionedChord[]
  barLines: BarLine[]
  lyrics: string
  characters: Character[]
}

// Expression AST (discriminated union)
export type Expression =
  | { type: 'section_ref'; name: string }
  | { type: 'chord_list'; chords: Chord[] }
  | { type: 'sequence'; items: Expression[] }
  | { type: 'repeat'; body: Expression; count: number }

// Section and structure
export interface Section {
  count: number
  chords: Chord[]
  lyrics: string[]
  lines: Line[]
}

export interface StructureEntry {
  sectionType: string
  sectionIndex: number
  chords: Chord[]
  lyrics: string[]
  lines: Line[]
  expression: Expression | null
}

export interface TimeSignature {
  beats: number
  value: number
}

export interface PlaybackChord {
  root: string
  type: string
  bass?: string
  nashville?: boolean
  diamond?: boolean
  push?: boolean
  stop?: boolean
  markerIndex?: number
  beatStart: number
  durationInBeats: number
}

export interface PlaybackMeasure {
  measureIndex: number
  structureIndex: number
  lineIndex: number
  timeSignature: TimeSignature
  chords: PlaybackChord[]
}

export interface Song {
  title: string
  author: string
  bpm: number | null
  timeSignature: TimeSignature | null
  key: string | null
  sections: Record<string, Section>
  structure: StructureEntry[]
  playback: PlaybackMeasure[]
}

// App-specific
export interface ActiveHighlight {
  structureIndex: number
  lineIndex: number
  markerIndex: number
}

export interface ChordPlaybackItem {
  chord: Chord
  structureIndex: number
  lineIndex: number
  markerIndex: number
}

export type PlaybackState = 'stopped' | 'playing' | 'paused'
