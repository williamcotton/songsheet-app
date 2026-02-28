import type { Chord } from 'songsheet'

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
