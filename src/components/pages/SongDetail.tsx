import { Layout } from '../Layout.tsx';
import { SongView } from '../SongView.tsx';

export function SongDetail({ rawText, songId }: { rawText: string; songId: string }) {
  return (
    <Layout>
      <SongView
        rawText={rawText}
        songId={songId}
        extraControls={
          <div className="control-group">
            <a href={`/songs/${songId}/edit`} className="btn-link">Edit</a>
          </div>
        }
      />
    </Layout>
  );
}
