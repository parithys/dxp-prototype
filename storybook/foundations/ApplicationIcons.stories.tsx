import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Icon } from 'dxp-ui';
import { stepIcon } from '../../src/assets/icons/stepIcons';
import { JOURNEY_ICON_IDS, journeyIcon } from '../../src/assets/icons/journeyIcons';
import stepIconsSource from '../../src/assets/icons/stepIcons.ts?raw';
import { docsParameters } from '../_shared/docs';
import { FilterBox, Section } from '../_shared/layout';

interface Entry { name: string; path: string }
interface IconGroup { id: string; file: string; entries: Entry[] }

// stepIcons.ts keeps its table private, so the keys are read from its own source and resolved through its exported stepIcon().
const stepKeys = [...new Set([...stepIconsSource.matchAll(/^\s*(?:'([^']+)'|([A-Za-z][\w]*))\s*:\s*[A-Z_]/gm)].map((m) => m[1] ?? m[2]))];

const GROUPS: IconGroup[] = [
  { id: 'steps', file: 'stepIcons.ts (stepIcon(key))', entries: stepKeys.map((k) => ({ name: k, path: stepIcon(k) })) },
  { id: 'journeys', file: 'journeyIcons.ts (journeyIcon(id))', entries: JOURNEY_ICON_IDS.map((id) => ({ name: id, path: journeyIcon(id, '') })) },
];

function copyName(name: string) {
  try {
    void navigator.clipboard?.writeText(name);
  } catch {
    /* clipboard blocked: the name is still shown */
  }
}

function IconTile({ entry, onCopy }: { entry: Entry; onCopy: (n: string) => void }) {
  return (
    <button type="button" className="card card-button stack-center gap-2 focus-ring" aria-label={`Copy ${entry.name}`} onClick={() => onCopy(entry.name)}>
      <Icon path={entry.path} className="w-8 h-8" />
      <span className="caption-muted break-all text-center">{entry.name}</span>
    </button>
  );
}

function Gallery({ only }: { only?: string }) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const groups = useMemo(() => GROUPS.filter((g) => !only || g.id === only), [only]);
  const q = query.trim().toLowerCase();
  const onCopy = (n: string) => {
    copyName(n);
    setCopied(n);
  };
  return (
    <div className="stack gap-6">
      <FilterBox value={query} onChange={setQuery} label="Filter icons by name" />
      <p className="caption-muted" role="status">{copied ? `Copied ${copied}` : 'Click an icon to copy its export name.'}</p>
      {groups.map((g) => {
        const shown = g.entries.filter((e) => !q || e.name.toLowerCase().includes(q));
        return (
          <Section key={g.id} title={`${g.file} (${shown.length})`}>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]">
              {shown.map((e) => <IconTile key={`${g.id}-${e.name}`} entry={e} onCopy={onCopy} />)}
            </div>
          </Section>
        );
      })}
    </div>
  );
}

const meta = {
  title: 'Foundations/Application Icons',
  parameters: {
    ...docsParameters({
      purpose: 'The application-level icon tables (wizard step icons and service journey icons), drawn by the design system\'s one Icon primitive. The design-system icons (navigation, actions, status, objects) are in the design-system Storybook.',
      source: 'src/assets/icons/stepIcons.ts, journeyIcons.ts',
      usage: ['Resolve an icon with `stepIcon(key)` / `journeyIcon(id)`; never write a path string in a component.'],
    }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const StepIcons: Story = { render: () => <Gallery only="steps" /> };
export const JourneyIcons: Story = { render: () => <Gallery only="journeys" /> };
export const Search: Story = {
  render: () => <Gallery only="steps" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = await canvas.findByRole('searchbox', { name: 'Filter icons by name' });
    await userEvent.type(box, 'zzzz-no-such-icon');
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
};
