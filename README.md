# songsheet-app

A React 19 + TypeScript songsheet app with Express/Vite SSR and Tone.js playback. Songs are parsed from plaintext with the `songsheet` library and rendered with synchronized chord highlighting.

## Features

- **Audio playback** — Tone.js PolySynth scheduling from parser-generated `song.playback`
- **Per-chord highlighting** — UI tracks `{ structureIndex, lineIndex, markerIndex }` during playback
- **Pause / Resume** — Pause playback and resume from the same position
- **Click-to-seek** — Click any line to jump playback to that position; works while playing, paused, or stopped
- **Section vamp** — Double-click a section header to loop that section; double-click again to clear the loop
- **Transpose** — Shift song key up or down by semitones in real-time
- **Nashville Number System** — Toggle between standard chord names (C, G, Am) and Nashville numbers (1, 5, 6m) relative to the song key
- **Metronome** — Optional click track synced to playback
- **BPM control** — Adjustable tempo (40–160 BPM)
- **Chord decorators** — Visual rendering of diamond `<G>`, push `^G`, stop `G!`, and split measure `[G C]`
- **Strict split-measure syntax** — only bracket syntax (`[A B ...]`) creates multi-chord measures; `|` repeats measures

## Getting Started

```bash
npm install
npm run dev
```

The app server starts at `http://localhost:3000` by default.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express server with Vite middleware |
| `npm run build` | Build client and SSR server bundles |
| `npm run start` | Run production server |
| `npm run preview` | Alias for production server |
| `npm run typecheck` | Type-check without emitting |

## Project Structure

```
server.ts                    # Express server (SSR + GraphQL endpoint)
src/
├── audioEngine.ts           # Tone.js scheduling and playback callbacks
├── useAudioPlayback.ts      # React playback hook and engine lifecycle
├── useAutoScroll.ts         # Playback scroll behavior
├── chordUtils.ts            # Chord utilities and measure lookup helpers
├── types.ts                 # App-local Song/playback types
├── components/
│   ├── SongRendering.tsx    # Chord/lyric rendering + active marker highlighting
│   └── pages/
│       ├── SongList.tsx     # /songs
│       └── SongDetail.tsx   # /songs/:id
├── shared/
│   ├── universal-app.tsx    # Route registration
│   └── graphql/             # Queries/schema shared by server and client
└── server/graphql/          # GraphQL data store and executors
public/
└── songs/                   # Plaintext song files
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [react](https://react.dev) 19 | UI rendering |
| [songsheet](https://www.npmjs.com/package/songsheet) | Songsheet parsing/transposition/notation conversion |
| [tone](https://tonejs.github.io) 14 | Synth + transport scheduling |
| [express](https://expressjs.com) 5 | App server |
| [graphql](https://graphql.org/) | Song query layer |
| [vite](https://vite.dev) 6 | Dev middleware + client/SSR builds |
