import { formatDateTime } from '../../../lib/format';
import { EmptyState, Button, Textarea, Card } from 'dxp-ui';
import type { Ticket } from './ticketDetailModel';

interface Props {
  notes: NonNullable<Ticket['publicNotes']>;
  noteText: string;
  setNoteText: (v: string) => void;
  addNote: () => void;
}

export function TicketNotesCard({ notes, noteText, setNoteText, addNote }: Props) {
  return (
    <Card className="p-5">
      <h2 className="title title-lg mb-3">Public Notes</h2>
      <div className="space-y-2 mb-3">
        {notes.length === 0 && <EmptyState compact message="No public notes yet." />}
        {notes.map((n, i) => (
          <div key={i} className="quote-accent">
            <p className="text-fg">{n.text}</p>
            <p className="caption-muted">{n.author} - {formatDateTime(n.createdAt)}</p>
          </div>
        ))}
      </div>
      <Textarea aria-label="Add a public note" placeholder="Add a public note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
      <Button variant="secondary" className="mt-2" onClick={addNote} disabled={!noteText.trim()}>
        Add Note
      </Button>
    </Card>
  );
}
