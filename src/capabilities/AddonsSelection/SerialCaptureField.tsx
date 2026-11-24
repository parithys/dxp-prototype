import { useState } from 'react';
import { BARCODE_ICON, Button, CLEAR_ICON, Icon, Input } from 'dxp-ui';

/**
 * A device's serial number on the Add-ons page (a set-top box, a Mesh extender), as the Physical SIM's field: type it, or scan the device's barcode with the icon in the field (simulated here - no scanner
 * hardware - `sample` is what the reader reads, a moment later). `divided`: a hairline above it (alone in a card); false where a parent lays several out together. The clear (x) icon appears once there is a serial and empties it so another can be scanned. Required: the choice is not complete without it.
 */
export function SerialCaptureField({ serial = '', onChange, label, kind, sample, divided = true }: { serial: string | undefined; onChange: (serial: string | undefined) => void; label: string; kind: string; sample: () => string | undefined; divided?: boolean }) {
  const [scanning, setScanning] = useState(false);
  const scan = () => {
    setScanning(true);
    window.setTimeout(() => {
      const read = sample();
      if (read) onChange(read);
      setScanning(false);
    }, 600);
  };
  return (
    <div className={divided ? 'divider-top pt-3' : undefined}>
      <Input
        label={label}
        required
        placeholder={`Enter the ${kind} serial number, or use the barcode scanner`}
        value={serial}
        onChange={(e) => onChange(e.target.value.toUpperCase() || undefined)}
        trailingAddon={
          <>
            {serial && (
              <Button variant="ghost" size="icon" type="button" onClick={() => onChange(undefined)} aria-label={`Clear ${label}`} title="Clear" className="icon-button-inline icon-button-quiet size-auto">
                <Icon path={CLEAR_ICON} className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" type="button" onClick={scan} disabled={scanning} aria-label={`Scan barcode for ${label}`} title={scanning ? 'Scanning…' : `Scan ${kind} barcode`} className="icon-button-inline icon-button-quiet size-auto -mr-1.5">
              <Icon path={BARCODE_ICON} className="size-4" />
            </Button>
          </>
        }
      />
      {scanning && <span className="caption-muted">Scanning…</span>}
    </div>
  );
}
