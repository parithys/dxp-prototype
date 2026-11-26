import { UPLOAD_RULES } from './documentUploadRules';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, CameraCaptureButton, detectDeviceType, Icon, ScanFailureNotice, UPLOAD_ICON } from 'dxp-ui';
import { ID_UPLOAD_ACCEPT, idCaptureOptions, idFileProblem, readIdFile } from './idUploadModel';
import type { IdUploadResult, UploadedIdFile } from './idUploadModel';


/**
 * "Upload" for an identity document: a button that takes the file(s) instead of the reader. Checks them (type, size), reads them and hands
 * over an IdUploadResult, whichever way the ID arrives:
 *
 *   `side` absent (the whole document): two files are the front and the back, in that order; ONE file - an image or a PDF - is asked
 *   "what does this show?": both sides (a single image or a PDF of both), the front only or the back only.
 *   `side` set: one file for that side.
 *
 * A problem is reported next to the button, and nothing is handed over.
 *
 * On a tablet the reader (`leading`) is never shown: Open Camera sits before the upload instead, and its photo is taken exactly as a one-file upload.
 */
export function IdFileUpload({
  label = 'Upload document',
  side,
  disabled,
  align = 'center',
  leading,
  scanner = leading !== undefined,
  bothActions = false,
  readerEverywhere = false,
  multiple = false,
  existingNames = [],
  onUpload,
}: {
  label?: string;
  side?: 'front' | 'back';
  disabled?: boolean;
  /** Where the note and any problem sit under the button: centred (default) or at the end (the button is at the right of a row). */
  align?: 'center' | 'end';
  /** Shown immediately before the button, in the same row, so the two always stay together (e.g. Initiate scan). */
  leading?: ReactNode;
  /** The reader is offered at this step (defaults to whether `leading` is given). Web shows the reader, tablet shows upload; upload stays when there is no reader. */
  scanner?: boolean;
  /** Offer the reader and upload on every device, whatever the device type. */
  bothActions?: boolean;
  /** The reader stays offered on a tablet (upload joins it there). Default: web scans, tablet uploads. */
  readerEverywhere?: boolean;
  /** Any number of files, each added to the ones already uploaded (reported as a 'set'). */
  multiple?: boolean;
  /** Names (with their format) of the files already uploaded: a file with the same name and format is not taken again. */
  existingNames?: string[];
  onUpload: (result: IdUploadResult) => void;
}) {
  const { scan, upload, camera } = idCaptureOptions(detectDeviceType(), scanner, bothActions, readerEverywhere);
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const take = async (list: FileList | readonly File[] | null) => {
    const files = list ? [...list] : [];
    if (input.current) input.current.value = '';
    if (!files.length) return;
    if (!multiple && files.length > (side ? 1 : 2)) {
      setProblem(side ? 'Select one file.' : 'Select one file, or two: the front then the back.');
      return;
    }
    const bad = files.map(idFileProblem).find(Boolean);
    if (bad) {
      setProblem(bad);
      return;
    }
    // The same name AND format (Qatar-ID.pdf twice) is a duplicate; Qatar-ID.pdf beside Qatar-ID.png is not.
    if (multiple) {
      const seen = new Set(existingNames.map((n) => n.toLowerCase()));
      const fresh = files.filter((f) => !seen.has(f.name.toLowerCase()) && (seen.add(f.name.toLowerCase()), true));
      const dupes = files.filter((f) => !fresh.includes(f)).map((f) => f.name);
      if (dupes.length) setProblem(`${[...new Set(dupes)].join(', ')} ${new Set(dupes).size > 1 ? 'are' : 'is'} already uploaded.`);
      else setProblem(null);
      if (!fresh.length) return;
      files.splice(0, files.length, ...fresh);
      setBusy(true);
      try {
        onUpload({ sides: 'set', files: await Promise.all(files.map(async (f) => ({ name: f.name, image: await readIdFile(f) }))) });
      } catch {
        setProblem('A file could not be read. Try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      const read: UploadedIdFile[] = await Promise.all(files.map(async (f) => ({ name: f.name, image: await readIdFile(f) })));
      if (multiple) onUpload({ sides: 'set', files: read });
      else if (side) onUpload({ sides: side, files: read });
      else if (read.length === 2) onUpload({ sides: 'pair', files: read });
      // One file is the uploaded document as it stands: no question about which sides it shows.
      else onUpload({ sides: 'both', files: [read[0]] });
    } catch {
      setProblem('A file could not be read. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`stack gap-1.5 ${align === 'end' ? 'stack-end' : 'items-center'}`}>
      <input ref={input} type="file" accept={ID_UPLOAD_ACCEPT} multiple={!side} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void take(e.target.files)} />
      <div className="row-start flex-nowrap">
        {scan && leading}
        {camera && (
          <CameraCaptureButton
            documentType={side ? `${side} side` : undefined}
            ariaLabel={side ? `Open Camera for the ${side} side` : undefined}
            disabled={disabled || busy}
            onCapture={(f) => void take([f])}
          />
        )}
        {upload && (
          <Button variant="secondary" size="sm" className="shrink-0" disabled={disabled || busy} onClick={() => input.current?.click()}>
            <Icon path={UPLOAD_ICON} className="size-4 " />
            {busy ? 'Reading…' : label}
          </Button>
        )}
      </div>
      {upload && !side && (
        <span className="caption-muted">{UPLOAD_RULES.identity.formatsLabel}, up to {UPLOAD_RULES.identity.maxLabel} per file</span>
      )}
      {problem && <ScanFailureNotice lines={[problem]} />}
    </div>
  );
}
