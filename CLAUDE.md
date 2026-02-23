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

- `src/App.tsx` — UI only: song selector, playback/transpose/BPM controls, and song rendering. Owns song state, Nashville toggle, and transpose logic. Delegates audio to `useAudioPlayback` and scrolling to `useAutoScroll`. Handles click-to-seek (click a line to jump playback) and section vamp (double-click a section header to loop it).
- `src/audioEngine.ts` — Pure Tone.js `AudioEngine` class with no React dependency. Manages PolySynth/NoiseSynth creation, Transport scheduling, and playback lifecycle. Communicates back via a callbacks object (`onPositionChange`, `onPlaybackEnd`, `onMetronomeEnabledRead`). Supports `pause()`/`resume()`, `seekTo(chordIndex)` for jumping to a position, and `setVamp()`/`clearVamp()` for Transport looping.
- `src/useAudioPlayback.ts` — React hook wrapping `AudioEngine`. Owns `playbackState` (`PlaybackState`: `'stopped' | 'playing' | 'paused'`), `metronomeEnabled`, `bpm`, `activeHighlight`, and `vampSection` state. Derives `isPlaying`/`isPaused` booleans for convenience. Exposes `pausePlayback`, `seekTo(song, si, li)`, `toggleVamp(song, si)`, and `clearVamp` callbacks. Handles ref-sync for stale closure prevention and Safari `visibilitychange` workaround.
- `src/useAutoScroll.ts` — Smooth-scroll hook using `requestAnimationFrame`. Starts/stops the scroll loop based on `isScrolling` prop. Exposes `scrollTo(target)` — the caller (App.tsx) computes DOM scroll targets.
- `src/chordUtils.ts` — Pure utility functions: `chordToNotes()` (chord → MIDI note array for synth), `chordName()`, `expressionToString()`, `collectAllChords()` which flattens the song's structure into an ordered `ChordPlaybackItem[]` for scheduling, `findChordIndex()` for click-to-seek position lookup, and `getChordRangeForSection()` for vamp loop range calculation.
- `src/types.ts` — TypeScript interfaces for the Song AST (`Song`, `StructureEntry`, `Line`, `Chord`, `Expression`, etc.) and app-specific types (`ActiveHighlight`, `ChordPlaybackItem`, `PlaybackState`).
- `src/main.tsx` — Entry point, renders `<App />` into `#root`.
- `src/App.css` — All styles. Dark theme with accent color `#e94560`. Chord rows use monospace font with `white-space: pre` to preserve column alignment.

### Data Flow

1. User selects a song → `fetch('/songs/<name>.txt')` → `parse(text)` from the `songsheet` npm package → `Song` AST stored in state
2. Transpose buttons call `transpose(song, offset)` from the library and replace the current song; `audio.reschedule()` re-schedules during playback
3. Play button: `audio.startPlayback(song)` → `AudioEngine.start()` → `Tone.start()`, `initSynth()`, `scheduleSong()`, `Transport.start()`; if paused, calls `engine.resume()` instead
4. Pause button: `audio.pausePlayback()` → `Transport.pause()` + `synth.releaseAll()`; Resume resumes from paused position
5. Click-to-seek: click a line → `audio.seekTo(song, si, li)` → finds chord index via `findChordIndex()` → `engine.seekTo()` sets `Transport.seconds`; if stopped, starts playback first
6. Section vamp: double-click a section header → `audio.toggleVamp(song, si)` → computes chord range via `getChordRangeForSection()` → `engine.setVamp()` sets `Transport.loop`/`loopStart`/`loopEnd`
7. Each scheduled chord triggers `PolySynth.triggerAttackRelease()` and fires `onPositionChange` callback via `Tone.Draw` → React state update
8. `useAutoScroll` runs a rAF loop while playing; App.tsx computes DOM scroll targets from `activeHighlight` and calls `scrollTo(target)` (instant jump when paused)

### Key Patterns

- **AudioEngine callbacks**: The engine is a plain class — it calls `onPositionChange`, `onPlaybackEnd`, and reads `onMetronomeEnabledRead()` instead of touching React state directly
- **Refs for Tone.js callbacks**: `metronomeEnabledRef`, `playbackStateRef`, and `vampSectionRef` in `useAudioPlayback` mirror state to avoid stale closures in Transport callbacks
- **Safari audio workaround**: `visibilitychange` listener in `useAudioPlayback` calls `engine.resumeContext()` to resume `AudioContext` and re-init synths
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
