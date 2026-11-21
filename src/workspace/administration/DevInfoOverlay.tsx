import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, Icon, CODE_ICON } from 'dxp-ui';
import { useAppSelector } from '../../stores/hooks';

// Dev Mode's "Dev Info": while the Dev Mode switch (left navigation) is on, every card and container carries a small icon on its top-right corner. Clicking it opens a dialog with the
// full path of the source file that draws that element - the nearest component of the application that renders it - and the chain of components above it. The element's React fiber
// gives the component names (a component's `name` / `displayName`, so a production build, which minifies them, finds nothing); the Component Catalogue (componentCatalogue.generated.json,
// built from the source by reference/scripts/build_ui_component_inventory.py) says which file each component name is defined in.

/** What carries the icon: the shadcn Card (every container built on it), the legacy `.card` class and labelled sections. */
const TARGETS = '[data-slot="card"], .card, section[aria-label]';
const MIN_W = 160;
const MIN_H = 56;
/** The folder the source tree sits in, as the path is written ("vodafone-dxp-shadcn/src/..."). */
const PROJECT_FOLDER = 'vodafone-dxp-shadcn';

interface CatalogueEntry {
  name: string;
  layer: string;
  paths: string[];
}
interface Fiber {
  type?: unknown;
  return?: Fiber | null;
}
interface Mark {
  el: Element;
  left: number;
  top: number;
}
interface Resolved {
  /** The nearest application component that renders the element, with every file that defines a component of that name. */
  primary?: { name: string; paths: string[] };
  /** The components above the element, nearest first, with their files (empty when the catalogue does not know the name). */
  chain: { name: string; paths: string[] }[];
}

const fiberOf = (el: Element): Fiber | undefined => {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  return key ? (el as unknown as Record<string, Fiber>)[key] : undefined;
};

const nameOf = (type: unknown): string | undefined => {
  if (typeof type === 'function') return (type as { displayName?: string }).displayName || (type as { name?: string }).name || undefined;
  if (type && typeof type === 'object') {
    const t = type as { displayName?: string; render?: unknown; type?: unknown };
    return t.displayName || nameOf(t.render) || nameOf(t.type);
  }
  return undefined;
};

/** The component names above an element, nearest first, without repeats. */
function componentNames(el: Element): string[] {
  const names: string[] = [];
  for (let f = fiberOf(el); f; f = f.return ?? undefined) {
    const n = nameOf(f.type);
    if (n && n !== names[names.length - 1]) names.push(n);
  }
  return names;
}

function resolve(el: Element, catalogue: Map<string, CatalogueEntry>): Resolved {
  const chain = componentNames(el)
    .map((name) => ({ name, entry: catalogue.get(name) }))
    .filter((c): c is { name: string; entry: CatalogueEntry } => Boolean(c.entry))
    .map((c) => ({ name: c.name, layer: c.entry.layer, paths: c.entry.paths }));
  // The generic building blocks (Card, Button ...) draw every container; the file that matters is the first component above them that belongs to a page, capability or pattern.
  const first = chain.find((c) => c.layer !== 'Primitive') ?? chain[0];
  return { primary: first && { name: first.name, paths: first.paths }, chain: chain.map(({ name, paths }) => ({ name, paths })) };
}

const full = (path: string) => `${PROJECT_FOLDER}/${path}`;

export function DevInfoOverlay() {
  const enabled = useAppSelector((s) => s.devMode.enabled);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [catalogue, setCatalogue] = useState<Map<string, CatalogueEntry>>();
  const [shown, setShown] = useState<{ title: string; resolved: Resolved } | undefined>();
  const frame = useRef(0);

  // The catalogue is read only once Dev Mode is first switched on.
  useEffect(() => {
    if (!enabled || catalogue) return;
    void import('./componentCatalogue.generated.json').then((m) => setCatalogue(new Map((m.default as CatalogueEntry[]).map((e) => [e.name, e]))));
  }, [enabled, catalogue]);

  const scan = useCallback(() => {
    const out: Mark[] = [];
    for (const el of document.querySelectorAll(TARGETS)) {
      if (el.closest('[data-dev-info]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < MIN_W || r.height < MIN_H || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
      out.push({ el, left: Math.min(r.right, window.innerWidth) - 14, top: Math.max(r.top, 0) - 10 });
    }
    setMarks(out);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const schedule = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(scan);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, scan]);

  if (!enabled || typeof document === 'undefined') return null;

  const open = (el: Element) => {
    const label = el.getAttribute('aria-label') ?? el.querySelector('h1, h2, h3, h4')?.textContent?.trim();
    setShown({ title: label || 'Dev Info', resolved: catalogue ? resolve(el, catalogue) : { chain: [] } });
  };
  const primary = shown?.resolved.primary;

  return (
    <>
      {createPortal(
        <div className="dev-info-layer" data-dev-info>
          {marks.map((m, i) => (
            <Button key={i} variant="ghost" size="icon-sm" type="button" aria-label="Dev Info: Show the Source File" title="Dev Info" className="dev-info-btn" style={{ left: m.left, top: m.top }} onClick={() => open(m.el)}>
              <Icon path={CODE_ICON} className="size-3.5" />
            </Button>
          ))}
        </div>,
        document.body,
      )}
      <Modal open={Boolean(shown)} onClose={() => setShown(undefined)} title="Dev Info" subtitle={shown?.title} icon={CODE_ICON} widthClassName="max-w-2xl">
        {primary ? (
          <div className="stack gap-4">
            <div>
              <p className="eyebrow">Source File</p>
              {primary.paths.map((p) => (
                <code key={p} className="block break-all value-text">
                  {full(p)}
                </code>
              ))}
              <p className="caption-secondary mt-1">
                Drawn by <strong>{primary.name}</strong>
                {primary.paths.length > 1 ? ' - several files define a component of this name' : ''}.
              </p>
            </div>
            <div>
              <p className="eyebrow">Components Above It</p>
              <ul className="stack gap-1">
                {shown?.resolved.chain.map((c) => (
                  <li key={c.name} className="caption-secondary break-all">
                    <strong>{c.name}</strong> - {c.paths.map(full).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="body-text">{catalogue ? 'No component of the application was found above this element (component names are minified in a production build; run the dev server).' : 'Loading the component catalogue...'}</p>
        )}
      </Modal>
    </>
  );
}
