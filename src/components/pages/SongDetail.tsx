import { useState, useRef, useEffect, useMemo } from 'react';
import { parse, transpose, toNashville, toStandard } from 'songsheet';
import { useAudioPlayback } from '../../useAudioPlayback.ts';
import { useAutoScroll } from '../../useAutoScroll.ts';
import { renderSongContent } from '../SongRendering.tsx';
import { Layout } from '../Layout.tsx';
import type { Song } from '../../types.ts';

export function SongDetail({ rawText, songId }: { rawText: string; songId: string }) {
  const parsedSong = useMemo(() => parse(rawText), [rawText]);

  const [originalSong, setOriginalSong] = useState<Song>(parsedSong);
  const [currentSong, setCurrentSong] = useState<Song>(parsedSong);
  const [semitoneOffset, setSemitoneOffset] = useState(0);
  const [nashvilleMode, setNashvilleMode] = useState(false);

  const controlsRef = useRef<HTMLDivElement>(null);

  const audio = useAudioPlayback({ initialBpm: parsedSong.bpm ?? 72 });
  const { scrollTo } = useAutoScroll({ isScrolling: audio.isPlaying });

  // When rawText/songId changes, reset state
  useEffect(() => {
    const newSong = parse(rawText);
    setOriginalSong(newSong);
    setCurrentSong(newSong);
    setSemitoneOffset(0);
    setNashvilleMode(false);
    if (audio.playbackState !== 'stopped') audio.stopPlayback();
    if (newSong.bpm) audio.setBpm(newSong.bpm);
    audio.setTimeSignature(
      newSong.timeSignature ? newSong.timeSignature.beats : 4,
      newSong.timeSignature ? newSong.timeSignature.value : 4,
    );
  }, [rawText, songId]);

  // Derive displaySong: applies Nashville conversion for rendering
  const displaySong = useMemo(() => {
    const key = currentSong.key;
    if (!key) return currentSong;
    if (nashvilleMode) return toNashville(currentSong, key);
    return toStandard(currentSong, key);
  }, [currentSong, nashvilleMode]);

  // Update scroll target when highlight changes
  useEffect(() => {
    if (!audio.activeHighlight) return;
    const { structureIndex, lineIndex } = audio.activeHighlight;
    const sectionEl = document.querySelector(`.section[data-structure-index="${structureIndex}"]`);
    if (!sectionEl) return;
    const scrollEl = (lineIndex >= 0)
      ? sectionEl.querySelector(`.line-pair[data-line-index="${lineIndex}"]`) || sectionEl
      : sectionEl;
    const controlsHeight = controlsRef.current ? controlsRef.current.offsetHeight : 0;
    let target = (scrollEl as HTMLElement).offsetTop - controlsHeight - window.innerHeight * 0.3;
    target = Math.max(0, target);
    if (audio.isPlaying) {
      scrollTo(target);
    } else {
      window.scrollTo(0, target);
    }
  }, [audio.activeHighlight, audio.isPlaying, scrollTo]);

  function applyTranspose(delta: number) {
    const newOffset = semitoneOffset + delta;
    setSemitoneOffset(newOffset);
    const newSong = newOffset === 0 ? originalSong : transpose(originalSong, newOffset);
    setCurrentSong(newSong);
    audio.reschedule(newSong);
  }

  function transposeLabel(offset: number): string {
    if (offset === 0) return '0';
    return (offset >= 0 ? '+' : '') + offset;
  }

  function handleSongClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.detail > 1) return;
    const target = e.target as HTMLElement;
    const linePair = target.closest('.line-pair') as HTMLElement | null;
    const section = target.closest('.section') as HTMLElement | null;
    if (!section) return;
    const si = parseInt(section.dataset.structureIndex ?? '', 10);
    if (isNaN(si)) return;
    let li = 0;
    if (linePair) {
      li = parseInt(linePair.dataset.lineIndex ?? '0', 10);
    } else {
      li = -1;
    }
    audio.seekTo(currentSong, si, li);
  }

  function handleSectionDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const header = target.closest('.section-header') as HTMLElement | null;
    if (!header) return;
    const section = header.closest('.section') as HTMLElement | null;
    if (!section) return;
    const si = parseInt(section.dataset.structureIndex ?? '', 10);
    if (isNaN(si)) return;
    audio.toggleVamp(currentSong, si);
  }

  return (
    <Layout>
      <div id="controls" ref={controlsRef}>
        <div className="control-group">
          {audio.isPlaying ? (
            <button id="btn-pause" onClick={audio.pausePlayback}>Pause</button>
          ) : (
            <button
              id="btn-play"
              onClick={() => audio.startPlayback(currentSong)}
            >
              {audio.isPaused ? 'Resume' : 'Play'}
            </button>
          )}
          <button
            id="btn-stop"
            disabled={audio.playbackState === 'stopped'}
            onClick={audio.stopPlayback}
          >
            Stop
          </button>
          <button
            id="btn-metronome"
            className={audio.metronomeEnabled ? 'on' : ''}
            title="Toggle metronome"
            onClick={audio.toggleMetronome}
          >
            Met.
          </button>
        </div>

        <div className="control-group">
          <label>BPM</label>
          <input
            type="range"
            id="bpm-slider"
            min="40"
            max="160"
            value={audio.bpm}
            onChange={e => audio.setBpm(parseInt(e.target.value, 10))}
          />
          <span id="bpm-value">{audio.bpm}</span>
        </div>

        <div className="control-group">
          <label>Transpose</label>
          <button id="btn-transpose-down" onClick={() => applyTranspose(-1)}>-</button>
          <span id="transpose-value">{transposeLabel(semitoneOffset)}</span>
          <button id="btn-transpose-up" onClick={() => applyTranspose(1)}>+</button>
        </div>

        <div className="control-group">
          <button
            id="btn-nashville"
            className={nashvilleMode ? 'on' : ''}
            disabled={!currentSong?.key}
            title="Toggle Nashville Number System"
            onClick={() => setNashvilleMode(v => !v)}
          >
            NNS
          </button>
        </div>
      </div>

      <div id="song-display" onClick={handleSongClick} onDoubleClick={handleSectionDoubleClick}>
        {renderSongContent(displaySong, audio.activeHighlight, audio.vampSection)}
      </div>
    </Layout>
  );
}
