import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { docsParameters } from '../_shared/docs';
import { Section } from '../_shared/layout';

function SkipLink() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="stack gap-3" ref={ref}>
      <p className="body-text">The first Tab stop on every page is the <code className="code-chip">.skip-link</code> (&quot;Skip to main content&quot;): visually hidden until focused, then fixed at the top left above everything (<code className="code-chip">--z-toast</code>); activating it moves focus to the single <code className="code-chip">&lt;main&gt;</code> with no route change and no <code className="code-chip">#fragment</code> left behind.</p>
      <p className="caption-muted">Specimen (focus it with Tab to reveal it):</p>
      <div className="card pad-row"><a href="#specimen" className="skip-link">Skip to main content</a><span className="caption-muted">Click here, then press Tab.</span></div>
    </div>
  );
}

function Announcements() {
  return (
    <div className="stack gap-3">
      <p className="body-text">
        On each route change the app updates one polite live region (<code className="code-chip">role=&quot;status&quot; aria-live=&quot;polite&quot;</code>) with the page name taken from the page heading (for example &quot;Orders page&quot;), updates the document title,
        and moves focus to <code className="code-chip">&lt;main&gt;</code> after about 150 ms. There is exactly one announcer, never a duplicate. Back announces the page it returns to. This is application-shell behaviour (not a component), pinned by the route-announcement test in <code className="code-chip">e2e/a11y.spec.ts</code>.
      </p>
    </div>
  );
}

const meta = {
  title: 'Foundations/Application Accessibility',
  parameters: {
    ...docsParameters({
      purpose: 'The application-shell accessibility behaviour that sits on top of the design system (focus ring, contrast and tap targets are in the design-system Storybook): the skip link and route announcements.',
      source: 'src/app-components.css (.skip-link), src/navigation, e2e/a11y.spec.ts',
      accessibility: ['The first Tab stop on every page is the skip link; route changes are announced once and move focus to main.'],
    }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SkipLinkSpecimen: Story = { name: 'Skip link', render: () => <Section title="Skip link"><SkipLink /></Section> };
export const RouteAnnouncements: Story = { render: () => <Section title="Route announcements"><Announcements /></Section> };
