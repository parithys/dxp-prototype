import { useState } from 'react';
import { scanDocument } from '../../lib/documentScan';

/**
 * The one way a document is scanned in the UI: runs the existing scan (lib/documentScan.ts) for a document type and hands the file to the caller, with the busy
 * and error state a Scan button needs. `page` is the number of this scan within a multi-page (flatbed) document.
 */
export function useDocumentScan(documentType?: string) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scan = async (onFile: (file: File) => void, page?: number) => {
    setScanning(true);
    setError(null);
    try {
      onFile(await scanDocument(new Date(), documentType, page));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The scan failed. Try again.');
    } finally {
      setScanning(false);
    }
  };
  return { scanning, error, scan };
}
