import type { UniversalApp } from './types/index.ts';
import { SONGS_QUERY, SONG_QUERY } from './graphql/index.ts';
import type { SongSummary, SongData } from './graphql/index.ts';
import { Layout } from '../components/Layout.tsx';

export function registerRoutes(app: UniversalApp) {
  app.get('/', async (_req, res) => {
    res.redirect('/songs');
  });

  app.get('/songs', async (req, res) => {
    const result = await req.graphql<{ songs: SongSummary[] }>(SONGS_QUERY);
    const { SongList } = await import('../components/pages/SongList.tsx');
    res.renderApp(<SongList songs={result.data?.songs ?? []} />);
  });

  app.get('/songs/:id', async (req, res) => {
    const result = await req.graphql<{ song: SongData | null }>(SONG_QUERY, { id: req.params.id });
    if (!result.data?.song) {
      res.setStatus(404);
      res.renderApp(<Layout><p className="no-song">Song not found.</p></Layout>);
      return;
    }
    const { SongDetail } = await import('../components/pages/SongDetail.tsx');
    res.renderApp(<SongDetail rawText={result.data.song.rawText} songId={req.params.id} />);
  });
}
