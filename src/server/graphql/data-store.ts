import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'songsheet';
import type { DataStore, SongSummary, SongData } from '../../shared/graphql/types.ts';

export function createDataStore(songsDir: string): DataStore {
  return {
    async getSongs(): Promise<SongSummary[]> {
      const files = fs.readdirSync(songsDir).filter(f => f.endsWith('.txt')).sort();
      return files.map(file => {
        const rawText = fs.readFileSync(path.join(songsDir, file), 'utf-8');
        const song = parse(rawText);
        const id = file.replace(/\.txt$/, '');
        return {
          id,
          title: song.title || id,
          author: song.author || '',
        };
      });
    },

    async getSong(id: string): Promise<SongData | null> {
      const filePath = path.join(songsDir, id + '.txt');
      if (!fs.existsSync(filePath)) return null;
      const rawText = fs.readFileSync(filePath, 'utf-8');
      const song = parse(rawText);
      return {
        id,
        title: song.title || id,
        author: song.author || '',
        rawText,
      };
    },
  };
}
