import { useEffect, useRef, useState } from 'react';

interface ExportMenuProps {
  rawText: string;
  songId: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function ExportMenu({ rawText, songId }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleDocumentClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  async function copyShareLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      return;
    } catch {
      // Fallback for browsers without clipboard API support.
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.setAttribute('readonly', 'true');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyState(success ? 'copied' : 'failed');
    }
  }

  function exportPlainText() {
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${songId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(downloadUrl);
    setIsOpen(false);
  }

  function printChart() {
    window.print();
    setIsOpen(false);
  }

  function resetCopyState() {
    if (copyState === 'idle') return;
    setCopyState('idle');
  }

  return (
    <div className="control-group export-control" ref={menuRef}>
      <button
        id="btn-export"
        className={isOpen ? 'on' : ''}
        aria-expanded={isOpen}
        aria-controls="export-menu"
        onClick={() => {
          setIsOpen(v => !v);
          resetCopyState();
        }}
      >
        Export
      </button>

      {isOpen && (
        <div id="export-menu" className="export-menu" role="dialog" aria-label="Export options">
          <button id="btn-export-print" onClick={printChart}>PDF / Print</button>
          <button id="btn-export-text" onClick={exportPlainText}>Plain Text</button>
          <button id="btn-export-link" onClick={copyShareLink}>Copy Share Link</button>
          {copyState === 'copied' && <p id="export-copy-status">Copied link</p>}
          {copyState === 'failed' && <p id="export-copy-status">Copy failed</p>}
        </div>
      )}
    </div>
  );
}
