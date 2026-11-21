import { useEffect, useState } from 'react';
import { useAppSelector } from '../stores/hooks';

/** m:ss, or h:mm:ss from the first hour. */
function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Servicing time for the customer in hand. Runs from Next Customer until the interaction ends (Finish, Done & Exit, View My Orders,
// Additional Comments, Abandoned - see qnomyRelease.ts); once stopped it keeps showing the final duration until the next call.
//
// `inline` renders just the reading, for use inside the Finish button; otherwise a labelled stack for the header.
export function ServiceTimer({ inline = false }: { inline?: boolean }) {
  const startedAt = useAppSelector((s) => s.qnomyQueue.serviceStartedAt);
  const stoppedAt = useAppSelector((s) => s.qnomyQueue.serviceStoppedAt);
  const running = startedAt != null && stoppedAt == null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (startedAt == null) return null;
  const elapsed = (stoppedAt ?? Math.max(now, startedAt)) - startedAt;
  if (inline) {
    return (
      <span role="timer" aria-label={`Service time ${formatElapsed(elapsed)}`} className="tabular-nums">
        ({formatElapsed(elapsed)})
      </span>
    );
  }
  return (
    <div className="flex flex-col leading-tight" role="timer" aria-label={`Service time ${formatElapsed(elapsed)}${running ? '' : ', stopped'}`}>
      <span className="caption-muted uppercase tracking-wide">{running ? 'Timer' : 'Handled in'}</span>
      <span className="title title-sm font-semibold tabular-nums">{formatElapsed(elapsed)}</span>
    </div>
  );
}
