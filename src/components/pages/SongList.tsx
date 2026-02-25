import { Layout } from '../Layout.tsx';
import type { SongSummary } from '../../shared/graphql/types.ts';

export function SongList({ songs }: { songs: SongSummary[] }) {
  return (
    <Layout>
      <div id="song-list">
        <h1>Songs</h1>
        <ul>
          {songs.map(song => (
            <li key={song.id}>
              <a href={`/songs/${song.id}`}>
                {song.title}
                {song.author && <span className="song-author"> — {song.author}</span>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
