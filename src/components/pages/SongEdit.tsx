import { useState, useRef, useEffect } from 'react';
import { Layout } from '../Layout.tsx';
import { SongView } from '../SongView.tsx';

export function SongEdit({ rawText, songId }: { rawText: string; songId: string }) {
  const [editText, setEditText] = useState(rawText);
  const previewRef = useRef<HTMLDivElement>(null);

  // When rawText prop changes (e.g. after save reload), sync editor
  useEffect(() => {
    setEditText(rawText);
  }, [rawText, songId]);

  return (
    <Layout>
      <div className="edit-container">
        <div className="edit-left">
          <form method="POST">
            <div className="edit-header">
              <span className="edit-header-label">Source</span>
              <button type="submit">Save</button>
            </div>
            <textarea
              className="edit-textarea"
              name="rawText"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              spellCheck={false}
            />
          </form>
        </div>

        <div className="edit-right" ref={previewRef}>
          <SongView
            rawText={editText}
            songId={songId}
            scrollContainerRef={previewRef}
          />
        </div>
      </div>
    </Layout>
  );
}
