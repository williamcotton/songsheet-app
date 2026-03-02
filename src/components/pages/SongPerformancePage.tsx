import { SongPerformance } from '../SongPerformance.tsx';

export function SongPerformancePage({ rawText, songId }: { rawText: string; songId: string }) {
  return (
    <SongPerformance rawText={rawText} songId={songId} />
  );
}
