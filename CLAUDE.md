# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Commands

```bash
npm run dev          # vite dev server (http://localhost:5173)
npm run build        # production build to dist/
npm run preview      # preview production build
npx tsc --noEmit     # type-check only (no output files)
```

No linter or test runner is configured.

## Architecture

Single-page React 19 app that displays interactive songsheets with audio playback. No router — everything lives in one view.

### Source Files

- `src/App.tsx` — The entire UI: song selector, playback/transpose/BPM controls, and song rendering. All state lives here (no external state management). Playback is driven by Tone.js Transport scheduling.
- `src/chordUtils.ts` — Pure utility functions: `chordToNotes()` (chord → MIDI note array for synth), `chordName()`, `expressionToString()`, and `collectAllChords()` which flattens the song's structure into an ordered `ChordPlaybackItem[]` for scheduling.
- `src/types.ts` — TypeScript interfaces for the Song AST (`Song`, `StructureEntry`, `Line`, `Chord`, `Expression`, etc.) and app-specific types (`ActiveHighlight`, `ChordPlaybackItem`).
- `src/main.tsx` — Entry point, renders `<App />` into `#root`.
- `src/App.css` — All styles. Dark theme with accent color `#e94560`. Chord rows use monospace font with `white-space: pre` to preserve column alignment.

### Data Flow

1. User selects a song → `fetch('/songs/<name>.txt')` → `parse(text)` from the `songsheet` npm package → `Song` AST stored in state
2. Transpose buttons call `transpose(song, offset)` from the library and replace the current song
3. Play button: `Tone.start()` → `initSynth()` → `scheduleSong()` schedules one Transport event per chord (using `collectAllChords`), plus 4 metronome clicks per measure
4. Each scheduled chord triggers `synthRef.current.triggerAttackRelease()` and updates `activeHighlight` state via `Tone.Draw` for synchronized UI highlighting
5. Auto-scroll smoothly follows the active highlight using `requestAnimationFrame`

### Key Patterns

- **Refs for Tone.js callbacks**: `metronomeEnabledRef` and `isPlayingRef` mirror their state counterparts to avoid stale closures in Transport callbacks
- **Safari audio workaround**: `visibilitychange` listener resumes `AudioContext` and re-initializes synths when tab becomes visible
- **Sticky controls**: `#controls` is `position: sticky; top: 0` — `controlsRef` measures its height for scroll offset calculations

## Dependencies

- **songsheet** (npm package) — Provides `parse()` and `transpose()`. Types come from the package's `index.d.ts`. The sibling `../songsheet/` directory is the source for this package but the app imports from the installed npm package, not a relative path.
- **Tone.js v14** — Audio synthesis and transport scheduling. The `PolySynth` constructor requires a type cast (`as unknown as Partial<Tone.SynthOptions>`) because the v14 types don't expose `maxPolyphony`.
- **React 19** with `@types/react@^19` and `@types/react-dom@^19`.

## TypeScript

- Strict mode, `moduleResolution: "bundler"`, `allowImportingTsExtensions`, `noEmit`
- Source files use `.tsx`/`.ts` extensions in import paths (e.g., `from './App.tsx'`)
- The `songsheet` package types resolve automatically because `index.d.ts` sits next to `index.js` in the package

## Static Assets

Song `.txt` files live in `public/songs/` and are fetched at runtime. The song list is hardcoded in `App.tsx` (`SONGS` array).

## Vite Config

`server.fs.allow: ['..']` permits access to the parent directory (historical — from when the app used relative imports to the sibling songsheet directory).
