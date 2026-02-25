import type { Song, Line, Chord, ActiveHighlight } from '../types.ts';
import { chordName, chordDisplayText, expressionToString } from '../chordUtils.ts';

export function renderChordMarker(chord: Chord, si: number, li: number, mi: number, highlight: ActiveHighlight | null): React.ReactNode {
  const isActive = highlight &&
    highlight.structureIndex === si &&
    highlight.lineIndex === li &&
    highlight.markerIndex === mi;
  const name = chordName(chord);
  const nashvilleClass = chord.nashville ? ' chord-nashville' : '';

  if (chord.diamond) {
    return (
      <span
        key={`${si}-${li}-${mi}`}
        className={'chord-marker chord-diamond' + (isActive ? ' active-marker' : '') + nashvilleClass}
        data-si={si} data-li={li} data-mi={mi}
      >
        <span className="chord-decorator">{'<'}</span>{name}<span className="chord-decorator">{'>'}</span>
      </span>
    );
  }
  if (chord.push) {
    return (
      <span
        key={`${si}-${li}-${mi}`}
        className={'chord-marker chord-push' + (isActive ? ' active-marker' : '') + nashvilleClass}
        data-si={si} data-li={li} data-mi={mi}
      >
        <span className="chord-decorator">{'^'}</span>{name}{chord.stop && <span className="chord-decorator">{'!'}</span>}
      </span>
    );
  }
  if (chord.stop && !chord.push) {
    return (
      <span
        key={`${si}-${li}-${mi}`}
        className={'chord-marker chord-stop' + (isActive ? ' active-marker' : '') + nashvilleClass}
        data-si={si} data-li={li} data-mi={mi}
      >
        {name}<span className="chord-decorator">{'!'}</span>
      </span>
    );
  }
  if (chord.splitMeasure) {
    const inner = chord.splitMeasure.map(c => c.root + c.type + (c.bass ? '/' + c.bass : '')).join(' ');
    return (
      <span
        key={`${si}-${li}-${mi}`}
        className={'chord-marker chord-split' + (isActive ? ' active-marker' : '') + nashvilleClass}
        data-si={si} data-li={li} data-mi={mi}
      >
        <span className="chord-decorator">{'['}</span>{inner}<span className="chord-decorator">{']'}</span>
      </span>
    );
  }

  return (
    <span
      key={`${si}-${li}-${mi}`}
      className={'chord-marker' + (isActive ? ' active-marker' : '') + nashvilleClass}
      data-si={si} data-li={li} data-mi={mi}
    >
      {name}
    </span>
  );
}

export function renderChordRow(line: Line, si: number, li: number, highlight: ActiveHighlight | null): React.ReactNode[] {
  const markers: { col: number; chord?: Chord; isBar?: boolean }[] = [];
  for (const chord of line.chords) {
    markers.push({ col: chord.column, chord });
  }
  for (const bar of line.barLines) {
    markers.push({ col: bar.column, isBar: true });
  }
  markers.sort((a, b) => a.col - b.col);

  const elements: React.ReactNode[] = [];
  let pos = 0;
  markers.forEach((m, mi) => {
    if (m.col > pos) {
      elements.push(' '.repeat(m.col - pos));
    }
    if (m.isBar) {
      const isBarActive = highlight &&
        highlight.structureIndex === si &&
        highlight.lineIndex === li &&
        highlight.markerIndex === mi;
      elements.push(
        <span key={`${si}-${li}-bar-${mi}`} className={'chord-marker' + (isBarActive ? ' active-marker' : '')}>|</span>
      );
      pos = m.col + 1;
    } else if (m.chord) {
      elements.push(renderChordMarker(m.chord, si, li, mi, highlight));
      pos = m.col + chordDisplayText(m.chord).length;
    }
  });
  return elements;
}

export function renderSongContent(
  song: Song | null,
  highlight: ActiveHighlight | null,
  vampSection: number | null
): React.ReactNode {
  if (!song) {
    return <p className="no-song">Select a song to get started.</p>;
  }

  const elements: React.ReactNode[] = [];

  elements.push(<div key="title" id="song-title">{song.title}</div>);
  elements.push(<div key="author" id="song-author">{song.author}</div>);

  song.structure.forEach((entry, si) => {
    const isSectionActive = highlight && highlight.structureIndex === si;
    const isVamped = vampSection === si;
    const label = entry.sectionType.charAt(0).toUpperCase() + entry.sectionType.slice(1);
    const indexLabel = entry.sectionIndex > 0 ? ' ' + (entry.sectionIndex + 1) : '';

    const sectionChildren: React.ReactNode[] = [];
    sectionChildren.push(
      <div key="header" className="section-header">
        {label + indexLabel}
        {isVamped && <span className="vamp-badge">looping</span>}
      </div>
    );

    if (entry.lines.length > 0) {
      entry.lines.forEach((line, li) => {
        const isLineActive = highlight &&
          highlight.structureIndex === si &&
          highlight.lineIndex === li;

        const pairChildren: React.ReactNode[] = [];

        if (line.chords.length > 0 || line.barLines.length > 0) {
          pairChildren.push(
            <div key="chords" className="chord-row">
              {renderChordRow(line, si, li, highlight)}
            </div>
          );
        }

        if (line.lyrics) {
          pairChildren.push(
            <div key="lyrics" className="lyric-row">{line.lyrics}</div>
          );
        }

        sectionChildren.push(
          <div
            key={`line-${li}`}
            className={'line-pair' + (isLineActive ? ' active-line' : '')}
            data-line-index={li}
          >
            {pairChildren}
          </div>
        );
      });

      if (entry.expression) {
        sectionChildren.push(
          <div key="expr" className="expression-label">
            {'(' + expressionToString(entry.expression) + ')'}
          </div>
        );
      }
    } else if (entry.chords.length > 0) {
      const chordChildren: React.ReactNode[] = [];
      entry.chords.forEach((c, ci) => {
        if (ci > 0) chordChildren.push('  ');
        const isActive = highlight &&
          highlight.structureIndex === si &&
          highlight.lineIndex === -1 &&
          highlight.markerIndex === ci;
        chordChildren.push(
          <span
            key={`${si}-d-${ci}`}
            className={'chord-marker' + (isActive ? ' active-marker' : '') + (c.nashville ? ' chord-nashville' : '')}
            data-si={si}
            data-li={-1}
            data-mi={ci}
          >
            {chordName(c)}
          </span>
        );
      });
      if (entry.expression) {
        chordChildren.push(
          <span key="expr" className="expression-label">
            {'  (' + expressionToString(entry.expression) + ')'}
          </span>
        );
      }
      sectionChildren.push(
        <div key="directive-chords" className="directive-chords">
          {chordChildren}
        </div>
      );
    }

    elements.push(
      <div
        key={`section-${si}`}
        className={'section' + (isSectionActive ? ' active-section' : '') + (isVamped ? ' vamped-section' : '')}
        data-structure-index={si}
      >
        {sectionChildren}
      </div>
    );
  });

  return elements;
}
