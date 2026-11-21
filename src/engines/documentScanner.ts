import { getDocumentTypes } from './configEngine';
import type { DeviceType } from 'dxp-ui';

/**
 * Which scanner takes a document: decided by the device and the document type.
 *   tablet / mobile  the device camera (or an upload): no desk scanner
 *   web              the type's configured desk scanner (public/config/document-types.json `scanner`): OCR scanner, or flatbed
 * A type the configuration does not name, or a label that is not a configured type (a free-typed label), is read by the OCR scanner.
 */
export type ScannerType = 'ocr' | 'flatbed' | 'camera';

export function scannerTypeFor(documentLabel: string, device: DeviceType): ScannerType {
  if (device === 'tablet') return 'camera';
  const wanted = documentLabel.trim().toLowerCase();
  const type = getDocumentTypes().find((t) => t.label.toLowerCase() === wanted);
  return type?.scanner ?? 'ocr';
}
