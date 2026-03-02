import { useMemo, useRef, useEffect } from 'react';
import { parse } from 'songsheet';
import { useAudioPlayback } from '../useAudioPlayback.ts';
import { useAutoScroll } from '../useAutoScroll.ts';
import { renderSongContent } from './SongRendering.tsx';

interface SongPerformanceProps {
  rawText: string;
  songId: string;
}

export function SongPerformance({ rawText, songId }: SongPerformanceProps) {
  const parsedSong = useMemo(() => {
    try {
      return parse(rawText);
    } catch {
      return null;
    }
  }, [rawText]);

  const controlsRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  const audio = useAudioPlayback({ initialBpm: parsedSong?.bpm ?? 72 });
  const { scrollTo } = useAutoScroll({ isScrolling: audio.isPlaying });

  useEffect(() => {
    if (audio.playbackState !== 'stopped') audio.stopPlayback();
    if (parsedSong?.bpm) audio.setBpm(parsedSong.bpm);
    audio.setTimeSignature(
      parsedSong?.timeSignature ? parsedSong.timeSignature.beats : 4,
      parsedSong?.timeSignature ? parsedSong.timeSignature.value : 4,
    );
  }, [songId]);

  useEffect(() => {
    if (parsedSong?.bpm) audio.setBpm(parsedSong.bpm);
    audio.setTimeSignature(
      parsedSong?.timeSignature ? parsedSong.timeSignature.beats : 4,
      parsedSong?.timeSignature ? parsedSong.timeSignature.value : 4,
    );
  }, [parsedSong?.bpm, parsedSong?.timeSignature?.beats, parsedSong?.timeSignature?.value]);

  useEffect(() => {
    if (!parsedSong) return;
    audio.reschedule(parsedSong);
  }, [parsedSong]);

  useEffect(() => {
    if (!audio.activeHighlight) return;
    const { structureIndex, lineIndex } = audio.activeHighlight;
    const displayRoot = displayRef.current;
    if (!displayRoot) return;

    const sectionEl = displayRoot.querySelector(`.section[data-structure-index="${structureIndex}"]`) as HTMLElement | null;
    if (!sectionEl) return;

    const lineEl = lineIndex >= 0
      ? sectionEl.querySelector(`.line-pair[data-line-index="${lineIndex}"]`) as HTMLElement | null
      : null;
    const scrollEl = lineEl || sectionEl;

    const controlsHeight = controlsRef.current ? controlsRef.current.offsetHeight : 0;
    let target = scrollEl.getBoundingClientRect().top + window.scrollY - controlsHeight - window.innerHeight * 0.28;
    target = Math.max(0, target);

    if (audio.isPlaying) {
      scrollTo(target);
      return;
    }
    window.scrollTo(0, target);
  }, [audio.activeHighlight, audio.isPlaying, scrollTo]);

  function handleSongClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.detail > 1) return;
    if (!parsedSong) return;
    const target = e.target as HTMLElement;
    const linePair = target.closest('.line-pair') as HTMLElement | null;
    const section = target.closest('.section') as HTMLElement | null;
    if (!section) return;
    const structureIndex = parseInt(section.dataset.structureIndex ?? '', 10);
    if (isNaN(structureIndex)) return;
    const lineIndex = linePair ? parseInt(linePair.dataset.lineIndex ?? '0', 10) : -1;
    audio.seekTo(parsedSong, structureIndex, lineIndex);
  }

  function handleSectionDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!parsedSong) return;
    const target = e.target as HTMLElement;
    const header = target.closest('.section-header') as HTMLElement | null;
    if (!header) return;
    const section = header.closest('.section') as HTMLElement | null;
    if (!section) return;
    const structureIndex = parseInt(section.dataset.structureIndex ?? '', 10);
    if (isNaN(structureIndex)) return;
    audio.toggleVamp(parsedSong, structureIndex);
  }

  return (
    <div className="performance-page">
      <div id="controls" ref={controlsRef}>
        <div className="control-group">
          {audio.isPlaying ? (
            <button id="btn-pause" onClick={audio.pausePlayback}>Pause</button>
          ) : (
            <button id="btn-play" onClick={() => audio.startPlayback(parsedSong)}>
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
          <a id="btn-back-to-chart" href={`/songs/${songId}`} className="btn-link">Back to Chart</a>
        </div>
      </div>

      <div
        id="song-display"
        ref={displayRef}
        className="performance-song-display"
        onClick={handleSongClick}
        onDoubleClick={handleSectionDoubleClick}
      >
        {parsedSong
          ? renderSongContent(parsedSong, audio.activeHighlight, audio.vampSection)
          : <p className="no-song">Song could not be parsed for performance mode.</p>}
      </div>
    </div>
  );
}
