// Layout helpers for stories that show several variants or states at once. They carry no look of their own: they only arrange children with the
// application's own layout classes (the design system's components.css and the app's app-components.css: .stack, .cluster, .grid-2-up, .caption-muted ...), so what is shown is the production component.
import type { ReactNode } from 'react';

/** One labelled specimen (a variant or a state) in a matrix. */
export function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stack gap-2">
      <p className="caption-muted">{label}</p>
      {children}
    </div>
  );
}

/** A row of specimens that wraps. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="cluster gap-4 items-start">{children}</div>;
}

/** A column of specimens. */
export function Column({ children }: { children: ReactNode }) {
  return <div className="stack gap-6">{children}</div>;
}

/** Two specimens side by side (e.g. Web and Tablet). */
export function SideBySide({ children }: { children: ReactNode }) {
  return <div className="grid-2-up gap-6 items-start">{children}</div>;
}

/** Section heading + children, laid out with the app's own classes. */
export function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="stack gap-3">
      <h3 className="title title-md">{title}</h3>
      {note && <p className="caption-muted">{note}</p>}
      {children}
    </section>
  );
}

/** Filter box (the app's own form-control class). */
export function FilterBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input type="search" aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} className="form-control" />
  );
}
