# songsheet-app

A single-page React web app for displaying interactive songsheets with synchronized audio playback. Songs are parsed from plaintext using the [songsheet](https://www.npmjs.com/package/songsheet) library and rendered with real-time chord highlighting, transposition, and Nashville Number System support.

## Features

- **Audio playback** — Synthesized chords (Tone.js PolySynth) scheduled on a transport timeline with beat-synced UI highlighting and auto-scroll
- **Pause / Resume** — Pause playback and resume from the same position
- **Click-to-seek** — Click any line to jump playback to that position; works while playing, paused, or stopped
- **Section vamp** — Double-click a section header to loop that section; double-click again to clear the loop
- **Transpose** — Shift song key up or down by semitones in real-time
- **Nashville Number System** — Toggle between standard chord names (C, G, Am) and Nashville numbers (1, 5, 6m) relative to the song key
- **Metronome** — Optional click track synced to playback
- **BPM control** — Adjustable tempo (40–160 BPM)
- **Chord decorators** — Visual rendering of diamond `<G>`, push `^G`, stop `G!`, and split measure `[G C]` notations

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npx tsc --noEmit` | Type-check without emitting |

## Project Structure

```
src/
├── main.tsx              # React root
├── App.tsx               # UI: controls, song rendering, seek/vamp click handlers
├── App.css               # Dark theme styles
├── audioEngine.ts        # Tone.js AudioEngine class (play, pause, seek, vamp)
├── useAudioPlayback.ts   # React hook wrapping AudioEngine (state, callbacks)
├── useAutoScroll.ts      # Smooth-scroll hook using requestAnimationFrame
├── types.ts              # TypeScript interfaces for the Song AST
└── chordUtils.ts         # Chord-to-MIDI conversion, name formatting, playback sequencing
public/
└── songs/           # Plaintext song files fetched at runtime
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [react](https://react.dev) 19 | UI framework |
| [songsheet](https://www.npmjs.com/package/songsheet) | Chord parsing, transposition, Nashville conversion |
| [tone](https://tonejs.github.io) 14 | Audio synthesis and transport scheduling |
| [vite](https://vite.dev) 6 | Build tool and dev server |
| [typescript](https://www.typescriptlang.org) 5 | Type checking (strict mode, `noEmit`) |
