export interface SongSummary {
  id: string;
  title: string;
  author: string;
}

export interface SongData {
  id: string;
  title: string;
  author: string;
  rawText: string;
}

export interface DataStore {
  getSongs(): Promise<SongSummary[]>;
  getSong(id: string): Promise<SongData | null>;
}
