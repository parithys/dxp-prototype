import type { Meta, StoryObj } from '@storybook/react-vite';
import { appPath } from '../../src/lib/basePath';
import { docsParameters } from '../_shared/docs';

const FILES = [
  { file: 'vodafone-logo-small.svg', note: 'The red disc with the white speech-mark (what VodafoneMark draws).' },
  { file: 'vodafone-logo-big.svg', note: 'The mark followed by the wordmark.' },
  { file: 'login-bg.jpg', note: 'Sign-in page background photograph.' },
];

function Assets() {
  return (
    <div className="stack gap-4">
      <p className="body-text">Brand files live in <code className="code-chip">public/brand/</code> and are addressed with <code className="code-chip">appPath(&apos;/brand/...&apos;)</code>, so they follow the deployment base path.</p>
      <div className="grid-2-up gap-6">
        {FILES.map((f) => (
          <div key={f.file} className="card pad-panel stack gap-2">
            <img src={appPath(`/brand/${f.file}`)} alt={f.file} className="h-24 w-full object-contain" />
            <code className="code-chip">/brand/{f.file}</code>
            <span className="caption-muted">{f.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Favicon() {
  return (
    <div className="stack gap-3">
      <p className="body-text">The browser tab icon is <code className="code-chip">public/favicon.svg</code>, declared as <code className="code-chip">metadata.icons</code> in <code className="code-chip">app/layout.tsx</code>.</p>
      <img src={appPath('/favicon.svg')} alt="Favicon" className="h-8 w-8" />
    </div>
  );
}

const meta = {
  title: 'Foundations/Brand Files',
  parameters: {
    ...docsParameters({
      purpose: 'The application brand files (public/brand) and favicon. The mark and wordmark components are in the design-system Storybook. Use appPath(); never hard-code a /brand path.',
      source: 'public/brand/*, src/lib/basePath.ts',
        }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const BrandFiles: Story = { render: () => <Assets /> };
export const FaviconNote: Story = { name: 'Favicon', render: () => <Favicon /> };
