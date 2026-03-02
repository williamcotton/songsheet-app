# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Commands

```bash
npm run dev          # dev server (Express + Vite middleware)
npm run build        # client + server production build
npm run start        # run production server
npm run preview      # alias for production server
npm run typecheck    # type-check only (no output files)
```

No dedicated app test runner is configured.

## Architecture

This app is a server-rendered React app (not a single-file SPA). `server.ts` hosts Express, GraphQL, and Vite/SSR rendering.

### Routing and Rendering

- `src/shared/universal-app.tsx` registers routes for SSR page rendering.
- `/songs` -> `src/components/pages/SongList.tsx`
- `/songs/:id` -> `src/components/pages/SongDetail.tsx`
- `/songs/:id/edit` (GET + POST) -> `src/components/pages/SongEdit.tsx`
- GraphQL data is loaded server-side and cached in the initial HTML payload.
- POST `/songs/:id/edit` calls the `updateSong` GraphQL mutation, writes the file to disk, and redirects back to the edit page.

### Audio + Playback Stack

- `src/components/SongView.tsx` — shared component extracted from SongDetail; owns parse/transpose/NNS state, playback controls, click-to-seek, section vamp, and auto-scroll. Accepts `scrollContainerRef` for scrolling within a panel and `extraControls` slot for page-specific buttons.
- `src/components/pages/SongDetail.tsx` — thin wrapper: Layout + SongView + "Edit" link.
- `src/components/pages/SongEdit.tsx` — side-by-side textarea editor (left) with live SongView preview (right). Form POST saves via `updateSong` GraphQL mutation. Uses `lastGoodSongRef` in SongView to keep preview stable on parse errors during editing.
- `src/useAudioPlayback.ts` wraps engine lifecycle/state (`stopped`/`playing`/`paused`), owns `activeHighlight` and vamp state, and bridges callbacks into React state. Accepts `initialBpm`. Includes Safari audio-interruption recovery: visibility change, focus, pageshow, user-gesture, and 3-second polling while playing.
- `src/audioEngine.ts` schedules playback from parser-produced `song.playback`, uses full time signature (`beats` + `value`) for timing, emits per-chord `onPositionChange` with `markerIndex`, and applies a release gap before chord end. Includes `ensureContextRunning()` to handle Safari closed/suspended/interrupted `AudioContext` states, with automatic context reset and synth re-initialization.
- `src/components/SongRendering.tsx` renders chord/bar markers and applies active styles from `{ structureIndex, lineIndex, markerIndex }`.
- Measure semantics come from `songsheet`: only bracket syntax (`[A B ...]`) creates multi-chord measures; `|` repeats measures.

### Supporting Files

- `src/chordUtils.ts` — chord-to-note conversion, display formatting, measure lookup helpers (`findMeasureIndex`, `getMeasureRangeForSection`)
- `src/types.ts` — re-exports types from `songsheet` package; adds app-local `ActiveHighlight` and `PlaybackState`
- `src/useAutoScroll.ts` — scroll animation hook used during playback; supports optional `containerRef` for scrolling within a panel (used by SongEdit)
- `src/client/entry-client.tsx` — client-side hydration; accepts Vite HMR updates and cleans up on dispose
- `public/songs/*.txt` — song source files loaded by the server GraphQL data store

## Data Flow

1. Route `/songs/:id` resolves song text via GraphQL and SSR-renders `SongDetail`.
2. `SongDetail` parses text into a `Song` object with `structure` and `playback`.
3. Play triggers `AudioEngine.start(song, bpm)` and schedules Transport events from `song.playback`.
4. Scheduled chord callbacks update highlight position by structure/line/marker index.
5. Render layer highlights the active chord marker; click-to-seek maps line to measure index.

## HMR

`server.ts` creates an `http.Server` and passes it to Vite's `hmr.server` option so the HMR WebSocket shares the Express port. `entry-client.tsx` accepts hot updates and calls `app.destroy()` on dispose.

## Dependencies

- `songsheet` is consumed as the `songsheet` package (this workspace often has it symlinked to `../songsheet` during local development)
- Tone.js v14 powers synthesis/scheduling
- React 19 + Vite 6 + TypeScript 5

## TypeScript Notes

- Strict mode enabled (`noEmit`, bundler module resolution)
- Imports keep explicit `.ts`/`.tsx` extensions for local files
- `AudioEngine` PolySynth options require a cast due Tone.js type limitations
