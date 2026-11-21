import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ScannedIdPreview } from '../../src/components/domain/ScannedIdPreview';
import type { IdVariant } from '../../src/components/domain/ScannedIdPreview';
import { docsParameters } from '../_shared/docs';
import { Column, Row, Specimen } from '../_shared/layout';
import { PDF_DATA_URL, PNG_DATA_URL } from './fixtures';

const VARIANTS: { variant: IdVariant; documentType?: string }[] = [
  { variant: 'qid', documentType: 'QID' },
  { variant: 'passport', documentType: 'Passport' },
  { variant: 'gcc', documentType: 'GCC ID' },
  { variant: 'diplomatic', documentType: 'Diplomatic ID' },
  { variant: 'b2b2c' },
  { variant: 'retired' },
  { variant: 'mada' },
];

const meta = {
  title: 'Documents/Scanned ID Preview',
  component: ScannedIdPreview,
  parameters: {
    ...docsParameters({
      purpose: 'The captured document shown back to the agent after a scan or upload. Always a drawn, obviously synthetic specimen unless a real image (`src`) is given - never a photograph of a real card.',
      source: 'src/components/domain/ScannedIdPreview.tsx',
      variants: ['QID, Passport (data page and inside page), GCC ID, Diplomatic ID.', 'Customer-type scenarios, named through `variant`: `b2b2c` (employee card), `retired`, `mada` (payment card).', 'A real captured image (`src`), or an uploaded PDF (`src` as a PDF data URL, drawn by the browser\'s viewer; `fullPage` for a whole portrait page).'],
      states: ['Clear.', 'Unclear (`clear={false}`): the same card blurred - a first pass the reader could not read; the agent retakes.', 'Image failed to load: falls back to the drawn card.'],
      usage: ['`identity` draws the customer\'s own name, number and dates in place of the fixed specimen person.', 'The specimen text is marked synthetic (`NEXT_PUBLIC_SHOW_DEMO=false` hides it in a production build).'],
      accessibility: ['The drawing is `role="img"` with a label naming the side and, when blurred, that it is unreadable and must be retaken.'],
    }),
  },
  argTypes: {
    side: { control: 'inline-radio', options: ['front', 'back'], description: 'Which face.' },
    documentType: { control: 'select', options: ['QID', 'Passport', 'GCC ID', 'Diplomatic ID', 'Other ID'], description: 'Which document this depicts; drives the drawn layout when no `variant` is given.' },
    variant: { control: 'select', options: [undefined, 'qid', 'passport', 'gcc', 'diplomatic', 'b2b2c', 'retired', 'mada'], description: 'Layout, overriding the one derived from `documentType`.' },
    clear: { control: 'boolean', description: 'False blurs the capture (unreadable).' },
    fullPage: { control: 'boolean', description: 'An uploaded PDF drawn as a whole portrait page.' },
    src: { control: 'text', description: 'A real capture (image or PDF data URL).' },
    identity: { control: 'object', description: 'The customer whose document this is: name, idNo, nationality, dob, expiry (dd/mm/yyyy).' },
  },
  args: { side: 'front', documentType: 'QID', clear: true },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof ScannedIdPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Simulated capture of the QID front side' })).toBeVisible();
  },
};
export const QidBack: Story = { args: { side: 'back' } };
export const Passport: Story = { args: { documentType: 'Passport' } };
export const PassportBack: Story = { args: { documentType: 'Passport', side: 'back' } };
export const GccId: Story = { args: { documentType: 'GCC ID' } };
export const DiplomaticId: Story = { args: { documentType: 'Diplomatic ID' } };
export const Unclear: Story = {
  args: { clear: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: /unreadable, retake the scan/ })).toBeVisible();
  },
};
export const WithCustomerIdentity: Story = {
  args: { identity: { name: 'Aisha Al Naimi', idNo: '29850123456', nationality: 'Qatari', dob: '14/03/1985', expiry: '20/06/2030' } },
};
export const CapturedImage: Story = {
  args: { src: PNG_DATA_URL },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Scanned QID, front side' })).toBeVisible();
  },
};
export const UploadedPdf: Story = { args: { src: PDF_DATA_URL, fullPage: true } };

export const AllDocumentLayouts: Story = {
  decorators: [(Story) => <div><Story /></div>],
  render: (args) => (
    <Column>
      {VARIANTS.map(({ variant, documentType }) => (
        <Specimen key={variant} label={`${variant}: front and back`}>
          <Row>
            {(['front', 'back'] as const).map((side) => (
              <div key={side} style={{ width: 320 }}>
                <ScannedIdPreview {...args} side={side} variant={variant} documentType={documentType} />
              </div>
            ))}
          </Row>
        </Specimen>
      ))}
    </Column>
  ),
};
